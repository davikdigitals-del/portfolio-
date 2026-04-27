import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  Loader2, MessageCircle, Home, Users, Settings,
  FileText, LogOut, CheckSquare, ShieldCheck, Menu, X, Phone, Video, PhoneOff,
  MicOff, Mic, VideoOff, Minimize2, Maximize2, SpeakerIcon, Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/notifications";
import { callManager, type Call } from "@/lib/calls";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: DashboardLayout,
});

// ── Presence: runs on every dashboard page ───────────────────────────────────
function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    async function setOnline() {
      await supabase
        .from("profiles")
        .update({ status: "online", last_seen: new Date().toISOString() })
        .eq("user_id", userId);
    }

    async function setOffline() {
      const now = new Date().toISOString();
      // sendBeacon fires even when tab is being destroyed
      // Must include apikey header — use a FormData workaround since sendBeacon
      // doesn't support custom headers. Fall back to fetch with keepalive.
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ status: "offline", last_seen: now }),
            keepalive: true, // fires even when page is unloading
          }
        );
      } catch { /* ignore — page may be closing */ }
      // Also try via supabase client as backup
      try {
        await supabase
          .from("profiles")
          .update({ status: "offline", last_seen: now })
          .eq("user_id", userId);
      } catch { /* ignore */ }
    }

    void setOnline();
    const heartbeat = setInterval(() => void setOnline(), 10_000); // Update every 10 seconds instead of 20

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void setOffline();
      else void setOnline();
    };
    const onPageHide = (e: PageTransitionEvent) => { if (!e.persisted) void setOffline(); };
    const onUnload = () => void setOffline();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onUnload);
      void setOffline();
    };
  }, [userId]);
}

// ── Real viewport height — accounts for mobile browser chrome & keyboard ─────
function useViewportHeight() {
  useEffect(() => {
    function update() {
      // visualViewport is the visible area excluding keyboard
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}

function DashboardLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const routerState = useRouterState();

  // ── Call state (global — works from any page) ──────────────────────────────
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [incomingProfile, setIncomingProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [activeProfile, setActiveProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callMinimized, setCallMinimized] = useState(false);
  const [isAppHidden, setIsAppHidden] = useState(false);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<any>(null);

  usePresence(user?.id);
  useViewportHeight();

  // ── Track app visibility for video blur effect ─────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Ringtone helpers (defined first so useEffects below can use them) ──────
  const startRingtone = useCallback(() => {
    // Stop any existing ringtone first
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    try {
      const ctx = new AudioContext();
      let playing = true;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      function ring() {
        if (!playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
        timeoutId = setTimeout(() => { if (playing) ring(); }, 1500);
      }
      ring();
      ringtoneRef.current = {
        stop: () => {
          playing = false;
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          ctx.close().catch(() => {});
        }
      };
    } catch { /* ignore */ }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      try { ringtoneRef.current.stop(); } catch { /* ignore */ }
      ringtoneRef.current = null;
    }
  }, []);

  // ── Handle push notification tap: ?conv=...&call=... ──────────────────────
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const callId = params.get("call");
    const convId = params.get("conv");
    if (!callId || !convId) return;
    window.history.replaceState({}, "", window.location.pathname);
    // Store as pending — the expose useEffect will pick it up after handlers are set
    supabase.from("calls").select("*").eq("id", callId).maybeSingle().then(({ data: call }) => {
      if (!call) return;
      (window as any).__pendingCall = call;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Global incoming call listener ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    console.log("[CallListener] Subscribing for user:", user.id);

    const ch = supabase.channel(`global-calls-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "calls",
        filter: `receiver_id=eq.${user.id}`,
      }, async (payload) => {
        const call = payload.new as Call;
        console.log("[CallListener] Incoming call:", call);

        if (call.status !== "ringing") return;

        // Fetch caller profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", call.initiator_id)
          .maybeSingle();

        setIncomingCall(call);
        setIncomingProfile(profile ?? null);
        startRingtone();

        // Vibrate aggressively
        if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);

        // In-app notification (foreground/backgrounded tab)
        void sendPushNotification(
          call.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call",
          `${profile?.display_name ?? "Someone"} is calling...`,
          { tag: `call-${call.id}`, requireInteraction: true }
        );

        // Clear any existing missed timer before setting a new one
        if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
        missedTimerRef.current = setTimeout(async () => {
          await supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", call.id).eq("status", "ringing");
          // Insert missed call message in chat
          await supabase.from("messages").insert({
            conversation_id: call.conversation_id,
            sender_id: call.initiator_id,
            content: call.call_type === "video" ? "📵 Missed video call" : "📵 Missed voice call",
            type: "call",
            call_data: { call_type: call.call_type, status: "missed", duration_seconds: 0 },
          }).catch(() => {});
          setIncomingCall(null);
          setIncomingProfile(null);
          stopRingtone();
          void sendPushNotification("📞 Missed Call", `Missed ${call.call_type} call from ${profile?.display_name ?? "someone"}`, { tag: `missed-${call.id}` });
        }, 30_000);
      })
      // Also listen for call status changes (e.g. caller cancelled)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "calls",
      }, (payload) => {
        const call = payload.new as Call;
        // If the incoming call was cancelled/ended by caller before we answered
        if (incomingCall && call.id === incomingCall.id && (call.status === "ended" || call.status === "declined" || call.status === "missed")) {
          setIncomingCall(null);
          setIncomingProfile(null);
          stopRingtone();
          if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
        }
      })
      .subscribe((status) => {
        console.log("[CallListener] Channel status:", status);
      });

    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Answer call ────────────────────────────────────────────────────────────
  const answerCall = useCallback(async (call: Call) => {
    if (!user) return;

    // Stop ringtone and clear missed timer IMMEDIATELY (synchronous)
    stopRingtone();
    if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
    setIncomingCall(null);
    setIncomingProfile(null);

    try {
      const { data: profile } = await supabase
        .from("profiles").select("display_name, avatar_url")
        .eq("user_id", call.initiator_id).maybeSingle();

      setActiveCall(call);
      setActiveProfile(profile ?? incomingProfile);
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoOff(false);
      setCallMinimized(false);
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      // Timer starts when connection is actually established (onCallActiveCb)

      // Set callbacks BEFORE answerCall so ontrack fires correctly
      callManager.onRemoteStreamCb = (stream) => {
        console.log("[Dashboard] Remote stream, tracks:", stream.getTracks().map(t => t.kind));
        if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = stream; remoteAudioRef.current.play().catch(() => {}); }
        if (call.call_type === "video" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.style.display = "block";
          remoteVideoRef.current.play().catch(() => {});
        }
      };
      callManager.onCallActiveCb = () => {
        // Start timer only when WebRTC connection is actually established
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      };
      callManager.onCallEndCb = () => {
        setActiveCall(null); setActiveProfile(null);
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        setCallDuration(0); setCallMinimized(false);
        if (remoteVideoRef.current) remoteVideoRef.current.style.display = "none";
      };

      await callManager.answerCall(call, user.id);

      setTimeout(() => {
        if (call.call_type === "video" && localVideoRef.current) {
          const ls = callManager.getLocalStream();
          if (ls) { localVideoRef.current.srcObject = ls; localVideoRef.current.play().catch(() => {}); }
        }
      }, 500);

    } catch (err: any) {
      console.error("[Dashboard] Answer failed:", err);
      setActiveCall(null); setActiveProfile(null);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      alert(err?.message ?? "Failed to answer call");
    }
  }, [user, incomingProfile, stopRingtone]);

  // ── Decline call ───────────────────────────────────────────────────────────
  const declineCall = useCallback(async (call: Call) => {
    try {
      console.log("[Dashboard] Declining call:", call.id);
      stopRingtone();
      if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
      
      // Update database first
      const { error } = await supabase
        .from("calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", call.id);
      
      if (error) {
        console.error("[Dashboard] Error declining call in DB:", error);
      } else {
        console.log("[Dashboard] Call declined in DB successfully");
      }
      
      // Signal the other party via callManager
      await callManager.declineCall(call.id);
      
      // Clear UI state
      setIncomingCall(null);
      setIncomingProfile(null);
      
      console.log("[Dashboard] Call decline complete");
    } catch (err) {
      console.error("[Dashboard] Error in declineCall:", err);
    }
  }, [stopRingtone]);

  // ── End active call ────────────────────────────────────────────────────────
  const endActiveCall = useCallback(async () => {
    try {
      console.log("[Dashboard] Ending active call");
      
      // End call via callManager (handles DB update and signaling)
      await callManager.endCall();
      
      // Clear UI state
      setActiveCall(null);
      setActiveProfile(null);
      if (callTimerRef.current) { 
        clearInterval(callTimerRef.current); 
        callTimerRef.current = null; 
      }
      setCallDuration(0);
      setCallMinimized(false);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsSpeaker(true);
      setFacingMode("user");
      if (remoteVideoRef.current) remoteVideoRef.current.style.display = "none";
      setIsScreenSharing(false);
      
      console.log("[Dashboard] Active call ended successfully");
    } catch (err) {
      console.error("[Dashboard] Error ending active call:", err);
    }
  }, []);
  const flipCamera = useCallback(async () => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    try {
      // Only request video — don't touch the existing audio track
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Replace the video track in the peer connection
      const pc = callManager.getPeerConnection();
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(newVideoTrack);
      }

      // Stop old video track and update local stream
      const localStream = callManager.getLocalStream();
      if (localStream) {
        localStream.getVideoTracks().forEach(t => t.stop());
        // Remove old video tracks and add new one
        const oldTracks = localStream.getVideoTracks();
        oldTracks.forEach(t => localStream.removeTrack(t));
        localStream.addTrack(newVideoTrack);
      }

      // Update local preview
      if (localVideoRef.current) {
        // Create a new stream with the new video + existing audio for preview
        const previewStream = new MediaStream();
        previewStream.addTrack(newVideoTrack);
        localVideoRef.current.srcObject = previewStream;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("[Dashboard] Flip camera failed:", err);
      // If exact facingMode not supported, try without exact
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
        });
        const track = fallbackStream.getVideoTracks()[0];
        const pc = callManager.getPeerConnection();
        if (pc && track) {
          const sender = pc.getSenders().find(s => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(track);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([track]);
          localVideoRef.current.play().catch(() => {});
        }
      } catch { /* device may not support camera flip */ }
    }
  }, [facingMode]);

  // ── Re-attach local video when camera is turned back on ───────────────────
  useEffect(() => {
    if (!activeCall || activeCall.call_type !== "video" || isVideoOff) return;
    // Camera just turned back on — re-attach local stream to preview
    setTimeout(() => {
      if (localVideoRef.current) {
        const ls = callManager.getLocalStream();
        if (ls) { localVideoRef.current.srcObject = ls; localVideoRef.current.play().catch(() => {}); }
      }
    }, 100);
  }, [isVideoOff, activeCall]);
  useEffect(() => {
    (window as any).__answerCall = answerCall;
    (window as any).__setIncomingCall = async (call: Call) => {
      // Clear any existing missed timer before setting a new one
      if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
      stopRingtone(); // stop any existing ringtone first
      const { data: profile } = await supabase
        .from("profiles").select("display_name, avatar_url")
        .eq("user_id", call.initiator_id).maybeSingle();
      setIncomingCall(call);
      setIncomingProfile(profile ?? null);
      startRingtone();
      if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500]);
      missedTimerRef.current = setTimeout(async () => {
        await supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", call.id).eq("status", "ringing");
        await supabase.from("messages").insert({
          conversation_id: call.conversation_id, sender_id: call.initiator_id,
          content: call.call_type === "video" ? "📵 Missed video call" : "📵 Missed voice call",
          type: "call", call_data: { call_type: call.call_type, status: "missed", duration_seconds: 0 },
        }).catch(() => {});
        setIncomingCall(null); setIncomingProfile(null); stopRingtone();
        missedTimerRef.current = null;
      }, 30_000);
    };
    (window as any).__setActiveCall = (call: Call, profile: any) => {
      // Clear existing timers before starting new ones
      stopRingtone();
      if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }

      setActiveCall(call);
      setActiveProfile(profile);
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoOff(false);
      setCallMinimized(false);
      // Don't start timer here — start it when connection is established

      // Set callbacks — callManager.initiateCall already ran so these won't be wiped
      callManager.onRemoteStreamCb = (stream) => {
        console.log("[Dashboard] Remote stream, tracks:", stream.getTracks().map(t => t.kind));
        if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = stream; remoteAudioRef.current.play().catch(() => {}); }
        if (call.call_type === "video" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.style.display = "block";
          remoteVideoRef.current.play().catch(() => {});
        }
      };
      callManager.onCallActiveCb = () => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      };
      callManager.onCallEndCb = () => {
        setActiveCall(null); setActiveProfile(null);
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        setCallDuration(0); setCallMinimized(false);
        if (remoteVideoRef.current) remoteVideoRef.current.style.display = "none";
      };

      // Attach local video for initiator
      setTimeout(() => {
        if (call.call_type === "video" && localVideoRef.current) {
          const ls = callManager.getLocalStream();
          if (ls) { localVideoRef.current.srcObject = ls; localVideoRef.current.play().catch(() => {}); }
        }
      }, 500);
    };
    // Handle pending call from root listener (user was on non-dashboard page)
    // Use a small delay to ensure all handlers are registered
    const pending = (window as any).__pendingCall;
    if (pending) {
      delete (window as any).__pendingCall;
      setTimeout(() => {
        if (pending.status === "ringing") {
          // Show incoming call screen (don't auto-answer)
          const setIncoming = (window as any).__setIncomingCall;
          if (setIncoming) void setIncoming(pending);
        }
        // active calls: JOIN button in chat header handles them
      }, 200);
    }

    return () => {
      delete (window as any).__answerCall;
      delete (window as any).__setIncomingCall;
      delete (window as any).__setActiveCall;
    };
  }, [answerCall, startRingtone, stopRingtone]);

  useEffect(() => { setMobileOpen(false); }, [routerState.location.pathname]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? user.email?.split("@")[0] ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function fetchUnread() {
      if (isAdmin) {
        const { data } = await supabase.from("conversations").select("unread_admin");
        setUnreadCount((data ?? []).reduce((s, c) => s + (c.unread_admin ?? 0), 0));
      } else {
        const { data } = await supabase
          .from("conversations").select("unread_user").eq("user_id", user!.id).maybeSingle();
        setUnreadCount(data?.unread_user ?? 0);
      }
    }
    void fetchUnread();
    const ch = supabase.channel("dashboard-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void fetchUnread())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, isAdmin]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initial = (displayName || user.email || "?")[0].toUpperCase();

  const navItems = isAdmin ? [
    { to: "/dashboard", icon: Home, label: "Overview", exact: true },
    { to: "/dashboard/chat", icon: MessageCircle, label: "Inbox", badge: unreadCount },
    { to: "/dashboard/files", icon: FileText, label: "Files" },
    { to: "/dashboard/users", icon: Users, label: "Clients" },
    { to: "/dashboard/tasks", icon: CheckSquare, label: "Tasks" },
    { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  ] : [
    { to: "/dashboard/chat", icon: MessageCircle, label: "Messages", badge: unreadCount },
  ];

  const SidebarContent = () => (
    <>
      <Link
        to="/"
        className="flex items-center gap-2 px-5 h-14 md:h-16 border-b border-border hover:bg-sidebar-accent transition-colors shrink-0"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-border/60">
          <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
        </div>
        <span className="font-bold">Ajibola.</span>
      </Link>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            exact={item.exact}
            badge={item.badge}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold shrink-0">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName || user.email}</div>
            {isAdmin && (
              <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                <ShieldCheck className="h-3 w-3" /> Admin
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut().then(() => navigate({ to: "/" }))}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </>
  );

  // ── Format call duration ───────────────────────────────────────────────────
  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex bg-background overflow-hidden" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed left-0 right-0 top-0 z-40 bg-sidebar border-b border-border flex items-center justify-between px-4 h-14"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden border border-border/60">
            <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
          </div>
          <span className="font-bold text-sm">Ajibola.</span>
        </Link>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
              {unreadCount}
            </span>
          )}
          <button onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)} />}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-40 w-72 flex flex-col bg-sidebar border-r border-border transform transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 md:pt-0 pt-14">
        <Outlet />
      </main>

      {/* Always-mounted media elements — must exist even when call is minimized */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
      <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none", position: "absolute", width: 0, height: 0 }} />

      {/* ── INCOMING CALL SCREEN ─────────────────────────────────────────── */}
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "linear-gradient(180deg, #1a237e 0%, #111827 100%)" }}>
          <div className="pt-16 pb-4 text-center">
            <p className="text-white/60 text-sm font-medium tracking-widest uppercase">
              {incomingCall.call_type === "video" ? "Incoming Video Call" : "Incoming Voice Call"}
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-56 w-56 rounded-full bg-white/5 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute h-44 w-44 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
              {incomingProfile?.avatar_url ? (
                <img src={incomingProfile.avatar_url} alt="Caller" className="h-36 w-36 rounded-full object-cover ring-4 ring-white/40 shadow-2xl relative z-10" />
              ) : (
                <div className="h-36 w-36 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-6xl font-bold ring-4 ring-white/40 shadow-2xl relative z-10">
                  {(incomingProfile?.display_name?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-white text-4xl font-bold">{incomingProfile?.display_name ?? (isAdmin ? "Client" : "Ajibola")}</h1>
              <p className="text-white/50 text-base mt-2">
                {incomingCall.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call"}
              </p>
            </div>
          </div>
          <div className="pb-20 flex justify-center gap-20">
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => declineCall(incomingCall)} className="h-20 w-20 rounded-full bg-red-500 flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                <PhoneOff className="h-9 w-9 text-white" />
              </button>
              <span className="text-white/70 text-sm">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => answerCall(incomingCall)} className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center shadow-2xl active:scale-90 transition-transform animate-bounce">
                <Phone className="h-9 w-9 text-white" />
              </button>
              <span className="text-white/70 text-sm">Answer</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL — MINIMIZED BAR (WhatsApp style top bar) ─────────── */}
      {activeCall && callMinimized && (
        <div
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center gap-3 px-4 py-2 cursor-pointer"
          style={{ background: "linear-gradient(90deg, #16a34a, #15803d)", paddingTop: "max(0.5rem, env(safe-area-inset-top, 0.5rem))" }}
          onClick={() => setCallMinimized(false)}
        >
          {/* Pulsing dot */}
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-white text-sm font-semibold truncate">
              {activeCall.call_type === "video" ? "📹 " : "☎️ "}{activeProfile?.display_name ?? "On a call"}
            </span>
            <span className="text-white/80 text-xs ml-2 font-mono">{fmtDuration(callDuration)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); const next = !isMuted; callManager.toggleAudio(next); setIsMuted(next); }}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-white/30" : "bg-white/10"}`}
            >
              {isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void endActiveCall(); }}
              className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center"
            >
              <PhoneOff className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL — FULLSCREEN (WhatsApp style) ────────────────────── */}
      {activeCall && !callMinimized && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Remote video fills screen (video call) — uses always-mounted ref */}
          {activeCall.call_type === "video" && (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" style={{ display: "block" }} />
          )}

          {/* Voice call background */}
          {activeCall.call_type === "voice" && (
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }} />
          )}

          {/* Top bar: minimize button + name + timer */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-12 pb-4"
            style={{ background: activeCall.call_type === "video" ? "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" : "transparent" }}
          >
            {/* Minimize — go back to app, call continues */}
            <button
              onClick={() => setCallMinimized(true)}
              className="h-9 w-9 rounded-full bg-black/30 flex items-center justify-center active:scale-90 transition-transform"
              title="Minimize call"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-white text-lg font-bold leading-tight">{activeProfile?.display_name ?? "Calling..."}</h1>
              <p className="text-green-400 text-sm font-mono">{fmtDuration(callDuration)}</p>
            </div>
          </div>

          {/* Voice call: avatar center */}
          {activeCall.call_type === "voice" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              {activeProfile?.avatar_url ? (
                <img src={activeProfile.avatar_url} alt="Call" className="h-32 w-32 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
              ) : (
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-5xl font-bold ring-4 ring-white/20 shadow-2xl">
                  {(activeProfile?.display_name?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Local video preview — always render video element, just hide/style it */}
          {activeCall.call_type === "video" && (
            <div className="absolute bottom-32 right-4 w-28 h-40 rounded-2xl border-2 border-white/40 shadow-xl z-10 overflow-hidden">

              {/* Always-mounted local video — hidden when camera off */}
              <video
                ref={localVideoRef}
                autoPlay playsInline muted
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isVideoOff ? "hidden" : isAppHidden ? "blur-lg scale-110" : ""
                }`}
              />

              {/* Camera OFF overlay — gradient + avatar */}
              {isVideoOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  style={{ background: "linear-gradient(180deg, #1a237e 0%, #111827 100%)" }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="You" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/40" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold ring-2 ring-white/40">
                      {(displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <span className="text-white/60 text-[10px]">Camera off</span>
                </div>
              )}

              {/* App HIDDEN overlay — blur + pause icon */}
              {!isVideoOff && isAppHidden && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <Pause className="h-6 w-6 text-white" />
                    <span className="text-white/80 text-[10px]">Paused</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Controls — floating island at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-10 pt-6"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
          >
            <div className="flex items-center justify-center gap-5">

              {/* Mute / Unmute */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = !isMuted;
                    callManager.toggleAudio(next); // true = muted = disable tracks
                    setIsMuted(next);
                  }}
                  className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isMuted ? "bg-white text-black" : "bg-white/20 text-white"}`}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <span className="text-white/60 text-[11px]">{isMuted ? "Unmute" : "Mute"}</span>
              </div>

              {/* Camera off / on (video only) */}
              {activeCall.call_type === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = !isVideoOff;
                      callManager.toggleVideo(next); // true = off = disable tracks
                      setIsVideoOff(next);
                    }}
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isVideoOff ? "bg-white text-black" : "bg-white/20 text-white"}`}
                  >
                    {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </button>
                  <span className="text-white/60 text-[11px]">{isVideoOff ? "Camera on" : "Camera off"}</span>
                </div>
              )}

              {/* End call */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => void endActiveCall()}
                  className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <PhoneOff className="h-7 w-7 text-white" />
                </button>
                <span className="text-white/60 text-[11px]">End</span>
              </div>

              {/* Screen share (video only, desktop) */}
              {activeCall.call_type === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={async () => {
                      try {
                        if (isScreenSharing) {
                          // Stop screen share — switch back to camera
                          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
                          const cameraTrack = cameraStream.getVideoTracks()[0];
                          const pc = callManager.getPeerConnection();
                          if (pc && cameraTrack) {
                            const sender = pc.getSenders().find(s => s.track?.kind === "video");
                            if (sender) await sender.replaceTrack(cameraTrack);
                          }
                          if (localVideoRef.current) {
                            localVideoRef.current.srcObject = new MediaStream([cameraTrack]);
                            localVideoRef.current.play().catch(() => {});
                          }
                          setIsScreenSharing(false);
                        } else {
                          // Start screen share
                          const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
                          const screenTrack = screenStream.getVideoTracks()[0];
                          const pc = callManager.getPeerConnection();
                          if (pc && screenTrack) {
                            const sender = pc.getSenders().find(s => s.track?.kind === "video");
                            if (sender) await sender.replaceTrack(screenTrack);
                          }
                          if (localVideoRef.current) {
                            localVideoRef.current.srcObject = new MediaStream([screenTrack]);
                            localVideoRef.current.play().catch(() => {});
                          }
                          // Auto-stop when user ends screen share via browser UI
                          screenTrack.onended = () => setIsScreenSharing(false);
                          setIsScreenSharing(true);
                        }
                      } catch (err) {
                        console.error("[Dashboard] Screen share failed:", err);
                      }
                    }}
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isScreenSharing ? "bg-white text-black" : "bg-white/20 text-white"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                      {isScreenSharing && <path d="M9 9l3-3 3 3"/>}
                    </svg>
                  </button>
                  <span className="text-white/60 text-[11px]">{isScreenSharing ? "Stop share" : "Share"}</span>
                </div>
              )}

              {/* Flip camera (video only) */}
              {activeCall.call_type === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => void flipCamera()}
                    className="h-14 w-14 rounded-full bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                      <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="m18 22-3-3 3-3"/>
                      <path d="m6 2 3 3-3 3"/>
                    </svg>
                  </button>
                  <span className="text-white/60 text-[11px]">Flip</span>
                </div>
              )}

              {/* Speaker toggle (voice only) */}
              {activeCall.call_type === "voice" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = !isSpeaker;
                      setIsSpeaker(next);
                      // Set audio output to speaker or earpiece
                      if (remoteAudioRef.current) {
                        const audio = remoteAudioRef.current as any;
                        if (audio.setSinkId) {
                          // setSinkId('') = default (earpiece on mobile), 'speaker' = loudspeaker
                          audio.setSinkId(next ? "" : "").catch(() => {});
                        }
                      }
                    }}
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isSpeaker ? "bg-white/20 text-white" : "bg-white text-black"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  </button>
                  <span className="text-white/60 text-[11px]">{isSpeaker ? "Speaker" : "Earpiece"}</span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function NavItem({
  to, icon: Icon, label, exact, badge, onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
