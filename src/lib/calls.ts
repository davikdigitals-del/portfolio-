/**
 * CallManager — WebRTC with reliable signaling via Supabase Realtime broadcast
 *
 * Key fix: The initiator waits for the receiver to signal "ready" before
 * sending the offer. This eliminates the race condition where the offer
 * arrives before the receiver has subscribed to the channel.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type CallType = "voice" | "video";
export type CallStatus = "ringing" | "active" | "ended" | "missed" | "declined";

export interface Call {
  id: string;
  conversation_id: string;
  initiator_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

type SigMsg =
  | { type: "ready" }                    // receiver → initiator: "I'm subscribed, send offer"
  | { type: "offer"; sdp: string }       // initiator → receiver
  | { type: "answer"; sdp: string }      // receiver → initiator
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "end" }
  | { type: "declined" };

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private callId: string | null = null;
  private callType: CallType = "voice";
  private startTime: number | null = null;
  private isInitiator = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private conversationId: string | null = null;
  private initiatorId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  onCallEndCb: (() => void) | null = null;
  onCallActiveCb: (() => void) | null = null;

  // ── INITIATOR ──────────────────────────────────────────────────────────────
  async initiateCall(conversationId: string, receiverId: string, callType: CallType, userId: string): Promise<Call> {
    this.cleanup();
    this.isInitiator = true;
    this.callType = callType;
    this.conversationId = conversationId;
    this.initiatorId = userId;

    // 1. Create call row
    const { data: call, error } = await supabase
      .from("calls")
      .insert({ conversation_id: conversationId, initiator_id: userId, receiver_id: receiverId, call_type: callType, status: "ringing" })
      .select("*").single();
    if (error || !call) throw error ?? new Error("Failed to create call");
    this.callId = call.id;

    // 2. Acquire media
    await this.acquireMedia(callType);

    // 3. Open signaling channel and wait for SUBSCRIBED
    await this.openSignaling(call.id);

    // 4. Build peer connection — but DON'T add tracks yet
    //    We wait for receiver's "ready" signal before adding tracks
    //    (adding tracks triggers onnegotiationneeded → offer)
    this.buildPC(false);

    console.log("[CM] Initiator ready, waiting for receiver 'ready' signal");
    return call as Call;
  }

  // ── RECEIVER ───────────────────────────────────────────────────────────────
  async answerCall(call: Call, userId: string): Promise<void> {
    this.cleanup();
    this.isInitiator = false;
    this.callId = call.id;
    this.callType = call.call_type;
    this.conversationId = call.conversation_id;
    this.initiatorId = call.initiator_id;

    // 1. Acquire media
    await this.acquireMedia(call.call_type);

    // 2. Open signaling channel and wait for SUBSCRIBED
    await this.openSignaling(call.id);

    // 3. Build peer connection with tracks (receiver is ready)
    this.buildPC(true);

    // 4. Tell initiator we're ready — they will now send the offer
    await this.sendSignal({ type: "ready" });
    console.log("[CM] Receiver sent 'ready', waiting for offer");

    // 5. Update DB
    await supabase.from("calls").update({ status: "active", started_at: new Date().toISOString() }).eq("id", call.id);
  }

  async declineCall(callId: string): Promise<void> {
    console.log("[CM] Declining call:", callId);
    
    // Store callId before cleanup
    const storedCallId = callId || this.callId;
    
    try {
      // Try to send signal if channel is open
      if (this.channel) {
        console.log("[CM] Sending declined signal to other party");
        await this.sendSignal({ type: "declined" });
      } else {
        console.log("[CM] No channel open, signal not sent (receiver hasn't connected yet)");
      }
      
      // Update database - this is the critical part that both sides will see
      if (storedCallId) {
        console.log("[CM] Updating call status to declined in database");
        await supabase
          .from("calls")
          .update({ status: "declined", ended_at: new Date().toISOString() })
          .eq("id", storedCallId);
        
        // Insert declined call message
        if (this.conversationId && this.initiatorId) {
          const isVideo = this.callType === "video";
          await supabase.from("messages").insert({
            conversation_id: this.conversationId,
            sender_id: this.initiatorId,
            content: `❌ ${isVideo ? "Video" : "Voice"} call declined`,
            type: "call",
            call_data: { call_type: this.callType, status: "declined", duration_seconds: 0 },
          }).catch(e => console.error("[CM] Failed to insert declined message:", e));
        }
        
        console.log("[CM] Call declined successfully");
      }
    } catch (err) {
      console.error("[CM] Error declining call:", err);
    } finally {
      // Always cleanup
      this.cleanup();
    }
  }

  async endCall(): Promise<void> {
    console.log("[CM] Ending call");
    const endCb = this.onCallEndCb;
    try {
      if (this.callId) {
        const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        
        // Send signal first so the other party knows immediately
        await this.sendSignal({ type: "end" });
        
        // Update database
        await supabase
          .from("calls")
          .update({ 
            status: "ended", 
            ended_at: new Date().toISOString(), 
            duration_seconds: duration 
          })
          .eq("id", this.callId);
        
        // Insert call message
        await this.insertCallMessage("ended", duration);
        
        console.log("[CM] Call ended successfully, duration:", duration);
      }
    } catch (err) {
      console.error("[CM] Error ending call:", err);
    } finally {
      // Always cleanup
      this.cleanup();
      endCb?.();
    }
  }

  toggleAudio(muted: boolean): boolean {
    console.log("[CM] toggleAudio called - muted:", muted);
    console.log("[CM] localStream exists:", !!this.localStream);
    
    if (!this.localStream) {
      console.error("[CM] No localStream found!");
      return false;
    }
    
    const audioTracks = this.localStream.getAudioTracks();
    console.log("[CM] Audio tracks found:", audioTracks.length);
    
    if (audioTracks.length === 0) {
      console.error("[CM] No audio tracks in localStream!");
      return false;
    }
    
    audioTracks.forEach(t => { 
      t.enabled = !muted; 
      console.log("[CM] Audio track", t.id, "enabled:", t.enabled, "readyState:", t.readyState, "muted:", t.muted);
    });
    
    return true;
  }
  
  toggleVideo(off: boolean): boolean {
    console.log("[CM] toggleVideo called - off:", off);
    console.log("[CM] localStream exists:", !!this.localStream);
    
    if (!this.localStream) {
      console.error("[CM] No localStream found!");
      return false;
    }
    
    const videoTracks = this.localStream.getVideoTracks();
    console.log("[CM] Video tracks found:", videoTracks.length);
    
    if (videoTracks.length === 0) {
      console.error("[CM] No video tracks in localStream!");
      return false;
    }
    
    videoTracks.forEach(t => { 
      t.enabled = !off; 
      console.log("[CM] Video track", t.id, "enabled:", t.enabled, "readyState:", t.readyState, "muted:", t.muted);
    });
    
    return true;
  }
  
  // Keep audio flowing in background — do NOT disable tracks
  // Disabling tracks cuts audio for the other person
  pauseAudio() {
    // Intentionally a no-op: audio must keep flowing when app is backgrounded
    console.log("[CM] pauseAudio called — keeping audio active for background call");
  }

  // No-op — audio was never paused
  resumeAudio(_isMuted: boolean) {
    console.log("[CM] resumeAudio called — audio was never paused");
  }

  // Start heartbeat to prevent browser from throttling WebRTC in background
  startHeartbeat() {
    if (this.heartbeatInterval) return;
    console.log("[CM] Starting background heartbeat");

    this.heartbeatInterval = setInterval(() => {
      const pc = this.pc;
      if (!pc) return;

      // Keep ICE alive by checking stats — this prevents browser throttling
      pc.getStats().then(stats => {
        stats.forEach(report => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            // Connection is alive
          }
        });
      }).catch(() => {});

      // Keep audio tracks enabled and flowing
      this.localStream?.getAudioTracks().forEach(track => {
        if (!track.enabled) {
          track.enabled = true;
          console.log("[CM] Heartbeat: re-enabled audio track");
        }
      });

      // If ICE disconnected, try to restart
      if (pc.iceConnectionState === "disconnected") {
        console.log("[CM] Heartbeat: ICE disconnected, restarting");
        pc.restartIce();
      }
    }, 5000); // every 5 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("[CM] Heartbeat stopped");
    }
  }
  
  getLocalStream() { return this.localStream; }
  getCallType() { return this.callType; }
  getCallId() { return this.callId; }
  getPeerConnection() { return this.pc; }

  // ── Private ────────────────────────────────────────────────────────────────

  private async acquireMedia(callType: CallType) {
    // Detect if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log("[CM] Device type:", isMobile ? "Mobile" : "Desktop", "Call type:", callType);
    console.log("[CM] User agent:", navigator.userAgent);
    console.log("[CM] Protocol:", window.location.protocol);
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Your browser doesn't support video/audio calls. Please use a modern browser.");
    }
    
    // CRITICAL: Always use echo cancellation to prevent hearing own voice
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
    };
    
    // Start with very basic constraints for mobile
    if (isMobile) {
      // Try simplest possible constraints first
      try {
        console.log("[CM] Trying absolute minimum mobile settings with echo cancellation...");
        const constraints = callType === "video" 
          ? { audio: audioConstraints, video: true } 
          : { audio: audioConstraints, video: false };
        console.log("[CM] Constraints:", JSON.stringify(constraints));
        
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("[CM] ✅ Mobile media acquired successfully!");
        console.log("[CM] Tracks:", this.localStream.getTracks().map(t => `${t.kind} - enabled:${t.enabled} - readyState:${t.readyState}`));
        
        // Verify echo cancellation is enabled
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          const settings = audioTrack.getSettings();
          console.log("[CM] Audio settings:", settings);
          console.log("[CM] Echo cancellation:", settings.echoCancellation);
        }
        
        return;
      } catch (minErr: any) {
        console.error("[CM] ❌ Minimum mobile failed:", minErr);
        console.error("[CM] Error name:", minErr.name);
        console.error("[CM] Error message:", minErr.message);
        
        // Provide specific error messages based on error type
        if (minErr.name === "NotAllowedError" || minErr.name === "PermissionDeniedError") {
          throw new Error("Camera/microphone permission denied. Please allow access in your browser settings.");
        } else if (minErr.name === "NotFoundError" || minErr.name === "DevicesNotFoundError") {
          throw new Error("No camera or microphone found on your device.");
        } else if (minErr.name === "NotReadableError" || minErr.name === "TrackStartError") {
          throw new Error("Camera/microphone is already in use by another app. Please close other apps and try again.");
        } else if (minErr.name === "OverconstrainedError") {
          throw new Error("Your device doesn't support the required video/audio settings.");
        } else if (minErr.name === "SecurityError") {
          throw new Error("Camera/microphone access blocked. Please use HTTPS or check your browser settings.");
        } else {
          throw new Error(`Failed to access camera/microphone: ${minErr.message}`);
        }
      }
    }
    
    // Desktop - try high quality with echo cancellation
    try {
      console.log("[CM] Trying desktop high quality with echo cancellation...");
      this.localStream = await navigator.mediaDevices.getUserMedia(
        callType === "video"
          ? { 
              audio: audioConstraints, 
              video: { 
                width: { ideal: 3840, max: 3840 }, 
                height: { ideal: 2160, max: 2160 }, 
                frameRate: { ideal: 60, max: 60 },
                facingMode: "user"
              } 
            }
          : { 
              audio: audioConstraints, 
              video: false 
            }
      );
      console.log("[CM] Desktop high quality acquired");
      
      // Verify echo cancellation
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log("[CM] Audio settings:", settings);
        console.log("[CM] Echo cancellation:", settings.echoCancellation);
      }
    } catch (err) {
      console.error("[CM] Desktop high quality failed, trying 1080p:", err);
      // Fallback to 1080p
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(
          callType === "video"
            ? { 
                audio: audioConstraints,
                video: { 
                  width: { ideal: 1920 }, 
                  height: { ideal: 1080 }, 
                  frameRate: { ideal: 30 },
                  facingMode: "user" 
                } 
              }
            : { audio: audioConstraints, video: false }
        );
        console.log("[CM] Desktop 1080p acquired");
      } catch (fallbackErr) {
        console.error("[CM] Desktop fallback failed:", fallbackErr);
        throw new Error(`Could not access camera/microphone. Error: ${fallbackErr.message}`);
      }
    }
  }

  private openSignaling(callId: string): Promise<void> {
    return new Promise((resolve) => {
      const ch = supabase.channel(`call-signal:${callId}`, { config: { broadcast: { ack: false, self: false } } });
      this.channel = ch;
      ch.on("broadcast", { event: "sig" }, ({ payload }) => void this.handleSignal(payload as SigMsg));
      ch.subscribe((status) => {
        console.log("[CM] Signaling:", status);
        if (status === "SUBSCRIBED") resolve();
      });
    });
  }

  private buildPC(addTracksNow: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    this.pc = pc;

    if (addTracksNow) {
      this.localStream?.getTracks().forEach(track => {
        const sender = pc.addTrack(track, this.localStream!);
        
        // Set high bitrate for video
        if (track.kind === "video") {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 8000000; // 8 Mbps for 4K
          params.encodings[0].priority = "high";
          sender.setParameters(params).catch(e => console.warn("[CM] Failed to set bitrate:", e));
        }
      });
    }

    // Remote stream
    pc.ontrack = ({ track, streams }) => {
      console.log("[CM] Remote track:", track.kind);
      const stream = streams[0];
      if (!stream) return;
      this.onRemoteStreamCb?.(stream);
      track.onunmute = () => this.onRemoteStreamCb?.(stream);
    };

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) void this.sendSignal({ type: "ice", candidate: candidate.toJSON() });
    };

    // Connection state with auto-recovery
    pc.onconnectionstatechange = () => {
      console.log("[CM] Connection:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (!this.startTime) this.startTime = Date.now();
        this.onCallActiveCb?.();
        // Start heartbeat to keep call alive in background
        this.startHeartbeat();
      } else if (pc.connectionState === "failed") {
        console.log("[CM] Connection failed, attempting ICE restart");
        // Try ICE restart before giving up
        pc.restartIce();
        setTimeout(() => {
          if (pc.connectionState === "failed") {
            void this.endCall();
          }
        }, 5000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[CM] ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected") {
        console.log("[CM] ICE disconnected, waiting for recovery");
        setTimeout(() => {
          if (this.pc?.iceConnectionState === "disconnected") {
            console.log("[CM] ICE still disconnected, restarting");
            this.pc?.restartIce();
          }
          if (this.pc?.iceConnectionState === "failed") {
            void this.endCall();
          }
        }, 5000);
      }
    };
  }

  private async handleSignal(msg: SigMsg): Promise<void> {
    const pc = this.pc;
    if (!pc) return;

    try {
      if (msg.type === "ready" && this.isInitiator) {
        // Receiver is ready — NOW add tracks and create offer
        console.log("[CM] Receiver ready, adding tracks and creating offer");
        this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.callType === "video",
        });
        await pc.setLocalDescription(offer);
        await this.sendSignal({ type: "offer", sdp: offer.sdp! });
        console.log("[CM] Offer sent");

      } else if (msg.type === "offer" && !this.isInitiator) {
        console.log("[CM] Received offer");
        await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });

        // Flush pending ICE candidates
        for (const c of this.pendingCandidates) {
          try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }
        this.pendingCandidates = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.sendSignal({ type: "answer", sdp: answer.sdp! });
        console.log("[CM] Answer sent");

      } else if (msg.type === "answer" && this.isInitiator) {
        console.log("[CM] Received answer");
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });

        // Flush pending ICE candidates
        for (const c of this.pendingCandidates) {
          try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }
        this.pendingCandidates = [];
        if (!this.startTime) this.startTime = Date.now();

      } else if (msg.type === "ice") {
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(msg.candidate); } catch (e) { console.warn("[CM] ICE error:", e); }
        } else {
          this.pendingCandidates.push(msg.candidate);
        }

      } else if (msg.type === "end" || msg.type === "declined") {
        console.log("[CM] Peer ended/declined via signal");
        const endCb = this.onCallEndCb;
        this.cleanup();
        if (endCb) {
          endCb();
        } else {
          // onCallEndCb not set yet (call was still ringing) — trigger global cleanup
          const endFn = (window as any).__endActiveCall;
          if (endFn) void endFn();
        }
      }
    } catch (err) {
      console.error("[CM] handleSignal error:", err);
    }
  }

  private async sendSignal(msg: SigMsg): Promise<void> {
    if (!this.channel) return;
    try {
      await this.channel.send({ type: "broadcast", event: "sig", payload: msg });
      console.log("[CM] Sent:", msg.type);
    } catch (e) { console.error("[CM] Send failed:", e); }
  }

  private async insertCallMessage(status: "ended" | "missed" | "declined", durationSeconds = 0) {
    if (!this.conversationId || !this.initiatorId) return;
    const isVideo = this.callType === "video";
    let content = `${isVideo ? "📹" : "📞"} ${isVideo ? "Video" : "Voice"} call`;
    if (status === "missed") content = `📵 Missed ${isVideo ? "video" : "voice"} call`;
    else if (status === "declined") content = `❌ ${isVideo ? "Video" : "Voice"} call declined`;
    else if (durationSeconds > 0) {
      const m = Math.floor(durationSeconds / 60), s = durationSeconds % 60;
      content += ` · ${m > 0 ? `${m}m ` : ""}${s}s`;
    }
    try {
      await supabase.from("messages").insert({
        conversation_id: this.conversationId,
        sender_id: this.initiatorId,
        content,
        type: "call",
        call_data: { call_type: this.callType, status, duration_seconds: durationSeconds },
      });
    } catch (e) { console.error("[CM] insertCallMessage error:", e); }
  }

  cleanup() {
    this.stopHeartbeat();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    if (this.channel) { supabase.removeChannel(this.channel); this.channel = null; }
    this.callId = null;
    this.startTime = null;
    this.conversationId = null;
    this.initiatorId = null;
    this.pendingCandidates = [];
    this.isInitiator = false;
  }
}

export const callManager = new CallManager();

// Diagnostic function to test camera/microphone access
export async function testMediaAccess(callType: CallType = "video"): Promise<{ success: boolean; message: string; details?: any }> {
  console.log("[MediaTest] Testing media access for:", callType);
  console.log("[MediaTest] User agent:", navigator.userAgent);
  console.log("[MediaTest] Protocol:", window.location.protocol);
  
  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      success: false,
      message: "Your browser doesn't support video/audio calls. Please use a modern browser like Chrome, Firefox, or Safari.",
      details: { error: "getUserMedia not available" }
    };
  }
  
  try {
    // Try simplest possible constraints
    const constraints = callType === "video" 
      ? { audio: true, video: true } 
      : { audio: true, video: false };
    
    console.log("[MediaTest] Requesting permissions with constraints:", constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    const tracks = stream.getTracks();
    console.log("[MediaTest] ✅ Success! Tracks:", tracks.map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      readyState: t.readyState,
      label: t.label
    })));
    
    // Clean up
    tracks.forEach(t => t.stop());
    
    return {
      success: true,
      message: `✅ Camera and microphone access working! Found ${tracks.length} track(s).`,
      details: {
        tracks: tracks.map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      }
    };
  } catch (err: any) {
    console.error("[MediaTest] ❌ Failed:", err);
    
    let message = "Failed to access camera/microphone. ";
    
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      message += "Permission denied. Please allow access in your browser settings.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      message += "No camera or microphone found on your device.";
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      message += "Camera/microphone is already in use by another app.";
    } else if (err.name === "OverconstrainedError") {
      message += "Your device doesn't support the required settings.";
    } else if (err.name === "SecurityError") {
      message += "Access blocked. Please use HTTPS or check browser settings.";
    } else {
      message += err.message;
    }
    
    return {
      success: false,
      message,
      details: {
        errorName: err.name,
        errorMessage: err.message,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent
      }
    };
  }
}
