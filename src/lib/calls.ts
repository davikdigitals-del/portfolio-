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

// WebRTC ICE servers
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

type SignalMsg =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: string; sdpMLineIndex: number | null; sdpMid: string | null }
  | { type: "end" }
  | { type: "declined" };

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callId: string | null = null;
  private channel: RealtimeChannel | null = null;
  private callType: CallType = "voice";
  private startTime: number | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isInitiator = false;

  // ── Callbacks — set these BEFORE calling initiateCall/answerCall ───────────
  onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  onCallEndCb: (() => void) | null = null;
  onCallActiveCb: (() => void) | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * CALLER: create DB row, acquire media, open signaling, send offer.
   * Set onRemoteStreamCb / onCallEndCb BEFORE calling this.
   */
  async initiateCall(
    conversationId: string,
    receiverId: string,
    callType: CallType,
    userId: string
  ): Promise<Call> {
    // Clean up any previous call first
    this.cleanup(false);

    this.isInitiator = true;
    this.callType = callType;

    // 1. Insert call row
    const { data: call, error } = await supabase
      .from("calls")
      .insert({
        conversation_id: conversationId,
        initiator_id: userId,
        receiver_id: receiverId,
        call_type: callType,
        status: "ringing",
      })
      .select("*")
      .single();
    if (error || !call) throw error ?? new Error("Failed to create call");
    this.callId = call.id;

    // 2. Acquire local media
    await this.acquireMedia(callType);

    // 3. Build peer connection BEFORE opening signaling so ontrack is ready
    this.buildPC();

    // 4. Open signaling channel and wait until SUBSCRIBED
    await this.openSignaling(call.id);

    // 5. Create and send offer
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === "video",
    });
    await this.pc!.setLocalDescription(offer);
    await this.send({ type: "offer", sdp: offer.sdp! });
    console.log("[CallManager] ✅ Offer sent for call:", call.id);

    return call as Call;
  }

  /**
   * RECEIVER: acquire media, open signaling, build PC, wait for offer.
   * Set onRemoteStreamCb / onCallEndCb BEFORE calling this.
   */
  async answerCall(call: Call, userId: string): Promise<void> {
    // Clean up any previous call first
    this.cleanup(false);

    this.isInitiator = false;
    this.callId = call.id;
    this.callType = call.call_type;

    // 1. Acquire local media
    await this.acquireMedia(call.call_type);

    // 2. Build peer connection BEFORE opening signaling so ontrack is ready
    this.buildPC();

    // 3. Open signaling channel — offer may already be in flight
    await this.openSignaling(call.id);

    // 4. Update DB status
    await supabase
      .from("calls")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", call.id);

    console.log("[CallManager] ✅ Receiver ready, waiting for offer:", call.id);
  }

  async declineCall(callId: string): Promise<void> {
    await supabase
      .from("calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", callId);
    await this.send({ type: "declined" });
    this.cleanup(true);
  }

  async endCall(): Promise<void> {
    const endCb = this.onCallEndCb; // capture before cleanup clears it
    if (this.callId) {
      const duration = this.startTime
        ? Math.floor((Date.now() - this.startTime) / 1000)
        : 0;
      await supabase
        .from("calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", this.callId);
    }
    await this.send({ type: "end" });
    this.cleanup(true);
    endCb?.(); // fire AFTER cleanup
  }

  toggleAudio(muted: boolean) {
    // muted=true means user wants to mute → disable tracks
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  toggleVideo(off: boolean) {
    // off=true means camera off → disable tracks
    this.localStream?.getVideoTracks().forEach(t => { t.enabled = !off; });
  }

  getLocalStream() { return this.localStream; }
  getCallType() { return this.callType; }
  getCallId() { return this.callId; }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async acquireMedia(callType: CallType) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
        callType === "video"
          ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } }
          : { audio: true, video: false }
      );
      console.log("[CallManager] Local media:", this.localStream.getTracks().map(t => `${t.kind}(${t.label})`));
    } catch (err) {
      console.error("[CallManager] Media error:", err);
      throw new Error("Could not access camera/microphone. Please allow permissions and try again.");
    }
  }

  /** Open broadcast channel, wait until SUBSCRIBED */
  private openSignaling(callId: string): Promise<void> {
    return new Promise((resolve) => {
      const ch = supabase.channel(`call-signal:${callId}`, {
        config: { broadcast: { ack: false, self: false } },
      });
      this.channel = ch;

      ch.on("broadcast", { event: "signal" }, ({ payload }) => {
        console.log("[CallManager] Signal received:", payload.type);
        void this.handleSignal(payload as SignalMsg);
      });

      ch.subscribe((status) => {
        console.log("[CallManager] Signaling channel:", status);
        if (status === "SUBSCRIBED") resolve();
      });
    });
  }

  private buildPC() {
    const pc = new RTCPeerConnection(rtcConfig);
    this.pc = pc;

    // Add local tracks to the connection
    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
      console.log("[CallManager] Added local track:", track.kind);
    });

    // Remote stream — fires when the other side's tracks arrive
    pc.ontrack = (e) => {
      console.log("[CallManager] Remote track received:", e.track.kind, "streams:", e.streams.length);
      const stream = e.streams[0];
      if (stream) {
        console.log("[CallManager] Firing onRemoteStreamCb");
        this.onRemoteStreamCb?.(stream);
      }
    };

    // ICE candidates — send to peer
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("[CallManager] ICE candidate:", e.candidate.type);
        void this.send({
          type: "ice",
          candidate: e.candidate.candidate,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
          sdpMid: e.candidate.sdpMid,
        });
      } else {
        console.log("[CallManager] ICE gathering complete");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[CallManager] Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (!this.startTime) this.startTime = Date.now();
        this.onCallActiveCb?.();
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        console.warn("[CallManager] Connection lost");
        void this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[CallManager] ICE connection state:", pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("[CallManager] Signaling state:", pc.signalingState);
    };
  }

  private async handleSignal(msg: SignalMsg) {
    const pc = this.pc;
    if (!pc) {
      console.warn("[CallManager] handleSignal: no peer connection");
      return;
    }

    try {
      if (msg.type === "offer") {
        console.log("[CallManager] Handling offer, signalingState:", pc.signalingState);
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.sdp }));
        await this.flushPendingCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.send({ type: "answer", sdp: answer.sdp! });
        console.log("[CallManager] ✅ Answer sent");

      } else if (msg.type === "answer") {
        console.log("[CallManager] Handling answer, signalingState:", pc.signalingState);
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.sdp }));
          await this.flushPendingCandidates();
          if (!this.startTime) this.startTime = Date.now();
          console.log("[CallManager] ✅ Remote description set from answer");
        } else {
          console.warn("[CallManager] Ignoring answer in state:", pc.signalingState);
        }

      } else if (msg.type === "ice") {
        const init: RTCIceCandidateInit = {
          candidate: msg.candidate,
          sdpMLineIndex: msg.sdpMLineIndex,
          sdpMid: msg.sdpMid,
        };
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(init));
          } catch (e) {
            console.warn("[CallManager] ICE add failed:", e);
          }
        } else {
          console.log("[CallManager] Queuing ICE candidate");
          this.pendingCandidates.push(init);
        }

      } else if (msg.type === "end" || msg.type === "declined") {
        console.log("[CallManager] Peer ended/declined call");
        const endCb = this.onCallEndCb;
        this.cleanup(true);
        endCb?.();
      }
    } catch (err) {
      console.error("[CallManager] handleSignal error:", err);
    }
  }

  private async flushPendingCandidates() {
    console.log("[CallManager] Flushing", this.pendingCandidates.length, "pending ICE candidates");
    for (const c of this.pendingCandidates) {
      try {
        await this.pc?.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn("[CallManager] Pending ICE add failed:", e);
      }
    }
    this.pendingCandidates = [];
  }

  private async send(msg: SignalMsg) {
    if (!this.channel) {
      console.warn("[CallManager] send: no channel");
      return;
    }
    try {
      await this.channel.send({ type: "broadcast", event: "signal", payload: msg });
      console.log("[CallManager] Sent:", msg.type);
    } catch (e) {
      console.error("[CallManager] Send failed:", e);
    }
  }

  /** cleanup — pass fireCallback=false when you want to fire it yourself */
  cleanup(fireCallback = false) {
    console.log("[CallManager] Cleanup");
    const endCb = fireCallback ? null : undefined; // don't fire here if caller handles it

    this.localStream?.getTracks().forEach(t => {
      t.stop();
      console.log("[CallManager] Stopped track:", t.kind);
    });
    this.localStream = null;

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.callId = null;
    this.startTime = null;
    this.pendingCandidates = [];
    this.isInitiator = false;
    // Keep callbacks — they are managed by the UI layer
  }
}

export const callManager = new CallManager();
