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

// WebRTC configuration with multiple STUN servers
const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:stun1.l.google.com:19302"] },
    { urls: ["stun:stun2.l.google.com:19302"] },
    { urls: ["stun:stun3.l.google.com:19302"] },
    { urls: ["stun:stun4.l.google.com:19302"] },
  ],
};

export class CallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private signalingChannel: RealtimeChannel | null = null;
  private callType: CallType = "voice";
  private startTime: number | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;

  // Initiate a call
  async initiateCall(
    conversationId: string,
    receiverId: string,
    callType: CallType,
    userId: string
  ): Promise<Call> {
    try {
      // Create call record in database
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

      if (error) throw error;
      if (!call) throw new Error("Failed to create call");

      this.callId = call.id;
      this.callType = callType;

      // Get local media stream
      await this.getLocalStream(callType);

      // Create peer connection
      this.createPeerConnection();

      // Set up signaling channel
      this.setupSignaling(call.id, receiverId);

      // Create and send offer
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      // Send offer through signaling
      await this.sendSignalingMessage(call.id, receiverId, {
        type: "offer",
        offer: offer.sdp,
      });

      return call as Call;
    } catch (err) {
      console.error("Failed to initiate call:", err);
      throw err;
    }
  }

  // Answer an incoming call
  async answerCall(call: Call, userId: string): Promise<void> {
    try {
      this.callId = call.id;
      this.callType = call.call_type;
      this.startTime = Date.now();

      // Get local media stream
      await this.getLocalStream(call.call_type);

      // Create peer connection
      this.createPeerConnection();

      // Set up signaling channel
      this.setupSignaling(call.id, call.initiator_id);

      // Update call status to active
      await supabase
        .from("calls")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", call.id);

      // Send answer ready signal
      await this.sendSignalingMessage(call.id, call.initiator_id, {
        type: "answer-ready",
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
      throw err;
    }
  }

  // Decline an incoming call
  async declineCall(callId: string, receiverId: string): Promise<void> {
    try {
      await supabase
        .from("calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", callId);

      await this.sendSignalingMessage(callId, receiverId, {
        type: "declined",
      });

      this.cleanup();
    } catch (err) {
      console.error("Failed to decline call:", err);
      throw err;
    }
  }

  // End an active call
  async endCall(): Promise<void> {
    try {
      if (this.callId) {
        const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        await supabase
          .from("calls")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
          })
          .eq("id", this.callId);
      }

      this.cleanup();
      if (this.onCallEndCallback) {
        this.onCallEndCallback();
      }
    } catch (err) {
      console.error("Failed to end call:", err);
      throw err;
    }
  }

  // Get local media stream
  private async getLocalStream(callType: CallType): Promise<void> {
    try {
      const constraints =
        callType === "video"
          ? { audio: true, video: { width: 1280, height: 720 } }
          : { audio: true };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error("Failed to get local stream:", err);
      throw err;
    }
  }

  // Create WebRTC peer connection
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(event.track);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callId) {
        this.sendSignalingMessage(this.callId, "", {
          type: "ice-candidate",
          candidate: event.candidate,
        }).catch(err => console.error("Failed to send ICE candidate:", err));
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection?.connectionState);
      if (
        this.peerConnection?.connectionState === "failed" ||
        this.peerConnection?.connectionState === "disconnected"
      ) {
        this.endCall().catch(err => console.error("Failed to end call on disconnect:", err));
      }
    };
  }

  // Set up signaling channel
  private setupSignaling(callId: string, peerId: string): void {
    const channelName = `call:${callId}`;
    this.signalingChannel = supabase.channel(channelName);

    this.signalingChannel
      .on("broadcast", { event: "signal" }, async (payload) => {
        await this.handleSignalingMessage(payload.payload);
      })
      .subscribe();
  }

  // Send signaling message
  private async sendSignalingMessage(
    callId: string,
    peerId: string,
    message: any
  ): Promise<void> {
    if (!this.signalingChannel) return;

    await this.signalingChannel.send({
      type: "broadcast",
      event: "signal",
      payload: { ...message, from: peerId },
    });
  }

  // Handle incoming signaling messages
  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      if (message.type === "offer" && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: message.offer })
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        await this.sendSignalingMessage(this.callId || "", message.from, {
          type: "answer",
          answer: answer.sdp,
        });
      } else if (message.type === "answer" && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: message.answer })
        );
        this.startTime = Date.now();
      } else if (message.type === "ice-candidate" && this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(message.candidate)
          );
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      }
    } catch (err) {
      console.error("Failed to handle signaling message:", err);
    }
  }

  // Clean up resources
  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }

    this.callId = null;
    this.remoteStream = null;
    this.startTime = null;
  }

  // Public getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCallType(): CallType {
    return this.callType;
  }

  // Set callbacks
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onCallEnd(callback: () => void): void {
    this.onCallEndCallback = callback;
  }
}

export const callManager = new CallManager();
