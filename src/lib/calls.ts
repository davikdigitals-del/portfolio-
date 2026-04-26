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

// WebRTC ICE servers — Google STUN + free TURN relay
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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

  // ── Callbacks ──────────────────────────────────────────────────────────────
  onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  onCallEndCb: (() => void) | null = null;
  onCallActiveCb: (() => void) | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Caller side: create DB record, acquire media, create offer */
  async initiateCall(
    conversationId: string,
    receiverId: string,
    callType: CallType,
    userId: string
  ): Promise<Call> {
    this.isInitiator = true;
    this.callType = callType;

    // 1. Insert call row — this triggers the receiver's realtime listener
    const { data: call, error } = await supabase
      .from("calls")
      .insert({ conversation_id: conversationId, initiator_id: userId, receiver_id: receiverId, call_type: callType, status: "ringing" })
      .select("*")
      .single();
    if (error || !call) throw error ?? new Error("Failed to create call");

    this.callId = call.id;

    // 2. Acquire local media
    await this.acquireMedia(callType);

    // 3. Open signaling channel and wait for it to be SUBSCRIBED before sending offer
    await this.openSignaling(call.id);

    // 4. Build peer connection and create offer
    this.buildPC();

    const offer = await this.pc!.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" });
    await this.pc!.setLocalDescription(offer);

    await this.send({ type: "offer", sdp: offer.sdp! });
    console.log("[CallManager] Offer sent for call:", call.id);

    return call as Call;
  }

  /** Receiver side: acquire media, open signaling, wait for offer */
  async answerCall(call: Call, userId: string): Promise<void> {
    this.isInitiator = false;
    this.callId = call.id;
    this.callType = call.call_type;

    // 1. Acquire local media
    await this.acquireMedia(call.call_type);

    // 2. Open signaling channel — offer may already be waiting
    await this.openSignaling(call.id);

    // 3. Build peer connection (will handle offer when it arrives via signaling)
    this.buildPC();

    // 4. Update call status to active in DB
    await supabase.from("calls").update({ status: "active", started_at: new Date().toISOString() }).eq("id", call.id);

    console.log("[CallManager] Ready to receive offer for call:", call.id);
  }

  async declineCall(callId: string): Promise<void> {
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", callId);
    await this.send({ type: "declined" });
    this.cleanup();
  }

  async endCall(): Promise<void> {
    if (this.callId) {
      const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
      await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString(), duration_seconds: duration }).eq("id", this.callId);
    }
    await this.send({ type: "end" });
    this.cleanup();
    this.onCallEndCb?.();
  }

  toggleAudio(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = enabled; });
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach(t => { t.enabled = enabled; });
  }

  getLocalStream() { return this.localStream; }
  getCallType() { return this.callType; }
  getCallId() { return this.callId; }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async acquireMedia(callType: CallType) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
        callType === "video" ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } } : { audio: true }
      );
      console.log("[CallManager] Local media acquired:", this.localStream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error("[CallManager] Media error:", err);
      throw new Error("Could not access camera/microphone. Please allow permissions and try again.");
    }
  }

  /** Open signaling broadcast channel and wait until SUBSCRIBED */
  private openSignaling(callId: string): Promise<void> {
    return new Promise((resolve) => {
      const ch = supabase.channel(`call-signal:${callId}`, { config: { broadcast: { ack: false } } });
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

    // Add local tracks
    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
      console.log("[CallManager] Added local track:", track.kind);
    });

    // Remote stream
    pc.ontrack = (e) => {
      console.log("[CallManager] Remote track:", e.track.kind);
      if (e.streams[0]) {
        this.onRemoteStreamCb?.(e.streams[0]);
      }
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.send({
          type: "ice",
          candidate: e.candidate.candidate,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
          sdpMid: e.candidate.sdpMid,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[CallManager] Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (!this.startTime) this.startTime = Date.now();
        this.onCallActiveCb?.();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.warn("[CallManager] Connection lost, ending call");
        void this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[CallManager] ICE state:", pc.iceConnectionState);
    };
  }

  private async handleSignal(msg: SignalMsg) {
    const pc = this.pc;
    if (!pc) return;

    if (msg.type === "offer") {
      // Receiver gets offer → set remote desc → create answer
      await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
      await this.flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.send({ type: "answer", sdp: answer.sdp! });
      console.log("[CallManager] Answer sent");

    } else if (msg.type === "answer") {
      // Initiator gets answer → set remote desc
      await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
      await this.flushPendingCandidates();
      if (!this.startTime) this.startTime = Date.now();

    } else if (msg.type === "ice") {
      const init: RTCIceCandidateInit = { candidate: msg.candidate, sdpMLineIndex: msg.sdpMLineIndex, sdpMid: msg.sdpMid };
      if (pc.remoteDescription) {
        try { await pc.addIceCandidate(init); } catch (e) { console.warn("[CallManager] ICE add failed:", e); }
      } else {
        this.pendingCandidates.push(init);
      }

    } else if (msg.type === "end" || msg.type === "declined") {
      this.cleanup();
      this.onCallEndCb?.();
    }
  }

  private async flushPendingCandidates() {
    for (const c of this.pendingCandidates) {
      try { await this.pc?.addIceCandidate(c); } catch { /* ignore */ }
    }
    this.pendingCandidates = [];
  }

  private async send(msg: SignalMsg) {
    if (!this.channel) return;
    try {
      await this.channel.send({ type: "broadcast", event: "signal", payload: msg });
    } catch (e) {
      console.error("[CallManager] Send failed:", e);
    }
  }

  cleanup() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.pc?.close();
    this.pc = null;
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.callId = null;
    this.startTime = null;
    this.pendingCandidates = [];
    this.isInitiator = false;
  }
}

export const callManager = new CallManager();
