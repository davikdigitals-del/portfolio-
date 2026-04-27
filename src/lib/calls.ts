/**
 * CallManager — WebRTC with MDN Perfect Negotiation Pattern
 *
 * Key insight: Both peers run IDENTICAL code. The "polite" peer
 * (receiver/answerer) yields on collision; the "impolite" peer (initiator)
 * wins. This eliminates ALL race conditions in offer/answer exchange.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
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

// ── ICE servers ───────────────────────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  // Free TURN relay — handles symmetric NAT (mobile networks)
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

// ── Signal message types ──────────────────────────────────────────────────────
type SigMsg =
  | { type: "description"; description: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit | null }
  | { type: "end" }
  | { type: "declined" };

// ── CallManager ───────────────────────────────────────────────────────────────
export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private callId: string | null = null;
  private callType: CallType = "voice";
  private startTime: number | null = null;

  // Perfect negotiation state
  private polite = false;          // receiver is polite, initiator is impolite
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private conversationId: string | null = null;
  private initiatorId: string | null = null;

  // ── Public callbacks — set BEFORE calling initiateCall / answerCall ─────────
  onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  onCallEndCb: (() => void) | null = null;
  onCallActiveCb: (() => void) | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * CALLER (impolite peer): insert DB row, acquire media, open signaling.
   * Negotiation starts automatically via onnegotiationneeded.
   */
  async initiateCall(
    conversationId: string,
    receiverId: string,
    callType: CallType,
    userId: string
  ): Promise<Call> {
    this.cleanup(false);
    this.polite = false; // initiator = impolite
    this.callType = callType;

    // 1. Create call row in DB
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
    this.conversationId = conversationId;
    this.initiatorId = userId;

    // 2. Acquire media
    await this.acquireMedia(callType);

    // 3. Open signaling channel (wait for SUBSCRIBED)
    await this.openSignaling(call.id);

    // 4. Build peer connection — onnegotiationneeded fires automatically
    //    and sends the offer once tracks are added
    this.buildPC();

    console.log("[CallManager] ✅ Initiator ready, offer will be sent via onnegotiationneeded");
    return call as Call;
  }

  /**
   * RECEIVER (polite peer): acquire media, open signaling, build PC.
   * Will receive offer via signaling and auto-answer.
   */
  async answerCall(call: Call, userId: string): Promise<void> {
    this.cleanup(false);
    this.polite = true; // receiver = polite
    this.callId = call.id;
    this.callType = call.call_type;

    // 1. Acquire media
    await this.acquireMedia(call.call_type);

    // 2. Open signaling channel
    await this.openSignaling(call.id);

    // 3. Build peer connection — will handle incoming offer automatically
    this.buildPC();

    // 4. Update DB status
    await supabase
      .from("calls")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", call.id);

    console.log("[CallManager] ✅ Receiver ready, waiting for offer");
  }

  async declineCall(callId: string): Promise<void> {
    await supabase
      .from("calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", callId);
    await this.sendSignal({ type: "declined" });
    this.cleanup(false);
  }

  async endCall(): Promise<void> {
    const endCb = this.onCallEndCb; // capture before cleanup
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

      // Insert call message into conversation (like WhatsApp)
      await this.insertCallMessage("ended", duration);
    }
    await this.sendSignal({ type: "end" });
    this.cleanup(false);
    endCb?.();
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

  // ── Private: insert call event as chat message (like WhatsApp) ─────────────

  async insertCallMessage(status: "ended" | "missed" | "declined", durationSeconds = 0) {
    if (!this.conversationId || !this.initiatorId) return;
    try {
      await supabase.from("messages").insert({
        conversation_id: this.conversationId,
        sender_id: this.initiatorId,
        content: this.formatCallContent(status, durationSeconds),
        type: "call",
        call_data: {
          call_type: this.callType,
          status,
          duration_seconds: durationSeconds,
        },
      });
    } catch (e) {
      console.error("[CallManager] Failed to insert call message:", e);
    }
  }

  private formatCallContent(status: "ended" | "missed" | "declined", duration: number): string {
    const typeLabel = this.callType === "video" ? "Video call" : "Voice call";
    if (status === "missed") return `📵 Missed ${typeLabel.toLowerCase()}`;
    if (status === "declined") return `❌ ${typeLabel} declined`;
    if (duration > 0) {
      const m = Math.floor(duration / 60);
      const s = duration % 60;
      const dur = m > 0 ? `${m}m ${s}s` : `${s}s`;
      return `${this.callType === "video" ? "📹" : "📞"} ${typeLabel} · ${dur}`;
    }
    return `${this.callType === "video" ? "📹" : "📞"} ${typeLabel}`;
  }

  // ── Private: media ──────────────────────────────────────────────────────────

  private async acquireMedia(callType: CallType) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
        callType === "video"
          ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } }
          : { audio: true, video: false }
      );
      console.log("[CallManager] Media acquired:", this.localStream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error("[CallManager] Media error:", err);
      throw new Error("Could not access camera/microphone. Please allow permissions and try again.");
    }
  }

  // ── Private: signaling ──────────────────────────────────────────────────────

  private openSignaling(callId: string): Promise<void> {
    return new Promise((resolve) => {
      const ch = supabase.channel(`call-signal:${callId}`, {
        config: { broadcast: { ack: false, self: false } },
      });
      this.channel = ch;

      ch.on("broadcast", { event: "sig" }, ({ payload }) => {
        void this.handleSignal(payload as SigMsg);
      });

      ch.subscribe((status) => {
        console.log("[CallManager] Signaling channel:", status);
        if (status === "SUBSCRIBED") resolve();
      });
    });
  }

  private async sendSignal(msg: SigMsg): Promise<void> {
    if (!this.channel) return;
    try {
      await this.channel.send({ type: "broadcast", event: "sig", payload: msg });
    } catch (e) {
      console.error("[CallManager] Send failed:", e);
    }
  }

  // ── Private: peer connection with Perfect Negotiation ──────────────────────

  private buildPC() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    this.pc = pc;

    // Add local tracks
    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    // Remote stream — use track.onunmute like MDN recommends
    pc.ontrack = ({ track, streams }) => {
      console.log("[CallManager] Remote track:", track.kind);
      track.onunmute = () => {
        const stream = streams[0];
        if (stream) {
          console.log("[CallManager] Remote stream unmuted, firing callback");
          this.onRemoteStreamCb?.(stream);
        }
      };
      // Also fire immediately in case already unmuted
      if (streams[0]) {
        this.onRemoteStreamCb?.(streams[0]);
      }
    };

    // ── Perfect Negotiation: onnegotiationneeded ──────────────────────────────
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription(); // auto-creates offer
        await this.sendSignal({ type: "description", description: pc.localDescription! });
        console.log("[CallManager] Offer sent via onnegotiationneeded");
      } catch (err) {
        console.error("[CallManager] onnegotiationneeded error:", err);
      } finally {
        this.makingOffer = false;
      }
    };

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      void this.sendSignal({ type: "candidate", candidate: candidate?.toJSON() ?? null });
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log("[CallManager] Connection:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (!this.startTime) this.startTime = Date.now();
        this.onCallActiveCb?.();
      } else if (pc.connectionState === "failed") {
        console.warn("[CallManager] Connection failed, ending call");
        void this.endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[CallManager] ICE:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected") {
        // Give it 5s to recover before ending
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            void this.endCall();
          }
        }, 5000);
      }
    };
  }

  // ── Perfect Negotiation: handle incoming signals ──────────────────────────

  private async handleSignal(msg: SigMsg): Promise<void> {
    const pc = this.pc;
    if (!pc) return;

    try {
      if (msg.type === "description") {
        const description = msg.description;
        const readyForOffer =
          !this.makingOffer &&
          (pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
        const offerCollision = description.type === "offer" && !readyForOffer;

        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) {
          console.log("[CallManager] Impolite peer ignoring colliding offer");
          return;
        }

        this.isSettingRemoteAnswerPending = description.type === "answer";
        await pc.setRemoteDescription(description);
        this.isSettingRemoteAnswerPending = false;

        if (description.type === "offer") {
          await pc.setLocalDescription(); // auto-creates answer
          await this.sendSignal({ type: "description", description: pc.localDescription! });
          console.log("[CallManager] Answer sent");
        } else {
          console.log("[CallManager] Answer received, connection establishing");
          if (!this.startTime) this.startTime = Date.now();
        }

      } else if (msg.type === "candidate") {
        if (msg.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            if (!this.ignoreOffer) {
              console.warn("[CallManager] ICE candidate error:", err);
            }
          }
        }

      } else if (msg.type === "end" || msg.type === "declined") {
        console.log("[CallManager] Peer ended/declined call");
        const endCb = this.onCallEndCb;
        this.cleanup(false);
        endCb?.();
      }
    } catch (err) {
      console.error("[CallManager] handleSignal error:", err);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  cleanup(clearCallbacks = false) {
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

    if (clearCallbacks) {
      this.onRemoteStreamCb = null;
      this.onCallEndCb = null;
      this.onCallActiveCb = null;
    }
  }
}

export const callManager = new CallManager();
