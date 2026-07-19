import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  Loader2, MessageCircle, Home, Users, Settings,
  FileText, LogOut, CheckSquare, ShieldCheck, Menu, X, Phone, Video, PhoneOff,
  MicOff, Mic, VideoOff, Minimize2, Maximize2, SpeakerIcon, Pause, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification, sendWebPush } from "@/lib/notifications";
import { callManager, type Call } from "@/lib/calls";
import { NotificationBell, NotificationProvider } from "@/components/NotificationBell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: DashboardLayout,
});

// ── Presence: runs on every dashboard page ───────────────────────────────────
function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    async function setOnline() {
      // Upsert instead of update — handles the race condition where profile
      // doesn't exist yet on first login (DB trigger may not have fired yet)
      await supabase
        .from("profiles")
        .upsert({ user_id: userId, status: "online", last_seen: new Date().toISOString() }, { onConflict: "user_id" });
    }

    async function setOffline() {
      const now = new Date().toISOString();
      try {
        // upsert handles the case where the profile row doesn't exist yet —
        // avoids the 404 that a plain update/PATCH produces on a missing row.
        await supabase
          .from("profiles")
          .upsert(
            { user_id: userId, status: "offline", last_seen: now },
            { onConflict: "user_id" }
          );
      } catch { /* ignore — page may be closing */ }
    }

    // keepalive version used in pagehide/beforeunload where the Supabase client
    // may not finish before the page tears down.
    function setOfflineBeacon() {
      const now = new Date().toISOString();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
      const body = JSON.stringify({ status: "offline", last_seen: now });
      // sendBeacon is fire-and-forget and survives page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        // Fallback: keepalive fetch (best-effort)
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Prefer": "return=minimal",
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    }

    void setOnline();
    const heartbeat = setInterval(() => void setOnline(), 10_000); // Update every 10 seconds instead of 20

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void setOffline();
      else void setOnline();
    };
    const onPageHide = (e: PageTransitionEvent) => { if (!e.persisted) setOfflineBeacon(); };
    const onUnload = () => setOfflineBeacon();

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
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<any>(null);

  usePresence(user?.id);
  useViewportHeight();

  // ── Restore calls from localStorage on mount ──────────────────────────────
  useEffect(() => {
    try {
      // Restore active call
      const activeCallData = localStorage.getItem("activeCall");
      if (activeCallData) {
        try {
          const parsed = JSON.parse(activeCallData);
          const { call, profile, timestamp } = parsed;
          
          // Only restore if less than 5 minutes old
          if (timestamp && Date.now() - timestamp < 5 * 60 * 1000) {
            console.log("[Storage] Restoring active call from localStorage");
            setActiveCall(call);
            setActiveProfile(profile);
            
            // Rejoin the call
            setTimeout(() => {
              const setActive = (window as any).__setActiveCall;
              if (setActive) {
                void setActive(call, profile);
              }
            }, 500);
          } else {
            console.log("[Storage] Active call too old, clearing");
            localStorage.removeItem("activeCall");
          }
        } catch (err) {
          console.warn("[Storage] Clearing corrupted activeCall data");
          localStorage.removeItem("activeCall");
        }
      }
      
      // Restore incoming call
      const incomingCallData = localStorage.getItem("incomingCall");
      if (incomingCallData) {
        try {
          const parsed = JSON.parse(incomingCallData);
          const { call, profile, timestamp } = parsed;
          
          // Only restore if less than 30 seconds old (call timeout)
          if (timestamp && Date.now() - timestamp < 30 * 1000) {
            console.log("[Storage] Restoring incoming call from localStorage");
            
            // Check if call is still ringing
            supabase.from("calls").select("*").eq("id", call.id).maybeSingle().then(({ data }) => {
              if (data && data.status === "ringing") {
                setIncomingCall(data);
                setIncomingProfile(profile);
                
                // Start ringtone
                setTimeout(() => {
                  const startRing = (window as any).__startRingtone;
                  if (startRing) startRing();
                }, 200);
              } else {
                console.log("[Storage] Call no longer ringing, clearing");
                localStorage.removeItem("incomingCall");
              }
            });
          } else {
            console.log("[Storage] Incoming call too old, clearing");
            localStorage.removeItem("incomingCall");
          }
        } catch (err) {
          console.warn("[Storage] Clearing corrupted incomingCall data");
          localStorage.removeItem("incomingCall");
        }
      }
    } catch (err) {
      console.error("[Storage] Error restoring calls:", err);
    }
  }, []);

  // ── Track app visibility — DO NOT pause audio, just track state ─────────
  // Audio must keep flowing in background so the other person can still hear you
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppHidden(document.hidden);
      // NOTE: We intentionally do NOT pause/resume audio here.
      // Pausing audio when backgrounded cuts the call for the other person.
      // The Wake Lock + WebRTC keep the connection alive in background.
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Close call options menu when clicking outside ──────────────────────────
  useEffect(() => {
    if (!showCallOptions) return;
    const handleClick = () => setShowCallOptions(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showCallOptions]);

  // ── Prevent refresh/close during active call ───────────────────────────────
  useEffect(() => {
    if (!activeCall) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an active call. Are you sure you want to leave?";
      return e.returnValue;
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeCall]);

  // ── Sync remoteStream to whichever video element is currently rendered ──────
  // This fixes the ref-stealing bug: the hidden <video> element was stealing
  // remoteVideoRef, so the visible element never received the stream.
  // Now we store the stream in state and sync it via useEffect.
  useEffect(() => {
    if (!remoteStream) return;
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    el.play().catch((err) => {
      if (err.name === "NotAllowedError") {
        const retry = () => { el.play().catch(() => {}); };
        document.addEventListener("click", retry, { once: true });
        document.addEventListener("touchstart", retry, { once: true });
      }
    });
  }, [remoteStream, callMinimized]);

  // ── Wake Lock: keep screen/CPU alive during active call ───────────────────
  // Prevents phone from sleeping and cutting the call
  useEffect(() => {
    if (!activeCall) return;

    let wakeLock: any = null;

    async function acquireWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          console.log("[WakeLock] Acquired — screen will stay on during call");

          // Re-acquire if released (e.g. tab hidden then visible again)
          wakeLock.addEventListener("release", () => {
            console.log("[WakeLock] Released — re-acquiring...");
            if (activeCall) void acquireWakeLock();
          });
        }
      } catch (err) {
        console.warn("[WakeLock] Could not acquire:", err);
      }
    }

    // Re-acquire when page becomes visible again (user switches back)
    const handleVisibility = () => {
      if (!document.hidden && activeCall && (!wakeLock || wakeLock.released)) {
        void acquireWakeLock();
      }
    };

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLock && !wakeLock.released) {
        wakeLock.release().catch(() => {});
        console.log("[WakeLock] Released on call end");
      }
    };
  }, [activeCall?.id]); // re-run only when call ID changes

  // ── Restore active call on page load (FIXED VERSION) ──────────────────────
  const hasRestoredCallRef = useRef(false);
  
  useEffect(() => {
    if (!user || hasRestoredCallRef.current) return;
    
    const restoreCall = async () => {
      try {
        const savedCall = localStorage.getItem("activeCall");
        if (!savedCall) return;
        
        hasRestoredCallRef.current = true;
        
        let parsedData;
        try {
          parsedData = JSON.parse(savedCall);
        } catch (parseErr) {
          console.error("[CallRestore] Invalid JSON in localStorage:", parseErr);
          localStorage.removeItem("activeCall");
          return;
        }
        
        const { call, profile, timestamp } = parsedData;
        
        if (!call || !call.id || !timestamp) {
          console.error("[CallRestore] Invalid call data structure");
          localStorage.removeItem("activeCall");
          return;
        }
        
        // Only restore if less than 2 minutes old (call likely still active)
        const age = Date.now() - timestamp;
        if (age > 120000) {
          console.log("[CallRestore] Call too old (", Math.floor(age/1000), "s), not restoring");
          localStorage.removeItem("activeCall");
          return;
        }
        
        console.log("[CallRestore] Checking if call is still active...");
        
        // Verify call is still active in database
        const { data, error } = await supabase
          .from("calls")
          .select("*")
          .eq("id", call.id)
          .maybeSingle();
        
        if (error) {
          console.error("[CallRestore] Database error:", error);
          localStorage.removeItem("activeCall");
          return;
        }
        
        if (!data) {
          console.log("[CallRestore] Call not found in database");
          localStorage.removeItem("activeCall");
          return;
        }
        
        if (data.status !== "active") {
          console.log("[CallRestore] Call status is", data.status, "- not restoring");
          localStorage.removeItem("activeCall");
          return;
        }
        
        console.log("[CallRestore] ✅ Call is still active, restoring...");
        
        // Set UI state
        setActiveCall(data as Call);
        setActiveProfile(profile);
        setCallDuration(0);
        setIsMuted(false);
        setIsVideoOff(false);
        setCallMinimized(false);
        
        // Show alert to user
        alert("Reconnecting to your call...");
        
        // Try to rejoin the call - use window global to avoid circular dependency
        try {
          const answerFn = (window as any).__answerCall;
          if (answerFn) {
            await answerFn(data as Call);
            console.log("[CallRestore] ✅ Successfully rejoined call");
          }
        } catch (rejoinErr) {
          console.error("[CallRestore] Failed to rejoin call:", rejoinErr);
          // Clean up on failure
          setActiveCall(null);
          setActiveProfile(null);
          localStorage.removeItem("activeCall");
          alert("Failed to reconnect to call. The call may have ended.");
        }
      } catch (err) {
        console.error("[CallRestore] Failed to restore call:", err);
        localStorage.removeItem("activeCall");
      }
    };
    
    void restoreCall();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Save call state to localStorage when call becomes active ───────────────
  useEffect(() => {
    if (activeCall && activeCall.status === "active") {
      try {
        localStorage.setItem("activeCall", JSON.stringify({
          call: activeCall,
          profile: activeProfile,
          timestamp: Date.now()
        }));
        console.log("[CallPersist] Saved active call to localStorage");
      } catch (err) {
        console.error("[CallPersist] Failed to save call state:", err);
      }
    } else if (!activeCall) {
      // Clear when call ends
      localStorage.removeItem("activeCall");
    }
  }, [activeCall, activeProfile]);

  // ── Clear incoming call from localStorage when answered/declined ───────────
  useEffect(() => {
    if (!incomingCall) {
      localStorage.removeItem("incomingCall");
    }
  }, [incomingCall]);

  // ── Ringtone helpers (defined first so useEffects below can use them) ──────
  const startRingtone = useCallback(() => {
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    try {
      // Resume or create AudioContext — browsers block audio until a user gesture,
      // but by the time the user receives a call they've already interacted with the page.
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
      } catch { return; }

      let playing = true;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      // Classic GSM dual-tone ring: 400 Hz + 450 Hz mixed, on 0.4 s, off 0.2 s, on 0.4 s, off 2 s
      // Matches what a real phone sounds like.
      function playTone(freq1: number, freq2: number, duration: number, vol: number) {
        if (!playing) return;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.value = freq1;
        osc2.type = "sine";
        osc2.frequency.value = freq2;

        // Smooth attack + decay so it doesn't click
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.02);
        gain.gain.setValueAtTime(vol, now + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now); osc1.stop(now + duration);
        osc2.start(now); osc2.stop(now + duration);
      }

      function ringCycle() {
        if (!playing) return;
        // Ring pattern: RING (0.4s) — pause (0.2s) — RING (0.4s) — long pause (2s)
        playTone(400, 450, 0.4, 0.35);
        timerId = setTimeout(() => {
          if (!playing) return;
          playTone(400, 450, 0.4, 0.35);
          timerId = setTimeout(() => {
            if (playing) ringCycle(); // loop after the 2s pause
          }, 2200);
        }, 700); // 0.4 ring + 0.2 gap + a bit of buffer
      }

      // Unlock AudioContext if suspended (required on iOS/Chrome after page load)
      if (ctx.state === "suspended") {
        ctx.resume().then(ringCycle).catch(() => {});
      } else {
        ringCycle();
      }

      ringtoneRef.current = {
        stop: () => {
          playing = false;
          if (timerId) { clearTimeout(timerId); timerId = null; }
          ctx.close().catch(() => {});
        },
      };
    } catch { /* ignore — audio not available */ }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      try { ringtoneRef.current.stop(); } catch { /* ignore */ }
      ringtoneRef.current = null;
    }
  }, []);

  // ── Handle push notification tap: ?conv=...&call=...&action=... ──────────────────────
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const callId = params.get("call");
    const convId = params.get("conv");
    const action = params.get("action"); // "answer" or "decline"
    
    if (!callId || !convId) return;
    
    // Clean URL immediately
    window.history.replaceState({}, "", window.location.pathname);
    
    // Fetch the call
    supabase.from("calls").select("*").eq("id", callId).maybeSingle().then(({ data: call }) => {
      if (!call) {
        console.log("[NotificationAction] Call not found:", callId);
        return;
      }
      
      // Handle action from notification button
      if (action === "decline") {
        console.log("[NotificationAction] Declining call from notification");
        // Decline the call immediately
        const declineFn = (window as any).__declineCall;
        if (declineFn) {
          void declineFn(call);
        } else {
          // Dashboard not ready yet, update DB directly
          void supabase
            .from("calls")
            .update({ status: "declined", ended_at: new Date().toISOString() })
            .eq("id", callId);
        }
      } else if (action === "answer") {
        console.log("[NotificationAction] Answering call from notification");
        // Answer the call immediately
        const answerFn = (window as any).__answerCall;
        if (answerFn) {
          void answerFn(call);
        } else {
          // Store as pending for when dashboard is ready
          (window as any).__pendingCall = call;
          (window as any).__pendingCallAction = "answer";
        }
      } else {
        // Regular notification tap - just show the call
        (window as any).__pendingCall = call;
      }
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
        
        // Use window global to avoid circular dependency
        const startRing = (window as any).__startRingtone;
        if (startRing) startRing();

        // Save incoming call to localStorage for recovery
        try {
          localStorage.setItem("incomingCall", JSON.stringify({
            call,
            profile: profile ?? null,
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error("[CallPersist] Failed to save incoming call:", err);
        }

        // Vibrate aggressively
        if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);

        // In-app notification (foreground/backgrounded tab)
        void sendPushNotification(
          call.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call",
          `${profile?.display_name ?? "Someone"} is calling...`,
          { 
            tag: `call-${call.id}`, 
            requireInteraction: true,
            onClick: () => {
              // Focus window and show incoming call
              window.focus();
              const setIncoming = (window as any).__setIncomingCall;
              if (setIncoming) void setIncoming(call);
            }
          }
        );
        
        // Real Web Push — wakes phone even when browser is closed
        if (user) {
          void sendWebPush(
            user.id,
            call.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call",
            `${profile?.display_name ?? "Someone"} is calling...`,
            `/dashboard/chat?conv=${call.conversation_id}&call=${call.id}`
          );
        }

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
          const stopRing = (window as any).__stopRingtone;
          if (stopRing) stopRing();
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
        console.log("[CallListener] Call UPDATE:", call.id, "status:", call.status);
        
        // Use current state via callback to avoid stale closure
        setIncomingCall((currentIncoming) => {
          // If the incoming call was cancelled/ended by caller before we answered
          if (currentIncoming && call.id === currentIncoming.id && (call.status === "ended" || call.status === "declined" || call.status === "missed")) {
            console.log("[CallListener] Incoming call cancelled by caller");
            setIncomingProfile(null);
            const stopRing = (window as any).__stopRingtone;
            if (stopRing) stopRing();
            if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
            return null; // Clear incoming call
          }
          return currentIncoming;
        });
        
        // Use current state via callback to avoid stale closure
        setActiveCall((currentActive) => {
          // If an active call was ended/declined/missed by the other party
          if (currentActive && call.id === currentActive.id && (call.status === "ended" || call.status === "declined" || call.status === "missed")) {
            console.log("[CallListener] Active call terminated by other party - triggering cleanup");
            const endFn = (window as any).__endActiveCall;
            if (endFn) void endFn();
            return null;
          }
          return currentActive;
        });

        // Also handle the case where initiator is waiting (ringing) and receiver declines/misses
        // In this case activeCall is null but we still need to clean up the initiator's UI
        setIncomingCall((currentIncoming) => currentIncoming); // no-op, just to get a re-render hook
        const endFn = (window as any).__endActiveCall;
        if ((call.status === "declined" || call.status === "missed") && endFn) {
          // Check if we are the initiator waiting for this call
          void supabase.auth.getUser().then(({ data }) => {
            if (data.user && call.initiator_id === data.user.id) {
              console.log("[CallListener] Initiator: receiver declined/missed, cleaning up");
              void endFn();
            }
          });
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
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((err) => {
            if (err.name === "NotAllowedError") {
              const retry = () => { remoteAudioRef.current?.play().catch(() => {}); };
              document.addEventListener("click", retry, { once: true });
              document.addEventListener("touchstart", retry, { once: true });
            }
          });
        }
        if (call.call_type === "video") {
          setRemoteStream(stream);
          const videoTracks = stream.getVideoTracks();
          setRemoteVideoActive(videoTracks.length > 0 && videoTracks[0].enabled);
          videoTracks.forEach(track => {
            track.addEventListener('ended', () => setRemoteVideoActive(false));
            track.addEventListener('mute', () => setRemoteVideoActive(false));
            track.addEventListener('unmute', () => setRemoteVideoActive(true));
          });
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
        setRemoteStream(null);
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
      console.error("[Dashboard] Error details:", {
        name: err?.name,
        message: err?.message,
        stack: err?.stack
      });
      setActiveCall(null); setActiveProfile(null);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      
      // Show the actual error message
      const errorMsg = err?.message || "Failed to answer call. Please check camera/microphone permissions.";
      alert(errorMsg);
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
      
      // Clear ALL call UI state — covers both active and ringing states
      setActiveCall(null);
      setActiveProfile(null);
      setIncomingCall(null);
      setIncomingProfile(null);
      stopRingtone();
      if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
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
      setRemoteVideoActive(false);
      setRemoteStream(null);
      setIsScreenSharing(false);
      localStorage.removeItem("activeCall");
      localStorage.removeItem("incomingCall");
      
      console.log("[Dashboard] Active call ended successfully");
    } catch (err) {
      console.error("[Dashboard] Error ending active call:", err);
    }
  }, [stopRingtone]);
  const flipCamera = useCallback(async () => {
    const newFacing = facingMode === "user" ? "environment" : "user";

    try {
      // Stop current video tracks FIRST — Android can't open two cameras at once
      const localStream = callManager.getLocalStream();
      if (localStream) {
        localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
      }

      // Try with exact first, fall back to ideal
      let newVideoTrack: MediaStreamTrack | null = null;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: newFacing } } });
        newVideoTrack = s.getVideoTracks()[0] ?? null;
      } catch {
        // exact not supported — try without
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing } });
          newVideoTrack = s.getVideoTracks()[0] ?? null;
        } catch {
          // last resort — any camera
          const s = await navigator.mediaDevices.getUserMedia({ video: true });
          newVideoTrack = s.getVideoTracks()[0] ?? null;
        }
      }

      if (!newVideoTrack) throw new Error("No video track returned");

      // Replace track in peer connection so other party sees the flip
      const pc = callManager.getPeerConnection();
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        } else {
          pc.addTrack(newVideoTrack, localStream ?? new MediaStream([newVideoTrack]));
        }
      }

      // Add new track to local stream
      if (localStream) localStream.addTrack(newVideoTrack);

      // Update local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([newVideoTrack]);
        localVideoRef.current.play().catch(() => {});
      }

      setFacingMode(newFacing);
      console.log("[Dashboard] Camera flipped to:", newFacing);
    } catch (err: any) {
      console.error("[Dashboard] Flip camera failed:", err);
      toast.error("Could not flip camera — device may not support it");
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
    (window as any).__endActiveCall = endActiveCall;
    (window as any).__declineCall = declineCall;
    (window as any).__startRingtone = startRingtone;
    (window as any).__stopRingtone = stopRingtone;
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
      // The buffering mechanism in CallManager ensures the stream is replayed if it arrived early
      callManager.onRemoteStreamCb = (stream) => {
        console.log("[Dashboard] Remote stream, tracks:", stream.getTracks().map(t => t.kind));
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((err) => {
            if (err.name === "NotAllowedError") {
              const retry = () => { remoteAudioRef.current?.play().catch(() => {}); };
              document.addEventListener("click", retry, { once: true });
              document.addEventListener("touchstart", retry, { once: true });
            }
          });
        }
        if (call.call_type === "video") {
          setRemoteStream(stream);
          const videoTracks = stream.getVideoTracks();
          setRemoteVideoActive(videoTracks.length > 0 && videoTracks[0].enabled);
          videoTracks.forEach(track => {
            track.addEventListener('ended', () => setRemoteVideoActive(false));
            track.addEventListener('mute', () => setRemoteVideoActive(false));
            track.addEventListener('unmute', () => setRemoteVideoActive(true));
          });
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
        setRemoteStream(null);
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
    const pendingAction = (window as any).__pendingCallAction;
    
    if (pending) {
      delete (window as any).__pendingCall;
      delete (window as any).__pendingCallAction;
      
      setTimeout(() => {
        if (pendingAction === "answer" && pending.status === "ringing") {
          // Auto-answer from notification action
          console.log("[Dashboard] Auto-answering call from notification");
          void answerCall(pending);
        } else if (pending.status === "ringing") {
          // Show incoming call screen (don't auto-answer)
          const setIncoming = (window as any).__setIncomingCall;
          if (setIncoming) void setIncoming(pending);
        }
        // active calls: JOIN button in chat header handles them
      }, 200);
    }

    return () => {
      delete (window as any).__answerCall;
      delete (window as any).__endActiveCall;
      delete (window as any).__declineCall;
      delete (window as any).__startRingtone;
      delete (window as any).__stopRingtone;
      delete (window as any).__setIncomingCall;
      delete (window as any).__setActiveCall;
    };
  }, [answerCall, endActiveCall, declineCall, startRingtone, stopRingtone]);

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

  if (loading || !user || role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initial = (displayName || user.email || "?")[0].toUpperCase();

  const navItems = isAdmin ? [
    { to: "/dashboard", icon: Home, label: "Overview", exact: true },
    { to: "/dashboard/chat", icon: MessageCircle, label: "Messages", badge: unreadCount },
    { to: "/dashboard/files", icon: FileText, label: "Files" },
    { to: "/dashboard/users", icon: Users, label: "Clients" },
    { to: "/dashboard/tasks", icon: CheckSquare, label: "Tasks" },
    { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  ] : [
    { to: "/dashboard/chat", icon: MessageCircle, label: "Messages", badge: unreadCount },
  ];

  const SidebarContent = () => (
    <>
      {/* Brand — avatar only on md, full on lg+ */}
      <Link
        to="/"
        className="flex items-center justify-center lg:justify-start gap-3 lg:px-4 h-14 border-b border-[#2a3942] hover:bg-[#2a3942] transition-all shrink-0"
        style={{ background: "#202c33" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border border-[#2a3942] shrink-0">
          <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
        </div>
        <div className="hidden lg:flex flex-col min-w-0">
          <span className="font-semibold text-sm text-[#e9edef]">Ajibola</span>
          <span className="text-[11px] text-[#8696a0]">Portfolio & Chat</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto" style={{ background: "#111b21" }}>
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
        {/* Notification bell — shown for all users */}
        <NotificationBell />
      </nav>

      {/* User Profile — icon only on md, full on lg+ */}
      <div className="p-2 lg:p-3 border-t border-[#2a3942] shrink-0" style={{ background: "#202c33" }}>
        <div className="flex items-center justify-center lg:justify-start gap-3 lg:px-2 py-1.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-9 w-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white text-sm font-semibold shrink-0">
              {initial}
            </div>
          )}
          <div className="hidden lg:flex flex-col flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-[#e9edef]">{displayName || user.email}</div>
            {isAdmin && (
              <div className="flex items-center gap-1 text-[11px] text-[#00a884] mt-0.5">
                <ShieldCheck className="h-3 w-3" /> Admin
              </div>
            )}
          </div>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
            className="hidden lg:flex p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  // ── Format call duration ───────────────────────────────────────────────────
  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <NotificationProvider>
    <div className="flex bg-background overflow-hidden" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>

      {/* Desktop sidebar — icon-only on md, full labels on lg+ (WhatsApp Web style) */}
      <aside className="hidden md:flex flex-col border-r border-[#2a3942] shrink-0 w-[72px] lg:w-[260px]" style={{ background: "#111b21" }}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed left-0 right-0 top-0 z-30 flex items-center justify-between px-4 h-14 shadow-sm"
        style={{ background: "#202c33", borderBottom: "1px solid #2a3942", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
            <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
          </div>
          <span className="font-semibold text-sm text-[#e9edef]">Ajibola</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Notification bell — compact for mobile top bar */}
          <NotificationBellCompact />
          <button 
            onClick={() => setMobileOpen((v) => !v)} 
            className="p-2 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-20 bg-black/60 animate-fade-in" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-30 w-64 flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "#111b21", borderRight: "1px solid #2a3942", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 md:pt-0 pt-14">
        <Outlet />
      </main>

      {/* Always-mounted audio element — must exist even when call is minimized */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
      {/* Note: no hidden video element — remoteStream state + useEffect syncs to the visible element */}

      {/* ── INCOMING CALL SCREEN ─────────────────────────────────────────── */}
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0d1117" }}>
          {/* Subtle doodle pattern overlay */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          <div className="pt-14 pb-4 text-center relative z-10">
            <p className="text-[#8696a0] text-sm font-medium tracking-wide">
              {incomingCall.call_type === "video" ? "Incoming Video Call" : "Incoming Voice Call"}
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-52 w-52 rounded-full border border-white/10 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute h-40 w-40 rounded-full border border-white/15 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
              {incomingProfile?.avatar_url ? (
                <img src={incomingProfile.avatar_url} alt="Caller" className="h-36 w-36 rounded-full object-cover ring-4 ring-white/20 shadow-2xl relative z-10" />
              ) : (
                <div className="h-36 w-36 rounded-full bg-[#00a884] flex items-center justify-center text-white text-6xl font-bold ring-4 ring-white/20 shadow-2xl relative z-10">
                  {(incomingProfile?.display_name?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-white text-3xl font-bold">{incomingProfile?.display_name ?? (isAdmin ? "Client" : "Ajibola")}</h1>
              <p className="text-[#8696a0] text-sm mt-2">
                {incomingCall.call_type === "video" ? "Incoming video call" : "Incoming voice call"}
              </p>
            </div>
          </div>
          <div className="pb-16 flex justify-center gap-24 relative z-10">
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => declineCall(incomingCall)} className="h-16 w-16 rounded-full bg-[#f15c6d] flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                <PhoneOff className="h-7 w-7 text-white" />
              </button>
              <span className="text-[#8696a0] text-sm">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => answerCall(incomingCall)} className="h-16 w-16 rounded-full bg-[#25d366] flex items-center justify-center shadow-2xl active:scale-90 transition-transform animate-bounce">
                <Phone className="h-7 w-7 text-white" />
              </button>
              <span className="text-[#8696a0] text-sm">Answer</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL — MINIMIZED FLOATING PiP (WhatsApp style) ──────── */}
      {activeCall && callMinimized && (
        <div
          className="fixed z-[9998] shadow-2xl rounded-2xl overflow-hidden cursor-pointer select-none"
          style={{
            // Bottom-right on desktop, bottom-center on mobile
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            right: "16px",
            width: activeCall.call_type === "video" ? "160px" : "220px",
            background: activeCall.call_type === "video" ? "#000" : "#005c4b",
            border: "2px solid #00a884",
          }}
          onClick={() => setCallMinimized(false)}
        >
          {/* Video PiP: show remote video thumbnail */}
          {activeCall.call_type === "video" && (
            <div className="relative" style={{ aspectRatio: "9/16", maxHeight: "240px" }}>
              <video
                autoPlay playsInline
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
              />
              {/* Overlay: name + timer */}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                <p className="text-white text-[11px] font-semibold truncate">{activeProfile?.display_name ?? "Video call"}</p>
                <p className="text-[#25d366] text-[10px] font-mono">{fmtDuration(callDuration)}</p>
              </div>
              {/* Expand icon */}
              <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </div>
              {/* End call button */}
              <button
                onClick={(e) => { e.stopPropagation(); void endActiveCall(); }}
                className="absolute top-2 left-2 h-7 w-7 rounded-full bg-[#f15c6d] flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          )}

          {/* Voice PiP: compact bar */}
          {activeCall.call_type === "voice" && (
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#25d366] animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{activeProfile?.display_name ?? "Voice call"}</p>
                <p className="text-[#25d366] text-[10px] font-mono">{fmtDuration(callDuration)}</p>
              </div>
              {/* Mute */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isMuted;
                  callManager.toggleAudio(next);
                  setIsMuted(next);
                }}
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isMuted ? "bg-white/30" : "bg-white/10"}`}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5 text-white" /> : <Mic className="h-3.5 w-3.5 text-white" />}
              </button>
              {/* End */}
              <button
                onClick={(e) => { e.stopPropagation(); void endActiveCall(); }}
                className="h-7 w-7 rounded-full bg-[#f15c6d] flex items-center justify-center shrink-0"
              >
                <PhoneOff className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVE CALL — WhatsApp Desktop/Mobile style ───────────────────── */}
      {activeCall && !callMinimized && (
        <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row bg-black">
          
          {/* ── SCREEN SHARING OVERLAY (WhatsApp style) ─────────────────────── */}
          {isScreenSharing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90">
              <p className="text-white text-lg font-semibold mb-4">You're sharing your screen</p>
              <button
                onClick={async () => {
                  // Stop screen share — switch back to camera
                  try {
                    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                    const cameraTrack = cameraStream.getVideoTracks()[0];
                    const pc = callManager.getPeerConnection();
                    if (pc && cameraTrack) {
                      const sender = pc.getSenders().find(s => s.track?.kind === "video");
                      if (sender) await sender.replaceTrack(cameraTrack);
                    }
                    const localStream = callManager.getLocalStream();
                    if (localStream) {
                      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
                      localStream.addTrack(cameraTrack);
                    }
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = new MediaStream([cameraTrack]);
                      localVideoRef.current.play().catch(() => {});
                    }
                  } catch { /* ignore */ }
                  setIsScreenSharing(false);
                }}
                className="px-6 py-3 rounded-full bg-[#f15c6d] text-white font-semibold text-sm active:scale-95 transition-transform"
              >
                Stop sharing
              </button>
              {/* Small local preview in corner */}
              <div className="absolute bottom-28 left-4 w-20 h-28 rounded-xl overflow-hidden border-2 border-white/30">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-0 right-0 text-center text-white text-[10px] font-medium">You</div>
              </div>
            </div>
          )}
          {activeCall.call_type === "video" && (
            <>
              {/* Fallback background when remote camera is off */}
              {!remoteVideoActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                  style={{ background: "#0d1117" }}>
                  {/* Doodle pattern */}
                  <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                  }} />
                  {activeProfile?.avatar_url ? (
                    <img src={activeProfile.avatar_url} alt="Call" className="h-40 w-40 rounded-full object-cover ring-4 ring-white/20 shadow-2xl relative z-10" />
                  ) : (
                    <div className="h-40 w-40 rounded-full bg-[#00a884] flex items-center justify-center text-white text-6xl font-bold ring-4 ring-white/20 shadow-2xl relative z-10">
                      {(activeProfile?.display_name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="text-center relative z-10">
                    <p className="text-[#8696a0] text-sm">Camera is off</p>
                  </div>
                </div>
              )}

              {/* Remote video — always render, just hide when inactive */}
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                  remoteVideoActive ? "opacity-100" : "opacity-0"
                } ${isAppHidden ? "blur-lg scale-110" : ""}`}
              />
              
              {/* App hidden overlay on remote video */}
              {remoteVideoActive && isAppHidden && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Pause className="h-12 w-12 text-white" />
                    <p className="text-white text-xl font-semibold">Video call paused</p>
                    <p className="text-white/60 text-sm">Return to app to resume</p>
                  </div>
                </div>
              )}
              
            </>
          )}

          {/* Voice call background */}
          {activeCall.call_type === "voice" && (
            <div className="absolute inset-0" style={{ background: "#0d1117" }}>
              {/* Doodle pattern */}
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }} />
            </div>
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
              <h1 className="text-white text-lg font-semibold leading-tight">{activeProfile?.display_name ?? "Calling..."}</h1>
              <p className="text-[#25d366] text-sm font-mono">{fmtDuration(callDuration)}</p>
            </div>
          </div>

          {/* Voice call: avatar center */}
          {activeCall.call_type === "voice" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              {activeProfile?.avatar_url ? (
                <img src={activeProfile.avatar_url} alt="Call" className="h-32 w-32 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
              ) : (
                <div className="h-32 w-32 rounded-full bg-[#00a884] flex items-center justify-center text-white text-5xl font-bold ring-4 ring-white/20 shadow-2xl">
                  {(activeProfile?.display_name?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Local video preview — always render video element, just hide/style it */}
          {activeCall.call_type === "video" && (
            <div className="absolute bottom-24 md:bottom-32 right-2 md:right-4 w-20 h-28 md:w-28 md:h-40 rounded-xl md:rounded-2xl border-2 border-white/40 shadow-xl z-10 overflow-hidden">

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

              {/* Flip camera button — top-right of local preview, mobile only */}
              {!isVideoOff && (
                <button
                  onClick={(e) => { e.stopPropagation(); void flipCamera(); }}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full flex items-center justify-center active:scale-90 transition-transform md:hidden"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  title="Flip camera"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                    <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="m18 22-3-3 3-3"/>
                    <path d="m6 2 3 3-3 3"/>
                  </svg>
                </button>
              )}

            </div>
          )}

          {/* Controls — floating island at bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 md:pb-10 pt-8"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}
          >
            <div className="flex items-center justify-center gap-4 md:gap-6 px-4">

              {/* More options (...) — VIDEO CALLS ONLY (has screen share) */}
              {activeCall.call_type === "video" && (
              <div className="flex flex-col items-center gap-1.5 relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCallOptions(v => !v); }}
                  className="h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all active:scale-90 bg-[#1f2c34] text-white"
                >
                  <MoreVertical className="h-5 w-5 md:h-6 md:w-6" />
                </button>
                <span className="text-[#8696a0] text-[10px] md:text-[11px]">More</span>
              </div>
              )}

              {/* Camera off / on (video only) */}
              {activeCall.call_type === "video" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = !isVideoOff;
                      const success = callManager.toggleVideo(next);
                      if (!success) { alert("Failed to turn camera on/off."); return; }
                      setIsVideoOff(next);
                    }}
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isVideoOff ? "bg-white text-black" : "bg-[#1f2c34] text-white"}`}
                  >
                    {isVideoOff ? <VideoOff className="h-5 w-5 md:h-6 md:w-6" /> : <Video className="h-5 w-5 md:h-6 md:w-6" />}
                  </button>
                  <span className="text-[#8696a0] text-[10px] md:text-[11px]">{isVideoOff ? "Camera on" : "Camera off"}</span>
                </div>
              )}

              {/* Speaker toggle (voice only) */}
              {activeCall.call_type === "voice" && (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = !isSpeaker;
                      setIsSpeaker(next);
                      if (remoteAudioRef.current) {
                        remoteAudioRef.current.volume = next ? 1.0 : 0.5;
                        if ((remoteAudioRef.current as any).setSinkId) {
                          (remoteAudioRef.current as any).setSinkId('default').catch(() => {});
                        }
                      }
                    }}
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isSpeaker ? "bg-white text-black" : "bg-[#1f2c34] text-white"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  </button>
                  <span className="text-[#8696a0] text-[10px] md:text-[11px]">{isSpeaker ? "Speaker" : "Earpiece"}</span>
                </div>
              )}

              {/* End call */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => void endActiveCall()}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#f15c6d] flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <PhoneOff className="h-6 w-6 md:h-7 md:w-7 text-white" />
                </button>
                <span className="text-[#8696a0] text-[10px] md:text-[11px]">End</span>
              </div>

              {/* Mute / Unmute */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = !isMuted;
                    // Optimistically update UI so button feels responsive
                    setIsMuted(next);
                    const success = callManager.toggleAudio(next);
                    if (!success) {
                      // localStream may not be ready yet on mobile — retry after 300ms
                      setTimeout(() => {
                        const ok = callManager.toggleAudio(next);
                        if (!ok) {
                          // Revert UI if still failing
                          setIsMuted(!next);
                        }
                      }, 300);
                    }
                  }}
                  className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isMuted ? "bg-white text-black" : "bg-[#1f2c34] text-white"}`}
                >
                  {isMuted ? <MicOff className="h-5 w-5 md:h-6 md:w-6" /> : <Mic className="h-5 w-5 md:h-6 md:w-6" />}
                </button>
                <span className="text-[#8696a0] text-[10px] md:text-[11px]">{isMuted ? "Unmute" : "Mute"}</span>
              </div>

              {/* Flip camera — desktop only (mobile has it on the preview thumbnail) */}
              {activeCall.call_type === "video" && (
                <div className="hidden md:flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => void flipCamera()}
                    className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-[#1f2c34] text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                      <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="m18 22-3-3 3-3"/>
                      <path d="m6 2 3 3-3 3"/>
                    </svg>
                  </button>
                  <span className="text-[#8696a0] text-[10px] md:text-[11px]">Flip</span>
                </div>
              )}

            </div>
          </div>

          {/* More options bottom sheet */}
          {showCallOptions && (
            <>
              {/* Backdrop */}
              <div className="absolute inset-0 z-20" onClick={() => setShowCallOptions(false)} />
              {/* Sheet */}
              <div className="absolute bottom-0 left-0 right-0 z-30 rounded-t-2xl overflow-hidden animate-fade-up"
                style={{ background: "#1f2c34" }}
                onClick={e => e.stopPropagation()}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-[#8696a0]/40" />
                </div>

                {/* End-to-end encrypted label */}
                <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-[#8696a0]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  End-to-end encrypted
                </div>

                {/* Options */}
                <div className="pb-8" style={{ borderTop: "1px solid #2a3942" }}>
                  {/* Share screen — VIDEO CALLS ONLY */}
                  {activeCall.call_type === "video" && (
                  <button
                    onClick={async () => {
                      setShowCallOptions(false);
                      try {
                        if (isScreenSharing) {
                          // Stop screen share — switch back to camera
                          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                          const cameraTrack = cameraStream.getVideoTracks()[0];
                          const pc = callManager.getPeerConnection();
                          if (pc && cameraTrack) {
                            const sender = pc.getSenders().find(s => s.track?.kind === "video");
                            if (sender) await sender.replaceTrack(cameraTrack);
                            else pc.addTrack(cameraTrack, cameraStream);
                          }
                          const localStream = callManager.getLocalStream();
                          if (localStream) {
                            localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
                            localStream.addTrack(cameraTrack);
                          }
                          if (localVideoRef.current) {
                            localVideoRef.current.srcObject = new MediaStream([cameraTrack]);
                            localVideoRef.current.play().catch(() => {});
                          }
                          setIsScreenSharing(false);
                        } else {
                          // getDisplayMedia — works on Android Chrome 94+ and desktop
                          const gdm = (navigator.mediaDevices as any).getDisplayMedia;
                          if (!gdm) {
                            toast.error("Screen sharing is not supported on this device/browser");
                            return;
                          }
                          const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
                            video: { cursor: "always" },
                            audio: false,
                          });
                          const screenTrack = screenStream.getVideoTracks()[0];
                          if (!screenTrack) { toast.error("Could not get screen track"); return; }

                          const pc = callManager.getPeerConnection();
                          if (pc) {
                            const sender = pc.getSenders().find(s => s.track?.kind === "video");
                            if (sender) await sender.replaceTrack(screenTrack);
                            else pc.addTrack(screenTrack, screenStream);
                          }
                          if (localVideoRef.current) {
                            localVideoRef.current.srcObject = new MediaStream([screenTrack]);
                            localVideoRef.current.play().catch(() => {});
                          }
                          setIsScreenSharing(true);

                          // Auto-stop when user stops sharing from browser/OS UI
                          screenTrack.onended = async () => {
                            setIsScreenSharing(false);
                            try {
                              const cs = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                              const ct = cs.getVideoTracks()[0];
                              const pc2 = callManager.getPeerConnection();
                              if (pc2 && ct) {
                                const s = pc2.getSenders().find(s => s.track?.kind === "video");
                                if (s) await s.replaceTrack(ct);
                              }
                              if (localVideoRef.current) {
                                localVideoRef.current.srcObject = new MediaStream([ct]);
                                localVideoRef.current.play().catch(() => {});
                              }
                            } catch { /* ignore */ }
                          };
                        }
                      } catch (err: any) {
                        if (err.name === "NotAllowedError") toast.error("Screen sharing permission denied");
                        else if (err.name === "NotSupportedError") toast.error("Screen sharing not supported on this device");
                        else toast.error("Failed to share screen");
                      }
                    }}
                    className="flex items-center justify-between w-full px-6 py-4 text-[#e9edef] hover:bg-[#2a3942] transition-colors text-sm"
                  >
                    <span>{isScreenSharing ? "Stop sharing screen" : "Share screen"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8696a0]">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </button>
                  )}

                  {/* Send message */}
                  <button
                    onClick={() => { setShowCallOptions(false); setCallMinimized(true); }}
                    className="flex items-center justify-between w-full px-6 py-4 text-[#e9edef] hover:bg-[#2a3942] transition-colors text-sm"
                    style={{ borderTop: "1px solid #2a3942" }}
                  >
                    <span>Send message</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8696a0]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </NotificationProvider>
  );
}



// ── Compact bell for mobile top bar ──────────────────────────────────────────
// Same panel as NotificationBell but renders as a bare icon button
function NotificationBellCompact() {
  return (
    <div className="[&>button]:py-0 [&>button]:px-2 [&>button]:h-9 [&>button]:w-9 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full">
      <NotificationBell />
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
      title={label}
      className="flex items-center justify-center lg:justify-start gap-3 lg:px-4 py-3 text-sm text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors relative"
      activeProps={{
        className: "flex items-center justify-center lg:justify-start gap-3 lg:px-4 py-3 text-sm text-[#e9edef] bg-[#2a3942] font-medium relative border-l-4 border-[#00a884]"
      }}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden lg:block flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-[#00a884] text-white lg:static absolute top-1.5 right-1.5">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
