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
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", callId);
    await this.sendSignal({ type: "declined" });
    this.cleanup();
  }

  async endCall(): Promise<void> {
    const endCb = this.onCallEndCb;
    if (this.callId) {
      const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
      await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString(), duration_seconds: duration }).eq("id", this.callId);
      await this.insertCallMessage("ended", duration);
    }
    await this.sendSignal({ type: "end" });
    this.cleanup();
    endCb?.();
  }

  toggleAudio(muted: boolean) { this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; }); }
  toggleVideo(off: boolean) { this.localStream?.getVideoTracks().forEach(t => { t.enabled = !off; }); }
  getLocalStream() { return this.localStream; }
  getCallType() { return this.callType; }
  getCallId() { return this.callId; }
  getPeerConnection() { return this.pc; }

  // ── Private ────────────────────────────────────────────────────────────────

  private async acquireMedia(callType: CallType) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
        callType === "video"
          ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } }
          : { audio: true, video: false }
      );
      console.log("[CM] Media:", this.localStream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error("[CM] Media error:", err);
      throw new Error("Could not access camera/microphone. Please allow permissions.");
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
      this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
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

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log("[CM] Connection:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (!this.startTime) this.startTime = Date.now();
        this.onCallActiveCb?.();
      } else if (pc.connectionState === "failed") {
        void this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[CM] ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (this.pc?.iceConnectionState === "disconnected" || this.pc?.iceConnectionState === "failed") {
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
        console.log("[CM] Peer ended/declined");
        const endCb = this.onCallEndCb;
        this.cleanup();
        endCb?.();
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
