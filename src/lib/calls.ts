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

// WebRTC configuration with STUN and TURN servers for better NAT traversal
const rtcConfig = {
  iceServers: [
    // Google STUN servers
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:stun1.l.google.com:19302"] },
    { urls: ["stun:stun2.l.google.com:19302"] },
    { urls: ["stun:stun3.l.google.com:19302"] },
    { urls: ["stun:stun4.l.google.com:19302"] },
    // Public TURN servers (free tier)
    {
      urls: ["turn:openrelay.metered.ca:80"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: ["turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
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
  private userId: string | null = null;
  private peerId: string | null = null;
  private isInitiator: boolean = false;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onCallEndCallback: (() => void) | null = null;
  private onCallActiveCallback: (() => void) | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];

  // Initiate a call
  async initiateCall(
    conversationId: string,
    receiverId: string,
    callType: CallType,
    userId: string
  ): Promise<Call> {
    try {
      this.userId = userId;
      this.peerId = receiverId;
      this.isInitiator = true;
      this.callType = callType;

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

      // Get local media stream
      await this.acquireLocalStream(callType);

      // Create peer connection
      this.createPeerConnection();

      // Set up signaling channel
      this.setupSignaling(call.id, receiverId);

      // Create and send offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });
      await this.peerConnection!.setLocalDescription(offer);

      console.log("Sending offer for call:", call.id);

      // Send offer through signaling
      await this.sendSignalingMessage({
        type: "offer",
        sdp: offer.sdp,
      });

      return call as Call;
    } catch (err) {
      console.error("Failed to initiate call:", err);
      this.cleanup();
      throw err;
    }
  }

  // Answer an incoming call
  async answerCall(call: Call, userId: string): Promise<void> {
    try {
      this.callId = call.id;
      this.callType = call.call_type;
      this.userId = userId;
      this.peerId = call.initiator_id;
      this.isInitiator = false;

      // Get local media stream
      await this.acquireLocalStream(call.call_type);

      // Create peer connection
      this.createPeerConnection();

      // Set up signaling channel
      this.setupSignaling(call.id, call.initiator_id);

      console.log("Ready to answer call:", call.id);

      // Send answer ready signal
      await this.sendSignalingMessage({
        type: "answer-ready",
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
      this.cleanup();
      throw err;
    }
  }

  // Decline an incoming call
  async declineCall(callId: string): Promise<void> {
    try {
      await supabase
        .from("calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", callId);

      if (this.signalingChannel) {
        await this.sendSignalingMessage({
          type: "declined",
        });
      }

      this.cleanup();
    } catch (err) {
      console.error("Failed to decline call:", err);
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

      if (this.signalingChannel) {
        await this.sendSignalingMessage({
          type: "end-call",
        });
      }

      this.cleanup();
      if (this.onCallEndCallback) {
        this.onCallEndCallback();
      }
    } catch (err) {
      console.error("Failed to end call:", err);
    }
  }

  // Get local media stream
  private async acquireLocalStream(callType: CallType): Promise<void> {
    try {
      const constraints =
        callType === "video"
          ? { audio: true, video: { width: 1280, height: 720 } }
          : { audio: true };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Local stream acquired:", this.localStream?.getTracks().map(t => t.kind));
    } catch (err) {
      console.error("Failed to get local stream:", err);
      throw err;
    }
  }

  // Create WebRTC peer connection
  private createPeerConnection(): void {
    console.log("Creating peer connection with config:", rtcConfig);
    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log("Adding local track:", track.kind);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind, "streams:", event.streams.length);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log("Remote stream set with tracks:", this.remoteStream.getTracks().map(t => t.kind));
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate generated:", event.candidate.candidate.substring(0, 50));
        this.sendSignalingMessage({
          type: "ice-candidate",
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        }).catch(err => console.error("Failed to send ICE candidate:", err));
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === "connected") {
        console.log("Call connected!");
        if (!this.startTime) {
          this.startTime = Date.now();
        }
        if (this.onCallActiveCallback) {
          this.onCallActiveCallback();
        }
      } else if (
        this.peerConnection?.connectionState === "failed" ||
        this.peerConnection?.connectionState === "disconnected"
      ) {
        console.log("Call disconnected, ending call");
        this.endCall().catch(err => console.error("Failed to end call on disconnect:", err));
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", this.peerConnection?.iceConnectionState);
    };

    // Handle signaling state
    this.peerConnection.onsignalingstatechange = () => {
      console.log("Signaling state:", this.peerConnection?.signalingState);
    };
  }

  // Set up signaling channel
  private setupSignaling(callId: string, peerId: string): void {
    const channelName = `call:${callId}`;
    console.log("Setting up signaling channel:", channelName);
    this.signalingChannel = supabase.channel(channelName);

    this.signalingChannel
      .on("broadcast", { event: "signal" }, async (payload) => {
        console.log("Received signaling message:", payload.payload.type);
        await this.handleSignalingMessage(payload.payload);
      })
      .subscribe((status) => {
        console.log("Signaling channel subscription status:", status);
      });
  }

  // Send signaling message
  private async sendSignalingMessage(message: any): Promise<void> {
    if (!this.signalingChannel) {
      console.error("Signaling channel not initialized");
      return;
    }

    try {
      await this.signalingChannel.send({
        type: "broadcast",
        event: "signal",
        payload: message,
      });
      console.log("Sent signaling message:", message.type);
    } catch (err) {
      console.error("Failed to send signaling message:", err);
    }
  }

  // Handle incoming signaling messages
  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      console.log("Handling signaling message:", message.type);

      if (message.type === "offer" && this.peerConnection) {
        console.log("Received offer, setting remote description");
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: message.sdp })
        );

        // Add any pending candidates
        for (const candidate of this.pendingCandidates) {
          try {
            await this.peerConnection.addIceCandidate(candidate);
          } catch (err) {
            console.error("Failed to add pending ICE candidate:", err);
          }
        }
        this.pendingCandidates = [];

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        console.log("Sending answer");
        await this.sendSignalingMessage({
          type: "answer",
          sdp: answer.sdp,
        });
      } else if (message.type === "answer" && this.peerConnection) {
        console.log("Received answer, setting remote description");
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: message.sdp })
        );

        // Add any pending candidates
        for (const candidate of this.pendingCandidates) {
          try {
            await this.peerConnection.addIceCandidate(candidate);
          } catch (err) {
            console.error("Failed to add pending ICE candidate:", err);
          }
        }
        this.pendingCandidates = [];

        if (!this.startTime) {
          this.startTime = Date.now();
        }
      } else if (message.type === "ice-candidate" && this.peerConnection) {
        try {
          const candidate = new RTCIceCandidate({
            candidate: message.candidate,
            sdpMLineIndex: message.sdpMLineIndex,
            sdpMid: message.sdpMid,
          });

          if (this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(candidate);
          } else {
            // Queue candidate if remote description not set yet
            this.pendingCandidates.push(candidate);
          }
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      } else if (message.type === "end-call") {
        console.log("Peer ended call");
        this.cleanup();
        if (this.onCallEndCallback) {
          this.onCallEndCallback();
        }
      }
    } catch (err) {
      console.error("Failed to handle signaling message:", err);
    }
  }

  // Clean up resources
  private cleanup(): void {
    console.log("Cleaning up call resources");

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log("Stopping local track:", track.kind);
        track.stop();
      });
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
    this.pendingCandidates = [];
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

  onCallActive(callback: () => void): void {
    this.onCallActiveCallback = callback;
  }

  // Toggle audio
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // Toggle video
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
}

export const callManager = new CallManager();
