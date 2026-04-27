/**
 * CallManager — WebRTC with MDN Perfect Negotiation Pattern
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
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
  | { type: "description"; description: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit | null }
  | { type: "end" }
  | { type: "declined" };

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private callId: string | null = null;
  private callType: CallType = "voice";
  private startTime: number | null = null;
  private polite = false;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private conversationId: string | null = null;
  private initiatorId: string | null = null;

  // Callbacks — set BEFORE calling initiateCall / answerCall
  onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  onCallEndCb: (() => void) | null = null;
  onCallActiveCb: (() => void) | null = null;

  async initiateCall(conversationId: string, receiverId: string, callType: CallType, userId: string): Promise<Call> {
    this.cleanup();
    this.polite = false;
    this.callType = callType;
    this.conversationId = conversationId;
    this.initiatorId = userId;

    const { data: call, error } = await supabase
      .from("calls")
      .insert({ conversation_id: conversationId, initiator_id: userId, receiver_id: receiverId, call_type: callType, status: "ringing" })
      .select("*").single();
    if (error || !call) throw error ?? new Error("Failed to create call");
    this.callId = call.id;

    await this.acquireMedia(callType);
    await this.openSignaling(call.id);
    this.buildPC();

    return call as Call;
  }

  async answerCall(call: Call, userId: string): Promise<void> {
    this.cleanup();
    this.polite = true;
    this.callId = call.id;
    this.callType = call.call_type;
    this.conversationId = call.conversation_id;
    this.initiatorId = call.initiator_id;

    await this.acquireMedia(call.call_type);
    await this.openSignaling(call.id);
    this.buildPC();

    await supabase.from("calls").update({ status: "active", started_at: new Date().toISOString() }).eq("id", call.id);
  }

  async declineCall(callId: string): Promise<void> {
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", callId);
    // Send signal BEFORE cleanup so channel is still open
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
    // Send signal BEFORE cleanup so channel is still open
    await this.sendSignal({ type: "end" });
    this.cleanup();
    endCb?.(); // fire AFTER cleanup
  }

  toggleAudio(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  toggleVideo(off: boolean) {
    this.localStream?.getVideoTracks().forEach(t => { t.enabled = !off; });
  }

  getLocalStream() { return this.localStream; }
  getCallType() { return this.callType; }
  getCallId() { return this.callId; }
  getPeerConnection() { return this.pc; }

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

  private async sendSignal(msg: SigMsg): Promise<void> {
    if (!this.channel) return;
    try {
      await this.channel.send({ type: "broadcast", event: "sig", payload: msg });
      console.log("[CM] Sent:", msg.type);
    } catch (e) {
      console.error("[CM] Send failed:", e);
    }
  }

  private buildPC() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    this.pc = pc;

    this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

    // Remote stream — fire callback immediately AND on unmute
    pc.ontrack = ({ track, streams }) => {
      console.log("[CM] Remote track:", track.kind, "streams:", streams.length);
      const stream = streams[0];
      if (!stream) return;

      // Fire immediately (track may already be active)
      this.onRemoteStreamCb?.(stream);

      // Also fire on unmute (some browsers mute tracks initially)
      track.onunmute = () => {
        console.log("[CM] Track unmuted:", track.kind);
        this.onRemoteStreamCb?.(stream);
      };
    };

    // Perfect Negotiation
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        await this.sendSignal({ type: "description", description: pc.localDescription! });
        console.log("[CM] Offer sent");
      } catch (err) {
        console.error("[CM] onnegotiationneeded error:", err);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      void this.sendSignal({ type: "candidate", candidate: candidate?.toJSON() ?? null });
    };

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
      if (msg.type === "description") {
        const desc = msg.description;
        const readyForOffer = !this.makingOffer && (pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
        const collision = desc.type === "offer" && !readyForOffer;
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;

        this.isSettingRemoteAnswerPending = desc.type === "answer";
        await pc.setRemoteDescription(desc);
        this.isSettingRemoteAnswerPending = false;

        if (desc.type === "offer") {
          await pc.setLocalDescription();
          await this.sendSignal({ type: "description", description: pc.localDescription! });
          console.log("[CM] Answer sent");
        } else {
          if (!this.startTime) this.startTime = Date.now();
        }
      } else if (msg.type === "candidate" && msg.candidate) {
        try { await pc.addIceCandidate(msg.candidate); } catch (e) { if (!this.ignoreOffer) console.warn("[CM] ICE error:", e); }
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

  private async insertCallMessage(status: "ended" | "missed" | "declined", durationSeconds = 0) {
    if (!this.conversationId || !this.initiatorId) return;
    const typeLabel = this.callType === "video" ? "Video call" : "Voice call";
    let content = `${this.callType === "video" ? "📹" : "📞"} ${typeLabel}`;
    if (status === "missed") content = `📵 Missed ${typeLabel.toLowerCase()}`;
    else if (status === "declined") content = `❌ ${typeLabel} declined`;
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
      this.pc.onnegotiationneeded = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.callId = null;
    this.startTime = null;
    this.conversationId = null;
    this.initiatorId = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    // Keep callbacks — UI manages them
  }
}

export const callManager = new CallManager();
