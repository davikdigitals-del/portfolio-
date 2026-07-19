import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, MessageCircle, Loader2, CheckCheck, Check, Search, Pin,
  Sparkles, Paperclip, Mic, Download, X, Volume2, VolumeX,
  Play, Pause, FileText, Bell, BellOff, Trash2, Pencil, Reply,
  Phone, Video, Calendar, Link, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requestNotificationPermission,
  sendPushNotification,
  subscribeToWebPush,
  sendWebPush,
  startUnreadReminder,
  stopUnreadReminder,
  startBackgroundRefresh,
} from "@/lib/notifications";
import { callManager, type Call, type CallType, testMediaAccess } from "@/lib/calls";

export const Route = createFileRoute("/dashboard/chat")({
  head: () => ({ meta: [{ title: "Chat - Pulse" }] }),
  component: ChatPage,
  errorComponent: ({ error }) => {
    console.error("[ChatPage] Error:", error);
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{error?.message || "An unexpected error occurred"}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  },
});

interface Conversation {
  id: string;
  user_id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_user: number;
  unread_admin: number;
  pinned: boolean;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null; status: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: "text" | "file" | "image" | "voice" | "call";
  status: "sent" | "delivered" | "seen";
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  pinned: boolean;
  deleted_at: string | null;
  replied_to_id: string | null;
  reactions?: Record<string, string[]> | null; // { "👍": ["user_id_1"], "❤️": ["user_id_2"] }
  call_data?: {
    call_type: "voice" | "video";
    status: "ended" | "missed" | "declined";
    duration_seconds?: number | null;
  } | null;
}

interface FilePreview {
  file: File;
  previewUrl: string | null;
  kind: "image" | "video" | "file";
}

interface AdminProfile {
  user_id?: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  last_seen?: string | null;
}

// ── Stale presence cleanup: mark users offline if last_seen > 45s ago ─────────
// Heartbeat is every 20s, so 45s = 2 missed heartbeats = definitely offline
function useStalePresenceCleanup(isAdmin: boolean) {
  useEffect(() => {
    if (!isAdmin) return;
    async function cleanup() {
      // Guard: only run if we have a valid session — avoids 401s on load
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const cutoff = new Date(Date.now() - 45_000).toISOString();
      await supabase
        .from("profiles")
        .update({ status: "offline" })
        .eq("status", "online")
        .lt("last_seen", cutoff);
    }
    // Delay first run by 2s so session is definitely loaded
    const initial = setTimeout(() => void cleanup(), 2000);
    const interval = setInterval(() => void cleanup(), 15_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [isAdmin]);
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore */ }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "now";
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Renders last message preview with WhatsApp-style icon for calls/voice/images/files
function LastMessagePreview({ text }: { text: string | null }) {
  if (!text) return <span className="text-xs text-[#8696a0] truncate italic">Start the conversation</span>;

  const t = text.trim();

  // Voice/video call messages
  if (t.includes("Voice call") || t.includes("voice call") || t.includes("📞") || t.includes("☎️")) {
    const missed = t.includes("Missed") || t.includes("missed") || t.includes("📵");
    return (
      <span className={`flex items-center gap-1 text-xs truncate ${missed ? "text-[#f15c6d]" : "text-[#8696a0]"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
        {missed ? "Missed voice call" : "Voice call"}
      </span>
    );
  }

  // Video call messages
  if (t.includes("Video call") || t.includes("video call") || t.includes("📹")) {
    const missed = t.includes("Missed") || t.includes("missed") || t.includes("📵");
    return (
      <span className={`flex items-center gap-1 text-xs truncate ${missed ? "text-[#f15c6d]" : "text-[#8696a0]"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
        {missed ? "Missed video call" : "Video call"}
      </span>
    );
  }

  // Voice note
  if (t.includes("🎙️") || t.includes("voice-") || t.toLowerCase().includes("voice note")) {
    return (
      <span className="flex items-center gap-1 text-xs text-[#8696a0] truncate">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        Voice note
      </span>
    );
  }

  // Image
  if (t.includes("🖼️") || t.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return (
      <span className="flex items-center gap-1 text-xs text-[#8696a0] truncate">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        Photo
      </span>
    );
  }

  // File/document
  if (t.includes("📎") || t.match(/\.(pdf|doc|docx|xls|xlsx|zip|txt)$/i)) {
    return (
      <span className="flex items-center gap-1 text-xs text-[#8696a0] truncate">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        Document
      </span>
    );
  }

  // Plain text — strip emoji prefixes like 📞 ✅ ❌
  const clean = t.replace(/^[\p{Emoji}\s]+/u, "").trim() || t;
  return <span className="text-xs text-[#8696a0] truncate">{clean}</span>;
}

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

function formatLastSeenShort(iso: string | null): string {
  if (!iso) return "Last seen recently";
  const d = new Date(iso);
  // If last_seen is in the future or within 5 seconds, they just went offline
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 5_000) return "Last seen just now";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Last seen just now";
  if (diffMins === 1) return "Last seen 1 minute ago";
  if (diffMins < 60) return `Last seen ${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "Last seen 1 hour ago";
  if (diffHours < 24) return `Last seen ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Last seen yesterday";
  if (diffDays < 7) return `Last seen ${diffDays} days ago`;
  return `Last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

// Live last-seen label — ticks every 30s so the minutes update automatically
function useLastSeenLabel(iso: string | null, isOnline: boolean): string {
  const [label, setLabel] = useState(() => isOnline ? "Online" : formatLastSeenShort(iso));

  useEffect(() => {
    if (isOnline) {
      setLabel("Online");
      return;
    }
    // When they just went offline, use current time as last_seen if iso is null
    const effectiveIso = iso ?? new Date().toISOString();
    setLabel(formatLastSeenShort(effectiveIso));
    const t = setInterval(() => setLabel(formatLastSeenShort(effectiveIso)), 30_000);
    return () => clearInterval(t);
  }, [iso, isOnline]);

  return label;
}

// Live last-seen component for sidebar rows — ticks every 30s
function LiveLastSeen({ iso, online }: { iso: string | null; online: boolean }) {
  const label = useLastSeenLabel(iso, online);
  return (
    <span className={`text-xs truncate ${online ? "text-green-500 font-medium" : "text-muted-foreground"}`}>
      {label}
    </span>
  );
}

// ---- ChatPage ----------------------------------------------------------------

function ChatPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [notifsOn, setNotifsOn] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);

  // Handle URL parameters for incoming calls
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    const callId = params.get("call");
    
    if (convId) {
      setActiveId(convId);
      if (callId) {
        setPendingCallId(callId);
      }
      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/chat");
    }
  }, []);

  // ── Stale presence cleanup (admin only) ──
  useStalePresenceCleanup(isAdmin);

  // Request browser push permission on mount — auto-prompt after 2s
  useEffect(() => {
    if (notifPermission !== "default") return;
    const t = setTimeout(async () => {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? "granted" : "denied");
      // Subscribe to real Web Push so notifications wake the phone
      if (granted && user) {
        void subscribeToWebPush(user.id);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [user]);

  // If already granted, subscribe on mount
  useEffect(() => {
    if (notifPermission === "granted" && user) {
      void subscribeToWebPush(user.id);
    }
  }, [notifPermission, user?.id]);

  // Total unread across all conversations for the reminder
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (isAdmin ? c.unread_admin : c.unread_user), 0),
    [conversations, isAdmin]
  );

  // Start/stop 15-min reminder based on unread count
  useEffect(() => {
    if (!notifsOn) { stopUnreadReminder(); return; }
    startUnreadReminder(() => totalUnread, isAdmin);
    return () => stopUnreadReminder();
  }, [totalUnread, isAdmin, notifsOn]);

  const [alerts, setAlerts] = useState<{ id: string; text: string; convId: string }[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  // ── Conversation context menu (admin only) ────────────────────────────────
  const [convCtxMenu, setConvCtxMenu] = useState<{ convId: string; x: number; y: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // convId awaiting confirm
  const convCtxOpenTimeRef = useRef(0);
  const convLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openConvCtxMenu(e: React.MouseEvent | { clientX: number; clientY: number }, convId: string) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 180, menuH = 80;
    let x = (e as React.MouseEvent).clientX ?? 0;
    let y = (e as React.MouseEvent).clientY ?? 0;
    x = Math.max(8, Math.min(x, vw - menuW - 8));
    y = Math.max(8, Math.min(y, vh - menuH - 8));
    convCtxOpenTimeRef.current = Date.now();
    setConvCtxMenu({ convId, x, y });
  }

  async function deleteConversation(convId: string) {
    setConvCtxMenu(null);
    setDeleteConfirm(null);
    // Optimistic — remove from UI immediately
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeId === convId) setActiveId(null);
    // Messages cascade-delete automatically via FK ON DELETE CASCADE
    const { error } = await supabase.from("conversations").delete().eq("id", convId);
    if (error) {
      toast.error("Failed to delete conversation: " + error.message);
      void loadConversations(); // restore
    } else {
      toast.success("Conversation deleted");
    }
  }

  // Close conv context menu on outside pointer
  useEffect(() => {
    if (!convCtxMenu) return;
    const handler = (e: PointerEvent) => {
      if (Date.now() - convCtxOpenTimeRef.current < 400) return;
      const target = e.target as Element | null;
      if (target?.closest("[data-conv-ctx-menu]")) return;
      setConvCtxMenu(null);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [convCtxMenu]);

  // Fetch admin profile + subscribe immediately — no race condition
  useEffect(() => {
    if (isAdmin) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function init() {
      console.log("[AdminProfile] Fetching admin profile...");
      
      // Use RPC to get admin user_id — direct user_roles query is blocked by RLS for clients
      const { data: adminUserId, error: rpcError } = await supabase.rpc("get_admin_user_id");
      
      if (rpcError || !adminUserId) {
        console.error("[AdminProfile] Could not get admin user_id:", rpcError);
        return;
      }

      console.log("[AdminProfile] Found admin user_id:", adminUserId);

      // Step 2: fetch full profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, status, last_seen")
        .eq("user_id", adminUserId)
        .maybeSingle();
      
      if (profileError) {
        console.error("[AdminProfile] Error fetching admin profile:", profileError);
        return;
      }
      
      if (profile) {
        console.log("[AdminProfile] ✅ Admin profile loaded:", profile);
        setAdminProfile(profile as AdminProfile);
      } else {
        console.error("[AdminProfile] No profile found for admin user_id:", adminUserId);
      }

      // Step 3: subscribe to live updates immediately
      channel = supabase.channel(`admin-presence:${adminUserId}`)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${adminUserId}`,
        }, (payload) => {
          const p = payload.new as AdminProfile;
          setAdminProfile((prev) => prev
            ? { ...prev, status: p.status, last_seen: p.last_seen ?? prev.last_seen }
            : { user_id: adminUserId!, display_name: null, avatar_url: null, status: p.status, last_seen: p.last_seen }
          );
        })
        .subscribe();

      // Step 4: poll every 5s — fast enough to feel real-time
      // (fallback in case realtime filter misses updates)
      pollTimer = setInterval(async () => {
        const { data } = await supabase
          .from("profiles")
          .select("status, last_seen")
          .eq("user_id", adminUserId!)
          .maybeSingle();
        if (data) {
          setAdminProfile((prev) => prev
            ? { ...prev, status: data.status, last_seen: data.last_seen ?? prev.last_seen }
            : prev
          );
        }
      }, 5_000); // Poll every 5 seconds
    }

    void init();

    return () => {
      if (channel) void supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isAdmin]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    if (!isAdmin) {
      let { data: conv } = await supabase.from("conversations").select("*").eq("user_id", user.id).maybeSingle();
      if (!conv) {
        const { data: created } = await supabase.from("conversations").insert({ user_id: user.id }).select("*").single();
        conv = created;
      }
      if (conv) { setConversations([conv as Conversation]); setActiveId(conv.id); }
    } else {
      const { data: convs } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
      if (convs) {
        const userIds = convs.map((c) => c.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email, avatar_url, status").in("user_id", userIds);
        const byUser = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
        const enriched = convs.map((c) => ({ ...c, profile: byUser.get(c.user_id) ?? undefined })) as Conversation[];
        setConversations(enriched);
        // Admin: do NOT auto-open any conversation — let them choose
        // (previously this auto-jumped to the most recent chat)
      }
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => { if (user) void loadConversations(); }, [user, isAdmin]);

  // ── Background refresh: reload conversations every 3s when app is hidden ──
  useEffect(() => {
    return startBackgroundRefresh(() => {
      void loadConversations();
    });
  }, [loadConversations]);

  // Admin: subscribe to client profile changes for real-time online status
  useEffect(() => {
    if (!isAdmin || !user) return;
    const ch = supabase.channel("client-profiles-presence")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
      }, (payload) => {
        const updated = payload.new as { user_id: string; status: string; last_seen: string; display_name: string | null; avatar_url: string | null; email: string | null };
        // Update the matching conversation's profile in state immediately
        setConversations((prev) =>
          prev.map((c) =>
            c.user_id === updated.user_id
              ? { ...c, profile: { ...c.profile, display_name: updated.display_name, email: updated.email ?? c.profile?.email ?? null, avatar_url: updated.avatar_url, status: updated.status } as Conversation["profile"] }
              : c
          )
        );
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
        const updated = payload.new as Conversation;

        if (payload.eventType === "DELETE") {
          // Already handled optimistically by deleteConversation — just ensure state is clean
          const deleted = payload.old as { id: string };
          setConversations((prev) => prev.filter((c) => c.id !== deleted.id));
          return;
        }

        if (payload.eventType === "INSERT") {
          // New conversation — need profile, so do a targeted fetch for just this one
          void (async () => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_id, display_name, email, avatar_url, status")
              .eq("user_id", updated.user_id)
              .maybeSingle();
            const enriched = { ...updated, profile: profile ?? undefined } as Conversation;
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === enriched.id);
              if (exists) return prev;
              return [enriched, ...prev].sort((a, b) =>
                (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")
              );
            });
          })();
          return;
        }

        // UPDATE — patch in-place, no network call needed
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === updated.id);
          if (idx === -1) return prev; // not in list yet, ignore
          const patched = { ...prev[idx], ...updated };
          // Re-sort by last_message_at descending
          const next = [...prev];
          next[idx] = patched;
          return next.sort((a, b) =>
            (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")
          );
        });

        const unread = isAdmin ? updated.unread_admin : updated.unread_user;

        // Mark messages sent TO me as delivered
        if (updated.id && user) {
          void supabase
            .from("messages")
            .update({ status: "delivered" })
            .eq("conversation_id", updated.id)
            .neq("sender_id", user.id)
            .eq("status", "sent");
        }

        if (unread > 0 && updated.id !== activeId && notifsOn) {
          const label = isAdmin
            ? "A client sent you a message"
            : `New message from ${adminProfile?.display_name ?? "Ajibola"}`;
          const nid = crypto.randomUUID();
          setAlerts((prev) => [{ id: nid, text: label, convId: updated.id }, ...prev.slice(0, 3)]);
          if (soundOn) playBeep();
          void sendPushNotification(
            isAdmin ? "📩 New message" : "💬 New message",
            label,
            { tag: `msg-${updated.id}` }
          );
          if (user) {
            void sendWebPush(
              user.id,
              isAdmin ? "📩 New message" : "💬 New message",
              label,
              "/dashboard/chat"
            );
          }
          setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== nid)), 5000);
        }
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, isAdmin, activeId, soundOn, notifsOn, adminProfile?.display_name]);

  // ── Background polling for messages when app is hidden ──
  const lastUnreadRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!user || !notifsOn) return;

    // Initialize with current unread counts
    const initializeUnreadCounts = () => {
      conversations.forEach((conv) => {
        const unread = isAdmin ? conv.unread_admin : conv.unread_user;
        lastUnreadRef.current.set(conv.id, unread);
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background — initialize and start polling
        console.log("App hidden - starting background message polling");
        initializeUnreadCounts();
        
        const pollTimer = setInterval(async () => {
          try {
            const { data: convs } = await supabase.from("conversations").select("*");
            if (!convs) return;

            for (const conv of convs) {
              const unread = isAdmin ? conv.unread_admin : conv.unread_user;
              const lastUnread = lastUnreadRef.current.get(conv.id) ?? 0;

              // New unread messages detected
              if (unread > lastUnread && conv.id !== activeId) {
                console.log(`New message in conversation ${conv.id}: ${lastUnread} -> ${unread}`);
                lastUnreadRef.current.set(conv.id, unread);
                
                // Get conversation details for notification
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("display_name, email")
                  .eq("user_id", conv.user_id)
                  .maybeSingle();

                const senderName = isAdmin
                  ? (profile?.display_name ?? profile?.email ?? "A client")
                  : (adminProfile?.display_name ?? "Ajibola");

                const label = isAdmin
                  ? `${senderName} sent you a message`
                  : `New message from ${senderName}`;

                console.log("Background message detected:", label);

                // Send notifications
                void sendPushNotification(
                  isAdmin ? "📩 New message" : "💬 New message",
                  label,
                  { tag: `msg-${conv.id}` }
                );

                if (user) {
                  void sendWebPush(
                    user.id,
                    isAdmin ? "📩 New message" : "💬 New message",
                    label,
                    "/dashboard/chat"
                  );
                }

                if (soundOn) playBeep();
              }
            }
          } catch (err) {
            console.error("Background polling error:", err);
          }
        }, 2000); // Poll every 2 seconds for faster detection

        // Store timer ID for cleanup
        (window as any).__bgPollTimer = pollTimer;
      } else {
        // App came to foreground — stop polling
        console.log("App visible - stopping background message polling");
        const pollTimer = (window as any).__bgPollTimer;
        if (pollTimer) {
          clearInterval(pollTimer);
          (window as any).__bgPollTimer = null;
        }
        // Reset unread tracking
        lastUnreadRef.current.clear();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const pollTimer = (window as any).__bgPollTimer;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [user, isAdmin, activeId, soundOn, notifsOn, adminProfile?.display_name, conversations]);

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.profile?.display_name?.toLowerCase().includes(q) ||
      c.profile?.email?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Wait for role to resolve — prevents admin flashing as client view
  if (role === null) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#0b141a" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Notification alerts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-[calc(100vw-2rem)] max-w-sm">
        {alerts.map((a) => (
          <div key={a.id} className="pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-2xl animate-fade-up text-sm" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>
            <div className="h-8 w-8 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <span className="flex-1 truncate text-xs text-[#e9edef]">{a.text}</span>
            <button onClick={() => { setActiveId(a.convId); setAlerts((p) => p.filter((x) => x.id !== a.id)); }} className="text-[#00a884] text-xs font-semibold hover:underline shrink-0">Open</button>
            <button onClick={() => setAlerts((p) => p.filter((x) => x.id !== a.id))} className="text-[#8696a0] hover:text-[#e9edef] ml-1"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Sidebar — full screen on mobile when no chat open, 420px on desktop (WhatsApp Web) */}
      <aside className={`flex flex-col border-r border-[#2a3942] shrink-0 ${active ? "hidden md:flex md:w-[420px]" : "flex w-full md:w-[420px]"}`} style={{ background: "#111b21" }}>
        {/* Sidebar header */}
        <div className="h-[60px] px-4 flex items-center justify-between shrink-0" style={{ background: "#202c33", borderBottom: "1px solid #2a3942" }}>
          <h2 className="font-bold text-[#e9edef] text-[17px] tracking-tight">Messages</h2>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setSoundOn((v) => !v)} title={soundOn ? "Mute sound" : "Enable sound"} className="h-9 w-9 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all">
              {soundOn ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
            </button>
            <button onClick={() => setNotifsOn((v) => !v)} title={notifsOn ? "Disable notifications" : "Enable notifications"} className="h-9 w-9 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all">
              {notifsOn ? <Bell className="h-[18px] w-[18px]" /> : <BellOff className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {/* Notification permission banner */}
        {notifPermission === "default" && (
          <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: "rgba(0,168,132,0.1)", border: "1px solid rgba(0,168,132,0.2)" }}>
            <Bell className="h-3.5 w-3.5 text-[#00a884] shrink-0" />
            <span className="text-xs text-[#e9edef] flex-1 leading-snug">Enable notifications for new messages</span>
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotifPermission(granted ? "granted" : "denied");
                if (granted && user) { void subscribeToWebPush(user.id); toast.success("Notifications enabled!"); }
              }}
              className="text-[11px] font-bold text-[#00a884] hover:underline shrink-0 uppercase tracking-wide"
            >
              Allow
            </button>
          </div>
        )}

        {/* Search */}
        {isAdmin && (
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#8696a0]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="pl-9 h-9 text-sm bg-[#2a3942] border-0 text-[#e9edef] placeholder:text-[#8696a0] rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-1">
              {[1,2,3,4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="h-12 w-12 rounded-full bg-[#2a3942] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded bg-[#2a3942] animate-pulse" />
                    <div className="h-3 w-48 rounded bg-[#2a3942]/60 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <MessageCircle className="h-8 w-8 text-[#2a3942]" />
              <p className="text-sm text-[#8696a0]">No conversations yet</p>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const unread = isAdmin ? c.unread_admin : c.unread_user;
                const isActive = activeId === c.id;

                if (!isAdmin) {
                  const adminOnline = adminProfile?.status === "online";
                  const adminName = adminProfile?.display_name ?? "Ajibola Gbenga Joseph";
                  const adminInitial = adminName[0].toUpperCase();
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveId(c.id)}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3.5 transition-all relative ${isActive ? "bg-[#2a3942]" : "hover:bg-[#1a2530]"}`}
                      >
                        {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#00a884]" />}
                        <div className="relative shrink-0">
                          {adminProfile?.avatar_url ? (
                            <img src={adminProfile.avatar_url} alt={adminName} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] text-white text-[15px] font-bold shadow-md">{adminInitial}</div>
                          )}
                          <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 ${isActive ? "border-[#2a3942]" : "border-[#111b21]"} ${adminOnline ? "bg-[#25d366]" : "bg-[#8696a0]"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-[14px] text-[#e9edef] truncate leading-snug">{adminName}</span>
                            {c.last_message_at && (
                              <span className={`text-[11px] shrink-0 tabular-nums ${unread > 0 ? "text-[#00a884] font-semibold" : "text-[#8696a0]"}`}>
                                {formatTime(c.last_message_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <LiveLastSeen iso={adminProfile?.last_seen ?? null} online={adminOnline} />
                            {unread > 0 && (
                              <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[11px] font-bold rounded-full bg-[#00a884] text-white shadow-sm">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                }

                const clientOnline = c.profile?.status === "online";
                const clientName = c.profile?.display_name ?? c.profile?.email ?? "User";
                const clientInitial = clientName[0].toUpperCase();
                return (
                  <li key={c.id} className="relative">
                    <button
                      onClick={() => setActiveId(c.id)}
                      onContextMenu={(e) => { e.preventDefault(); openConvCtxMenu(e, c.id); }}
                      onTouchStart={() => {
                        convLongPressTimer.current = setTimeout(() => {
                          // approximate centre of the row as menu position
                          openConvCtxMenu({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }, c.id);
                          if ("vibrate" in navigator) navigator.vibrate(40);
                        }, 500);
                      }}
                      onTouchEnd={() => { if (convLongPressTimer.current) { clearTimeout(convLongPressTimer.current); convLongPressTimer.current = null; } }}
                      onTouchMove={() => { if (convLongPressTimer.current) { clearTimeout(convLongPressTimer.current); convLongPressTimer.current = null; } }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 transition-all relative ${isActive ? "bg-[#2a3942]" : "hover:bg-[#1a2530]"}`}
                    >
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#00a884]" />}
                      <div className="relative shrink-0">
                        {c.profile?.avatar_url ? (
                          <img src={c.profile.avatar_url} alt={clientName} className="h-12 w-12 rounded-full object-cover ring-2 ring-[#2a3942]" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] text-white text-[15px] font-bold shadow-md">{clientInitial}</div>
                        )}
                        <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 ${isActive ? "border-[#2a3942]" : "border-[#111b21]"} ${clientOnline ? "bg-[#25d366]" : "bg-[#8696a0]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-[14px] text-[#e9edef] truncate leading-snug">{clientName}</span>
                          {c.last_message_at && (
                            <span className={`text-[11px] shrink-0 tabular-nums ${unread > 0 ? "text-[#00a884] font-semibold" : "text-[#8696a0]"}`}>
                              {formatTime(c.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-0.5">
                          <LastMessagePreview text={c.last_message ?? null} />
                          {unread > 0 && (
                            <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[11px] font-bold rounded-full bg-[#00a884] text-white shadow-sm">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Subtle divider */}
                    <div className="ml-[67px] h-px" style={{ background: "#1f2c34" }} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Active chat — full screen on mobile when open */}
      <section className={`flex-1 flex-col min-w-0 ${active ? "flex" : "hidden md:flex"}`}>

      {/* ── Conversation context menu (admin) ──────────────────────────── */}
      {convCtxMenu && createPortal(
        <div
          data-conv-ctx-menu
          className="fixed z-[60] rounded-xl overflow-hidden shadow-2xl min-w-[180px] animate-fade-up"
          style={{ left: convCtxMenu.x, top: convCtxMenu.y, background: "#1f2c34", border: "1px solid #2a3942", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
        >
          <button
            onClick={() => { setDeleteConfirm(convCtxMenu.convId); setConvCtxMenu(null); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-[13px] text-[#f15c6d] hover:bg-[#2a3942] transition-colors text-left font-medium"
          >
            <Trash2 className="h-[15px] w-[15px] shrink-0" /> Delete chat
          </button>
        </div>,
        document.body
      )}

      {/* ── Delete confirmation modal ───────────────────────────────────── */}
      {deleteConfirm && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#1f2c34" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 text-center">
              <div className="h-12 w-12 rounded-full bg-[#f15c6d]/15 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="h-5 w-5 text-[#f15c6d]" />
              </div>
              <h3 className="font-bold text-[#e9edef] text-base mb-1">Delete chat?</h3>
              <p className="text-[#8696a0] text-sm">All messages will be permanently deleted. This cannot be undone.</p>
            </div>
            <div className="flex border-t border-[#2a3942]">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3.5 text-sm font-semibold text-[#8696a0] hover:bg-[#2a3942] transition-colors"
              >
                Cancel
              </button>
              <div style={{ width: 1, background: "#2a3942" }} />
              <button
                onClick={() => void deleteConversation(deleteConfirm)}
                className="flex-1 py-3.5 text-sm font-bold text-[#f15c6d] hover:bg-[#2a3942] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
        {active ? (
          <ActiveChat conversation={active} isAdmin={isAdmin} adminProfile={adminProfile} onBack={() => setActiveId(null)} pendingCallId={pendingCallId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 select-none" style={{ background: "#0b141a" }}>
            <div className="text-center animate-fade-up max-w-xs">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full mb-5" style={{ background: "rgba(0,168,132,0.08)", border: "1.5px solid rgba(0,168,132,0.15)" }}>
                <MessageCircle className="h-9 w-9 text-[#00a884] opacity-80" />
              </div>
              <h2 className="text-[17px] font-semibold text-[#e9edef]">Your messages</h2>
              <p className="text-sm text-[#8696a0] mt-2 leading-relaxed">Select a conversation from the sidebar to start chatting.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---- ActiveChat --------------------------------------------------------------

function ActiveChat({ conversation, isAdmin, adminProfile, onBack, pendingCallId }: { conversation: Conversation; isAdmin: boolean; adminProfile: AdminProfile | null; onBack: () => void; pendingCallId?: string | null }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [theyTyping, setTheyTyping] = useState(false);

  // ── "Delete for me" — hidden message IDs per conversation, persisted to localStorage ──
  const hiddenKey = `hidden_msgs_${conversation.id}_${user?.id ?? ""}`;
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(hiddenKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  function hideMessageForMe(msgId: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      try { localStorage.setItem(hiddenKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [counterpartStatus, setCounterpartStatus] = useState<string>(
    isAdmin ? (conversation.profile?.status ?? "offline") : (adminProfile?.status ?? "offline")
  );
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showCallDropdown, setShowCallDropdown] = useState(false);
  const [showAttachPicker, setShowAttachPicker] = useState(false);

  // Reset reply state when conversation changes
  useEffect(() => {
    setReplyingTo(null);
  }, [conversation.id]);

  // Keep counterpartStatus in sync with conversation.profile.status (admin side)
  // This fires whenever ChatPage's client-profiles-presence subscription updates conversations
  useEffect(() => {
    if (isAdmin && conversation.profile?.status) {
      setCounterpartStatus(conversation.profile.status);
    }
  }, [isAdmin, conversation.profile?.status]);
  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(24).fill(10));
  // Playback
  const [playingId, setPlayingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);       // generic (all)
  const photoInputRef = useRef<HTMLInputElement>(null);      // images only
  const cameraInputRef = useRef<HTMLInputElement>(null);     // camera capture
  const docInputRef = useRef<HTMLInputElement>(null);        // documents
  const audioInputRef = useRef<HTMLInputElement>(null);      // audio files

  // Load messages + existing summary + counterpart status
  useEffect(() => {
    if (!conversation || !user) return;
    void (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
      await supabase.from("conversations").update(updates).eq("id", conversation.id);
      // TODO: ai_summaries table not in types yet
      // const { data: sumData } = await supabase.from("ai_summaries").select("summary").eq("conversation_id", conversation.id).maybeSingle();
      // if (sumData) setSummary(sumData.summary);

      // Load counterpart's current status fresh from DB
      const counterpartId = isAdmin ? conversation.user_id : adminProfile?.user_id ?? null;
      if (counterpartId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, last_seen")
          .eq("user_id", counterpartId)
          .maybeSingle();
        if (profile) {
          setCounterpartStatus(profile.status);
          setLastSeen(profile.last_seen ?? null);
        }
      }
    })();
  }, [conversation.id, user, isAdmin, adminProfile?.user_id]);

  // Real-time status updates — re-runs whenever counterpartId becomes available
  useEffect(() => {
    const counterpartId = isAdmin ? conversation.user_id : adminProfile?.user_id ?? null;
    if (!counterpartId) return; // wait until adminProfile loads for client side

    // Also fetch fresh status right now (in case we missed an update)
    void supabase
      .from("profiles")
      .select("status, last_seen")
      .eq("user_id", counterpartId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCounterpartStatus(data.status);
          setLastSeen(data.last_seen ?? null);
        }
      });

    const ch = supabase.channel(`presence-watch:${counterpartId}-${conversation.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${counterpartId}`,
      }, (payload) => {
        const p = payload.new as { status: string; last_seen: string };
        setCounterpartStatus(p.status);
        setLastSeen(p.last_seen ?? null);
      })
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [conversation.id, isAdmin, conversation.user_id, adminProfile?.user_id]);

  // For client: also sync from adminProfile prop whenever it updates
  // (adminProfile is kept live by ChatPage's own subscription)
  useEffect(() => {
    if (!isAdmin && adminProfile) {
      setCounterpartStatus(adminProfile.status);
      if (adminProfile.last_seen) setLastSeen(adminProfile.last_seen);
    }
  }, [isAdmin, adminProfile?.status, adminProfile?.last_seen]);

  // Realtime messages
  useEffect(() => {
    if (!conversation || !user) return;
    const ch = supabase.channel(`conv:${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          if (exists) return prev;
          const hasTemp = prev.some((m) => m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.content === msg.content);
          if (hasTemp) return prev.map((m) => (m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.content === msg.content) ? msg : m);
          return [...prev, msg];
        });

        if (msg.sender_id !== user.id) {
          // I received a message while the chat is open → mark as SEEN immediately
          console.log("[MessageStatus] Marking message as seen:", msg.id);
          const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
          void supabase.from("conversations").update(updates).eq("id", conversation.id);
          void supabase.from("messages").update({ status: "seen" }).eq("id", msg.id).then(({ error }) => {
            if (error) console.error("[MessageStatus] Seen update error:", error);
            else {
              console.log("[MessageStatus] Message marked as seen:", msg.id);
              setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "seen" } : m));
            }
          });
        }
        // Note: sender's own messages start as "sent" from the DB insert
        // They become "delivered" when the recipient's device receives them (see below)
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const msg = payload.new as Message;
        console.log("[MessageStatus] UPDATE received:", msg.id, "status:", msg.status);
        setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== user.id) {
          setTheyTyping(true);
          setTimeout(() => setTheyTyping(false), 2500);
          // Always notify when typing, even if app is visible
          const typingName = isAdmin
            ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "A client")
            : (adminProfile?.display_name ?? "Ajibola");
          void sendPushNotification(
            `✍️ ${typingName} is typing...`,
            "Open the chat to reply.",
            { tag: "typing-indicator" }
          );
        }
      })
      .subscribe();
    typingChannelRef.current = ch;

    // When I open the chat:
    // 1. Mark all messages FROM the counterpart as SEEN (I'm reading them)
    // 2. Mark all messages FROM me that are still "sent" as DELIVERED
    //    (because the counterpart is connected — they have a realtime subscription)
    void (async () => {
      // For clients: adminProfile may not be loaded yet — fall back to RPC
      let counterpartId: string | null = isAdmin
        ? conversation.user_id
        : (adminProfile?.user_id ?? null);

      if (!counterpartId && !isAdmin) {
        const { data } = await supabase.rpc("get_admin_user_id");
        counterpartId = data ?? null;
      }

      // Mark counterpart's messages as seen
      if (counterpartId) {
        const { data: seenMsgs, error: seenErr } = await supabase
          .from("messages")
          .update({ status: "seen" })
          .eq("conversation_id", conversation.id)
          .eq("sender_id", counterpartId)
          .neq("status", "seen")
          .select("id");
        if (seenErr) {
          console.error("Seen status update error:", seenErr);
        }
        if (seenMsgs?.length) {
          const ids = new Set(seenMsgs.map((m: { id: string }) => m.id));
          setMessages((prev) => prev.map((m) => ids.has(m.id) ? { ...m, status: "seen" } : m));
        }
      }

      // Mark MY sent messages as delivered — the counterpart is online/connected
      // (they have a realtime subscription active, so they received the message)
      if (counterpartId) {
        const { data: deliveredMsgs, error: deliverErr } = await supabase
          .from("messages")
          .update({ status: "delivered" })
          .eq("conversation_id", conversation.id)
          .eq("sender_id", user.id)
          .eq("status", "sent")
          .select("id");
        if (deliverErr) {
          console.error("Delivered status update error:", deliverErr);
        }
        if (deliveredMsgs?.length) {
          const ids = new Set(deliveredMsgs.map((m: { id: string }) => m.id));
          setMessages((prev) => prev.map((m) => ids.has(m.id) ? { ...m, status: "delivered" } : m));
        }
      }
    })();

    return () => { void supabase.removeChannel(ch); typingChannelRef.current = null; };
  }, [conversation.id, user, isAdmin]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, theyTyping]);

  // Scroll to bottom when mobile keyboard opens (visualViewport shrinks)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  function broadcastTyping() {
    if (!typingChannelRef.current || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    void typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
    typingTimeoutRef.current = setTimeout(() => {}, 1500);
  }

  // ---- AI Summary ----
  async function generateSummary() {
    if (!isAdmin || messages.length === 0) return;
    setSummaryLoading(true);
    setShowSummary(true);
    try {
      // Build a plain-text transcript
      const transcript = messages
        .filter((m) => m.type === "text" && m.content)
        .map((m) => `${m.sender_id === user?.id ? "Admin" : "User"}: ${m.content}`)
        .join("\n");

      if (!transcript.trim()) {
        setSummary("No text messages to summarize yet.");
        setSummaryLoading(false);
        return;
      }

      // Use Supabase Edge Function if available, otherwise generate client-side summary
      const { data: fnData, error: fnError } = await supabase.functions.invoke("summarize-thread", {
        body: { transcript, conversationId: conversation.id },
      });

      let summaryText: string;
      if (!fnError && fnData?.summary) {
        summaryText = fnData.summary as string;
      } else {
        // Fallback: extract key sentences client-side
        const sentences = transcript.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);
        const picked = sentences.slice(0, 3).join(". ");
        summaryText = picked
          ? `Thread recap (${messages.length} messages): ${picked}.`
          : `This conversation has ${messages.length} messages exchanged between the user and admin.`;
      }

      setSummary(summaryText);
      // TODO: ai_summaries table not in types yet
      // Persist summary
      // await supabase.from("ai_summaries").upsert({
      //   conversation_id: conversation.id,
      //   summary: summaryText,
      //   generated_by: user?.id,
      //   generated_at: new Date().toISOString(),
      // }, { onConflict: "conversation_id" });
    } catch {
      toast.error("Failed to generate summary");
    }
    setSummaryLoading(false);
  }

  // ---- File upload ----
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const previews: FilePreview[] = files.map((f) => {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      return {
        file: f,
        previewUrl: (isImage || isVideo) ? URL.createObjectURL(f) : null,
        kind: isImage ? "image" : isVideo ? "video" : "file",
      };
    });
    setFilePreviews((prev) => [...prev, ...previews]);
    e.target.value = "";
  }

  function removePreview(idx: number) {
    setFilePreviews((prev) => {
      const next = [...prev];
      if (next[idx].previewUrl) URL.revokeObjectURL(next[idx].previewUrl!);
      next.splice(idx, 1);
      return next;
    });
  }

  async function uploadAndSendFiles() {
    if (!user || !filePreviews.length) return;
    setUploading(true);

    // Optimistic: insert placeholder messages immediately so UI updates instantly
    const optimisticIds: string[] = [];
    for (const fp of filePreviews) {
      const tempId = `temp-${crypto.randomUUID()}`;
      optimisticIds.push(tempId);
      const optimistic: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: user.id,
        content: fp.file.name,
        type: fp.kind === "image" ? "image" : fp.kind === "video" ? "file" : "file",
        status: "sent",
        file_url: fp.previewUrl,
        file_name: fp.file.name,
        file_size: fp.file.size,
        created_at: new Date().toISOString(),
        pinned: false,
        deleted_at: null,
        replied_to_id: null,
      };
      setMessages((prev) => [...prev, optimistic]);
    }

    // Upload all files in parallel — bucket is public so getPublicUrl works
    await Promise.all(filePreviews.map(async (fp, idx) => {
      const ext = fp.file.name.split(".").pop() ?? "bin";
      const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-files")
        .upload(path, fp.file, { contentType: fp.file.type });

      if (upErr) {
        toast.error(`Failed to upload ${fp.file.name}`);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticIds[idx]));
        return;
      }

      // Public URL — no expiry, works forever
      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      const msgType = fp.kind === "image" ? "image" : "file";

      const { data: inserted } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: fp.file.name,
        type: msgType,
        file_url: fileUrl,
        file_name: fp.file.name,
        file_size: fp.file.size,
      }).select("*").single();

      if (inserted) {
        setMessages((prev) =>
          prev.map((m) => m.id === optimisticIds[idx] ? (inserted as Message) : m)
        );
      }
    }));

    setFilePreviews([]);
    setUploading(false);
  }

  // ---- Voice recording ----
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up analyser for real waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Animate waveform bars from real audio data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      function animate() {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 24 }, (_, i) => {
          const idx = Math.floor((i / 24) * dataArray.length);
          return Math.max(8, (dataArray[idx] / 255) * 100);
        });
        setWaveformBars(bars);
        animFrameRef.current = requestAnimationFrame(animate);
      }
      animate();
      
      // Pick the best supported format - prioritize MP4 for mobile compatibility
      const mimeType = [
        "audio/mp4",                    // Best mobile support (AAC codec)
        "audio/webm;codecs=opus",       // Good desktop support
        "audio/webm",                   // Fallback webm
        "audio/ogg;codecs=opus",        // Fallback ogg
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      
      console.log("[VoiceNote] Selected MIME type:", mimeType || "default");
      console.log("[VoiceNote] Supported formats:", [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].map(m => `${m}: ${MediaRecorder.isTypeSupported(m)}`));
      
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { 
        if (e.data.size > 0) {
          console.log("[VoiceNote] Data chunk:", e.data.size, "bytes, type:", e.data.type);
          audioChunksRef.current.push(e.data); 
        }
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setWaveformBars(Array(24).fill(10));
        console.log("[VoiceNote] Recording stopped, total chunks:", audioChunksRef.current.length);
        void sendVoiceNote(mimeType);
      };
      mr.start(100); // collect data every 100ms for reliability
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error("Recording error:", err);
      toast.error("Microphone access denied or not supported");
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function sendVoiceNote(mimeType?: string) {
    if (!user || !audioChunksRef.current.length) return;
    setUploading(true);
    
    try {
      // Determine file extension and final MIME type from recorded format
      let ext = "webm";
      let finalMime = mimeType || "audio/webm";
      
      if (mimeType?.includes("mp4") || mimeType?.includes("m4a")) {
        ext = "m4a";
        finalMime = "audio/mp4";
      } else if (mimeType?.includes("ogg")) {
        ext = "ogg";
        finalMime = "audio/ogg";
      } else if (mimeType?.includes("webm")) {
        ext = "webm";
        finalMime = "audio/webm";
      }
      
      console.log("[VoiceNote] Creating blob with MIME:", finalMime, "Extension:", ext);
      const blob = new Blob(audioChunksRef.current, { type: finalMime });
      console.log("[VoiceNote] Blob size:", blob.size, "bytes, type:", blob.type);
      
      if (blob.size < 100) {
        toast.error("Recording too short, please try again");
        setUploading(false);
        return;
      }
      
      const fileName = `voice-${crypto.randomUUID()}.${ext}`;
      const path = `${conversation.id}/${fileName}`;
      
      console.log("[VoiceNote] Uploading to:", path);
      const { error: upErr } = await supabase.storage
        .from("chat-files")
        .upload(path, blob, { contentType: finalMime, upsert: false });
      
      if (upErr) {
        console.error("Voice upload error:", upErr);
        toast.error("Failed to upload voice note: " + upErr.message);
        setUploading(false);
        return;
      }
      
      // Public URL — no expiry
      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;
      console.log("[VoiceNote] Public URL:", fileUrl);

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: null,
        type: "voice",
        file_url: fileUrl,
        file_name: fileName,
        file_size: blob.size,
      });

      if (msgErr) {
        console.error("Voice message insert error:", msgErr);
        toast.error("Failed to save voice note: " + msgErr.message);
        setUploading(false);
        return;
      }

      console.log("[VoiceNote] ✅ Voice note sent successfully");
      toast.success("Voice note sent!");
      setUploading(false);
    } catch (err) {
      console.error("Voice note error:", err);
      toast.error("Failed to send voice note");
      setUploading(false);
    }
  }

  // ---- Edit message ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function saveEdit(msgId: string) {
    console.log("[Edit] Starting edit for message:", msgId, "New text:", editText);
    
    if (!editText.trim()) {
      console.log("[Edit] Empty text, canceling");
      setEditingId(null);
      return;
    }
    
    if (!msgId) {
      console.error("[Edit] No message ID provided");
      toast.error("Cannot edit message: Invalid ID");
      return;
    }
    
    try {
      console.log("[Edit] Calling Supabase update...");
      const { error } = await supabase
        .from("messages")
        .update({ content: editText.trim() })
        .eq("id", msgId);
      
      if (error) {
        console.error("[Edit] Supabase error:", error);
        toast.error(`Failed to edit message: ${error.message}`);
      } else {
        console.log("[Edit] Message edited successfully in database");
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: editText.trim() } : m));
        setEditingId(null);
        toast.success("Message edited");
      }
    } catch (err) {
      console.error("[Edit] Exception:", err);
      toast.error("Failed to edit message");
    }
  }

  // ---- Context menu (long press / right click) ----
  const [ctxMenu, setCtxMenu] = useState<{ msgId: string; x: number; y: number; mine: boolean; type: string } | null>(null);
  const [reactionsMenu, setReactionsMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  // Bottom sheet for mobile (shows instead of floating menu)
  const [bottomSheet, setBottomSheet] = useState<{ msgId: string; mine: boolean; type: string } | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressDataRef = useRef<{ msg: Message; mine: boolean; x: number; y: number } | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const ctxOpenTimeRef = useRef(0);

  const isMobile = () => window.matchMedia("(pointer: coarse)").matches;

  function openCtxMenu(x: number, y: number, msg: Message, mine: boolean) {
    ctxOpenTimeRef.current = Date.now();
    if (isMobile()) {
      // Mobile — bottom sheet
      setBottomSheet({ msgId: msg.id, mine, type: msg.type });
      // Reactions bar still shows at top of sheet, no position needed
      setReactionsMenu({ msgId: msg.id, x: 0, y: 0 });
    } else {
      // Desktop — floating menu at cursor
      const menuW = 200, menuH = 220;
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      x = Math.max(8, Math.min(x, vw - menuW - 8));
      y = Math.max(8, Math.min(y, vh - menuH - 8));
      setCtxMenu({ msgId: msg.id, x, y, mine, type: msg.type });
      setReactionsMenu({ msgId: msg.id, x: Math.max(8, Math.min(x, vw - 290)), y: Math.max(8, y - 64) });
    }
  }

  function closeMenus() {
    if (bottomSheet) {
      setSheetClosing(true);
      setTimeout(() => { setBottomSheet(null); setSheetClosing(false); }, 240);
    }
    setCtxMenu(null);
    setReactionsMenu(null);
  }

  function startLongPress(e: React.TouchEvent, msg: Message, mine: boolean) {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressDataRef.current = { msg, mine, x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      if (longPressDataRef.current) {
        const { msg, mine, x, y } = longPressDataRef.current;
        openCtxMenu(x, y, msg, mine);
        if ("vibrate" in navigator) navigator.vibrate(50);
        longPressDataRef.current = null;
      }
    }, 450);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    // Only cancel if finger moved more than 10px — allows slight wobble
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      longPressDataRef.current = null;
    }
  }

  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    longPressDataRef.current = null;
    touchStartPos.current = null;
  }

  // Close menus on outside pointer (desktop only — mobile uses backdrop tap)
  useEffect(() => {
    if (!ctxMenu && !reactionsMenu) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (Date.now() - ctxOpenTimeRef.current < 400) return;
      const target = e.target as Element | null;
      if (target?.closest("[data-ctx-menu]") || target?.closest("[data-reactions-menu]")) return;
      setCtxMenu(null);
      setReactionsMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [ctxMenu, reactionsMenu]);

  // ---- Delete for everyone (soft-delete — shows "This message was deleted" to both sides) ----
  async function deleteForEveryone(msgId: string) {
    if (!msgId) return;
    setMessages((prev) => prev.map((m) => m.id === msgId
      ? { ...m, deleted_at: new Date().toISOString(), content: "This message was deleted" }
      : m
    ));
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: "This message was deleted" })
      .eq("id", msgId);
    if (error) {
      toast.error("Failed to delete message");
      // revert
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deleted_at: null } : m));
    } else {
      toast.success("Message deleted for everyone");
    }
  }

  // ---- Delete for me (local-only hide — other side still sees the message) ----
  function deleteForMe(msgId: string) {
    hideMessageForMe(msgId);
    toast.success("Message removed for you");
  }

  // Keep old name as alias so any other call sites still work
  async function deleteMessage(msgId: string) {
    await deleteForEveryone(msgId);
  }

  // ---- Send text ----
  async function send(e: FormEvent) {
    e.preventDefault();
    if (filePreviews.length > 0) { await uploadAndSendFiles(); return; }
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const repliedToId = replyingTo?.id ?? null;
    setReplyingTo(null);

    // Optimistic insert — show message immediately
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
      type: "text",
      status: "sent",
      file_url: null,
      file_name: null,
      file_size: null,
      created_at: new Date().toISOString(),
      pinned: false,
      deleted_at: null,
      replied_to_id: repliedToId,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data: inserted, error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
      type: "text",
      status: "sent",  // Explicitly set initial status
      replied_to_id: repliedToId,
    }).select("*").single();

    if (error) {
      toast.error("Failed to send");
      setText(content);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } else if (inserted) {
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => m.id === tempId ? (inserted as Message) : m));
    }
    setSending(false);
  }

  // ---- Call functions ----
  // Active call UI is handled globally in dashboard.tsx via window.__setActiveCall
  // Expose initiateCall globally so missed call messages can trigger callback
  // Use ref to avoid stale closure issues
  const initiateCallRef = useRef<((callType: CallType) => void) | null>(null);
  useEffect(() => {
    initiateCallRef.current = (callType: CallType) => void initiateCall(callType);
    (window as any).__initiateCall = initiateCallRef.current;
    return () => { delete (window as any).__initiateCall; };
  });

  async function initiateCall(callType: CallType) {
    if (!user) {
      toast.error("You must be logged in to make calls");
      return;
    }

    if (!conversation || !conversation.id) {
      toast.error("No active conversation");
      return;
    }

    // For client: get receiverId from adminProfile state, or fetch it fresh if not loaded yet
    let receiverId = isAdmin ? conversation.user_id : (adminProfile?.user_id ?? "");

    if (!isAdmin && !receiverId) {
      // adminProfile hasn't loaded yet — fetch admin user_id via secure RPC
      // (direct user_roles query is blocked by RLS for non-admin users)
      try {
        console.log("[Call] Fetching admin user_id via RPC");
        const { data, error } = await supabase.rpc("get_admin_user_id");
        if (error) {
          console.error("[Call] RPC error:", error);
          toast.error("Could not find admin user. Please try again.");
          return;
        }
        receiverId = data ?? "";
        console.log("[Call] Admin user_id:", receiverId);
      } catch (err) {
        console.error("[Call] Exception fetching admin:", err);
        toast.error("Could not find admin user. Please try again.");
        return;
      }
    }

    if (!receiverId) {
      toast.error("Cannot find receiver. Please try again.");
      return;
    }

    if (receiverId === user.id) {
      toast.error("You cannot call yourself.");
      return;
    }

    // ── Offline guard: check receiver is actually online before ringing ────────
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("status")
      .eq("user_id", receiverId)
      .maybeSingle();

    if (!receiverProfile || receiverProfile.status !== "online") {
      toast.error(
        isAdmin
          ? "This client is currently offline. They will see a missed call when they come back."
          : "Ajibola is currently offline. Try again when they're online.",
        { duration: 4000 }
      );
      return;
    }

    console.log("[Call] Initiating", callType, "call to", receiverId);

    try {
      toast.loading(`Starting ${callType} call...`, { id: "call-toast" });

      // Get receiver profile for the active call screen
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", receiverId)
        .maybeSingle();

      console.log("[Call] Receiver profile:", profile);

      // Initiate the call — this acquires media and opens signaling
      const call = await callManager.initiateCall(conversation.id, receiverId, callType, user.id);
      console.log("[Call] Call initiated:", call);
      
      toast.dismiss("call-toast");

      // NOW set up the active call screen (after callManager is ready)
      const setActiveCallGlobal = (window as any).__setActiveCall;
      if (setActiveCallGlobal) {
        setActiveCallGlobal(call, profile);
        console.log("[Call] Active call screen set");
      } else {
        console.warn("[Call] __setActiveCall not found on window");
      }

      // Fire push notification to receiver
      void supabase.functions.invoke("notify-incoming-call", {
        body: {
          record: {
            id: call.id,
            receiver_id: receiverId,
            initiator_id: user.id,
            call_type: callType,
            conversation_id: conversation.id,
            status: "ringing",
          },
        },
      });

      toast.success(`${callType === "video" ? "Video" : "Voice"} call started — waiting for answer`);
    } catch (err: any) {
      toast.dismiss("call-toast");
      console.error("[Call] Failed to initiate:", err);
      console.error("[Call] Error details:", {
        name: err?.name,
        message: err?.message,
        stack: err?.stack
      });
      
      // Show the actual error message from CallManager
      const errorMsg = err?.message || "Failed to start call. Please check camera/microphone permissions.";
      toast.error(errorMsg, { duration: 5000 });
    }
  }

  // Diagnostic test function for troubleshooting
  async function testMedia() {
    toast.loading("Testing camera and microphone...", { id: "media-test" });
    const result = await testMediaAccess("video");
    toast.dismiss("media-test");
    
    if (result.success) {
      toast.success(result.message, { duration: 5000 });
      console.log("[MediaTest] Success details:", result.details);
    } else {
      toast.error(result.message, { duration: 8000 });
      console.error("[MediaTest] Error details:", result.details);
    }
  }

  // Expose test function globally for debugging
  useEffect(() => {
    (window as any).__testMedia = testMedia;
    return () => { delete (window as any).__testMedia; };
  }, []);


  async function answerCall(call: Call) {
    if (!user) return;
    // Answering is now handled globally in dashboard.tsx via window.__answerCall
    const answerGlobal = (window as any).__answerCall;
    if (answerGlobal) {
      await answerGlobal(call);
    }
  }

  async function declineCall(call: Call) {
    if (!user) return;
    // Clear missed call timer
    if ((call as any)._missedTimer) {
      clearTimeout((call as any)._missedTimer);
    }
    try {
      await callManager.declineCall(call.id);
      toast.info("Call declined");
    } catch (err) {
      console.error("Failed to decline call:", err);
      toast.error("Failed to decline call");
    }
  }

  const [activeCallOnConv, setActiveCallOnConv] = useState<{ id: string; call_type: "voice" | "video"; initiator_id: string } | null>(null);

  // Check for ongoing call on this conversation (for JOIN button)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("calls")
      .select("id, call_type, initiator_id")
      .eq("conversation_id", conversation.id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => setActiveCallOnConv(data ?? null));

    const ch = supabase.channel(`conv-calls:${conversation.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const call = payload.new as any;
        if (call.status === "active") setActiveCallOnConv({ id: call.id, call_type: call.call_type, initiator_id: call.initiator_id });
        else if (call.status === "ended" || call.status === "missed" || call.status === "declined") setActiveCallOnConv(null);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [conversation.id, user]);

  // ---- Schedule call ----
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleType, setScheduleType] = useState<"voice" | "video">("voice");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduledCalls, setScheduledCalls] = useState<any[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Load scheduled calls
  useEffect(() => {
    if (!user) return;
    supabase
      .from("scheduled_calls")
      .select("*")
      .eq("conversation_id", conversation.id)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => setScheduledCalls(data ?? []));
  }, [conversation.id, user]);

  async function saveScheduledCall() {
    if (!user || !scheduleDate || !scheduleTime) return;
    setScheduleSaving(true);
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const callLink = `${window.location.origin}/dashboard/chat?join=${crypto.randomUUID()}`;
    const { data, error } = await supabase.from("scheduled_calls").insert({
      conversation_id: conversation.id,
      created_by: user.id,
      call_type: scheduleType,
      scheduled_at: scheduledAt,
      title: scheduleTitle || `${scheduleType === "video" ? "Video" : "Voice"} call`,
      call_link: callLink,
    }).select("*").single();
    if (!error && data) {
      setScheduledCalls(prev => [...prev, data]);
      toast.success("Call scheduled!");
      setShowSchedule(false);
      setScheduleDate(""); setScheduleTime(""); setScheduleTitle("");
    } else {
      toast.error("Failed to schedule call");
    }
    setScheduleSaving(false);
  }

  async function cancelScheduledCall(id: string) {
    await supabase.from("scheduled_calls").update({ status: "cancelled" }).eq("id", id);
    setScheduledCalls(prev => prev.filter(c => c.id !== id));
    toast.success("Call cancelled");
  }

  const counterpartName = isAdmin
    ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "User")
    : (adminProfile?.display_name ?? "Ajibola Gbenga Joseph");
  const counterpartInitial = counterpartName[0].toUpperCase();
  // Show admin as online in chat header only if they're actually online
  const isOnline = counterpartStatus === "online";
  const statusLabel = useLastSeenLabel(lastSeen, isOnline);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0b141a" }}>
      {/* Chat header */}
      <header className="shrink-0 flex items-center gap-2.5 px-3 py-2" style={{ background: "#202c33", borderBottom: "1px solid #1a2530", minHeight: "60px" }}>
        {/* Back button — mobile */}
        <button
          onClick={onBack}
          className="md:hidden flex items-center justify-center h-9 w-9 rounded-full text-[#aebac1] hover:bg-[#2a3942] active:scale-90 transition-all shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        {/* Avatar */}
        <div className="relative shrink-0">
          {!isAdmin && adminProfile?.avatar_url ? (
            <img src={adminProfile.avatar_url} alt={counterpartName} className="h-10 w-10 rounded-full object-cover ring-2 ring-[#2a3942]" />
          ) : isAdmin && conversation.profile?.avatar_url ? (
            <img src={conversation.profile.avatar_url} alt={counterpartName} className="h-10 w-10 rounded-full object-cover ring-2 ring-[#2a3942]" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] text-white text-[15px] font-bold shadow-md">{counterpartInitial}</div>
          )}
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202c33] ${isOnline ? "bg-[#25d366]" : "bg-[#8696a0]"}`} />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px] text-[#e9edef] truncate leading-tight">{counterpartName}</div>
          <div className={`text-[12px] leading-tight mt-0.5 ${isOnline ? "text-[#25d366]" : "text-[#8696a0]"}`}>
            {statusLabel}
          </div>
        </div>

        {/* JOIN active call */}
        {activeCallOnConv && activeCallOnConv.initiator_id !== user?.id && (
          <button
            onClick={async () => {
              const { data: call } = await supabase.from("calls").select("*").eq("id", activeCallOnConv.id).single();
              if (!call) { toast.error("Call not found"); return; }
              const answerFn = (window as any).__answerCall;
              if (answerFn) void answerFn(call);
              else toast.error("Please go to the dashboard to join the call");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25d366] text-white text-xs font-bold shadow-lg animate-pulse shrink-0"
          >
            {activeCallOnConv.call_type === "video" ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
            JOIN
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-0 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); initiateCall("video"); }} title="Video call"
            className="h-9 w-9 flex items-center justify-center rounded-full text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all">
            <Video className="h-[18px] w-[18px]" />
          </button>
          <div className="relative shrink-0">
            <div className="flex items-center">
              <button onClick={(e) => { e.stopPropagation(); initiateCall("voice"); }} title="Voice call"
                className="h-9 w-9 flex items-center justify-center rounded-full text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all">
                <Phone className="h-[18px] w-[18px]" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowCallDropdown(v => !v); }}
                className="h-7 w-5 flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            {showCallDropdown && (
              <div className="absolute right-0 top-full mt-1.5 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[190px] animate-fade-up"
                style={{ background: "#1f2c34", border: "1px solid #2a3942" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { initiateCall("voice"); setShowCallDropdown(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors text-left">
                  <Phone className="h-4 w-4 text-[#8696a0]" /> Voice call
                </button>
                <button onClick={() => { initiateCall("video"); setShowCallDropdown(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors text-left" style={{ borderTop: "1px solid #2a3942" }}>
                  <Video className="h-4 w-4 text-[#8696a0]" /> Video call
                </button>
                <button onClick={() => { setShowSchedule(true); setShowCallDropdown(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors text-left" style={{ borderTop: "1px solid #2a3942" }}>
                  <Calendar className="h-4 w-4 text-[#8696a0]" /> Schedule call
                </button>
              </div>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => { setShowSummary((v) => !v); if (!summary) void generateSummary(); }}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-full text-[#aebac1] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all" title="AI Summary">
              <Sparkles className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </header>

      {/* AI Summary panel */}
      {isAdmin && showSummary && (
        <div className="border-b border-[#2a3942] px-4 py-3 shrink-0" style={{ background: "#1f2c34" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Sparkles className="h-4 w-4 text-[#00a884] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#00a884] mb-1">Conversation Summary</div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#8696a0]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
                  </div>
                ) : (
                  <p className="text-xs text-[#e9edef]/80 leading-relaxed">{summary ?? "No summary yet."}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => void generateSummary()} className="text-xs text-[#00a884] hover:underline" disabled={summaryLoading}>Refresh</button>
              <button onClick={() => setShowSummary(false)} className="text-[#8696a0] hover:text-[#e9edef] p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming call is now handled by the global modal in dashboard.tsx */}
      {/* Active call UI is now handled globally in dashboard.tsx */}

      {/* ── Schedule Call Modal ──────────────────────────────────────────── */}
      {showSchedule && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/70 p-4" onClick={() => setShowSchedule(false)}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#1f2c34" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3942]">
              <h3 className="font-semibold text-base text-[#e9edef]">Schedule a call</h3>
              <button onClick={() => setShowSchedule(false)} className="text-[#8696a0] hover:text-[#e9edef]"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Call type */}
              <div className="flex gap-2">
                <button onClick={() => setScheduleType("voice")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${scheduleType === "voice" ? "bg-[#00a884] text-white border-[#00a884]" : "border-[#2a3942] text-[#8696a0] hover:bg-[#2a3942]"}`}>
                  <Phone className="h-4 w-4" /> Voice
                </button>
                <button onClick={() => setScheduleType("video")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${scheduleType === "video" ? "bg-[#00a884] text-white border-[#00a884]" : "border-[#2a3942] text-[#8696a0] hover:bg-[#2a3942]"}`}>
                  <Video className="h-4 w-4" /> Video
                </button>
              </div>
              {/* Title */}
              <div>
                <label className="text-xs text-[#8696a0] mb-1 block">Title (optional)</label>
                <input value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} placeholder="e.g. Project discussion" className="w-full rounded-xl border border-[#2a3942] bg-[#2a3942] px-3 py-2.5 text-sm outline-none focus:border-[#00a884] text-[#e9edef] placeholder:text-[#8696a0]" />
              </div>
              {/* Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#8696a0] mb-1 block">Date</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full rounded-xl border border-[#2a3942] bg-[#2a3942] px-3 py-2.5 text-sm outline-none focus:border-[#00a884] text-[#e9edef]" />
                </div>
                <div>
                  <label className="text-xs text-[#8696a0] mb-1 block">Time</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full rounded-xl border border-[#2a3942] bg-[#2a3942] px-3 py-2.5 text-sm outline-none focus:border-[#00a884] text-[#e9edef]" />
                </div>
              </div>
              <button
                onClick={saveScheduledCall}
                disabled={!scheduleDate || !scheduleTime || scheduleSaving}
                className="w-full py-3 rounded-xl bg-[#00a884] text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {scheduleSaving ? "Scheduling..." : "Schedule Call"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scheduled calls banner ───────────────────────────────────────── */}
      {scheduledCalls.length > 0 && (
        <div className="border-b border-[#2a3942] px-4 py-2 shrink-0 space-y-1.5" style={{ background: "#1f2c34" }}>
          {scheduledCalls.map(sc => {
            const dt = new Date(sc.scheduled_at);
            const isToday = dt.toDateString() === new Date().toDateString();
            const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const dateStr = isToday ? "Today" : dt.toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <div key={sc.id} className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${sc.call_type === "video" ? "bg-[#53bdeb]/20 text-[#53bdeb]" : "bg-[#00a884]/20 text-[#00a884]"}`}>
                  {sc.call_type === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-[#e9edef]">{sc.title}</div>
                  <div className="text-[11px] text-[#8696a0] flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {dateStr} at {timeStr}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { navigator.clipboard.writeText(sc.call_link); toast.success("Link copied!"); }}
                    className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
                    title="Copy call link"
                  >
                    <Link className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => initiateCall(sc.call_type)}
                    className="px-2.5 py-1 rounded-full bg-[#00a884] text-white text-[11px] font-semibold hover:opacity-90"
                  >
                    Start
                  </button>
                  <button onClick={() => cancelScheduledCall(sc.id)} className="p-1.5 rounded-full text-[#8696a0] hover:text-[#f15c6d] transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          background: "#0b141a",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.6'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          WebkitOverflowScrolling: "touch",
          padding: "12px 8px",
        } as React.CSSProperties}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 select-none">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,168,132,0.08)", border: "1.5px solid rgba(0,168,132,0.12)" }}>
              <MessageCircle className="h-7 w-7 text-[#00a884] opacity-60" />
            </div>
            <p className="text-[#8696a0] text-sm">No messages yet — say hello 👋</p>
          </div>
        )}
        {messages.filter((m) => !hiddenIds.has(m.id)).map((m, i, visibleMsgs) => {
          const mine = m.sender_id === user?.id;
          const prev = visibleMsgs[i - 1];
          const next = visibleMsgs[i + 1];
          const showGap = !prev || prev.sender_id !== m.sender_id;
          const isLastInGroup = !next || next.sender_id !== m.sender_id;
          const showAvatar = !mine && isLastInGroup;

          // Date separator
          const msgDate = new Date(m.created_at);
          const prevDate = prev ? new Date(prev.created_at) : null;
          const showDateSep = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
          const today = new Date();
          const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
          let dateSepLabel = "";
          if (showDateSep) {
            if (msgDate.toDateString() === today.toDateString()) dateSepLabel = "Today";
            else if (msgDate.toDateString() === yesterday.toDateString()) dateSepLabel = "Yesterday";
            else dateSepLabel = msgDate.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
          }

          return (
            <div key={m.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full text-[11px] text-[#8696a0] font-medium shadow-sm select-none" style={{ background: "#182229", border: "1px solid #2a3942" }}>
                    {dateSepLabel}
                  </span>
                </div>
              )}

              {/* Message row */}
              <div className={`flex ${mine ? "justify-end" : "justify-start items-end gap-1.5"} ${showGap ? "mt-3" : "mt-0.5"} px-2`}>
                {/* Counterpart avatar */}
                {!mine && (
                  <div className="shrink-0 mb-0.5 w-7">
                    {showAvatar ? (
                      isAdmin ? (
                        conversation.profile?.avatar_url
                          ? <img src={conversation.profile.avatar_url} alt="client" className="h-7 w-7 rounded-full object-cover" />
                          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] text-white text-[10px] font-bold">{counterpartInitial}</div>
                      ) : (
                        adminProfile?.avatar_url
                          ? <img src={adminProfile.avatar_url} alt="admin" className="h-7 w-7 rounded-full object-cover" />
                          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] text-white text-[10px] font-bold">{counterpartInitial}</div>
                      )
                    ) : null}
                  </div>
                )}

                <div className="max-w-[72%] md:max-w-[60%]">
                  {/* Edit mode */}
                  {editingId === m.id ? (
                    <div className="flex items-end gap-2 rounded-2xl border border-[#00a884]/50 bg-[#1f2c34] p-2.5 min-w-[220px] shadow-lg">
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(m.id); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        rows={1}
                        className="flex-1 resize-none bg-transparent outline-none text-sm px-1 max-h-24 text-[#e9edef] leading-relaxed"
                      />
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => void saveEdit(m.id)} className="text-xs text-[#00a884] font-semibold hover:underline">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-[#8696a0] hover:text-[#e9edef]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openCtxMenu(e.clientX, e.clientY, m, mine); }}
                      onTouchStart={(e) => startLongPress(e, m, mine)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={onTouchMove}
                      onTouchCancel={cancelLongPress}
                      className="select-none"
                      style={{ animation: "message-in 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
                    >
                      <MessageBubble
                        message={m}
                        mine={mine}
                        playingId={playingId}
                        setPlayingId={setPlayingId}
                        onDelete={deleteMessage}
                        messages={messages}
                        senderProfile={mine ? null : (isAdmin ? conversation.profile : adminProfile)}
                      />
                    </div>
                  )}

                  {/* Timestamp + read receipt — hidden for images (overlaid inside) */}
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? "justify-end" : "justify-start"} ${m.type === "image" && m.file_url ? "hidden" : ""}`}>
                    <span className="text-[10px] text-[#8696a0] tabular-nums">{formatTime(m.created_at)}</span>
                    {mine && !m.deleted_at && (
                      m.status === "seen"
                        ? <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                        : m.status === "delivered"
                          ? <CheckCheck className="h-3 w-3 text-[#8696a0]" />
                          : <Check className="h-3 w-3 text-[#8696a0]" />
                    )}
                  </div>

                  {/* Reactions */}
                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                      {Object.entries(m.reactions).map(([emoji, userIds]) =>
                        userIds.length > 0 ? (
                          <button
                            key={emoji}
                            onClick={async () => {
                              if (!user) return;
                              const current: Record<string, string[]> = m.reactions ?? {};
                              const users = current[emoji] ?? [];
                              const alreadyReacted = users.includes(user.id);
                              const updated = { ...current, [emoji]: alreadyReacted ? users.filter(id => id !== user.id) : [...users, user.id] };
                              if (updated[emoji].length === 0) delete updated[emoji];
                              setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, reactions: updated } : msg));
                              await supabase.from("messages").update({ reactions: updated }).eq("id", m.id);
                            }}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all active:scale-95 ${
                              userIds.includes(user?.id ?? "") ? "bg-[#00a884]/25 border border-[#00a884]/50" : "bg-[#1f2c34] border border-[#2a3942]"
                            }`}
                          >
                            <span>{emoji}</span>
                            {userIds.length > 1 && <span className="text-[#8696a0] text-[10px]">{userIds.length}</span>}
                          </button>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {theyTyping && (
          <div className="flex justify-start items-end gap-1.5 mt-1 px-4">
            <div className="w-7 shrink-0" />
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm" style={{ background: "#1f2c34" }}>
              <div className="flex gap-[5px] items-center h-3">
                {[0, 160, 320].map((delay) => (
                  <span key={delay} className="h-[6px] w-[6px] rounded-full bg-[#8696a0] animate-typing" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reactions picker — desktop floating, mobile inside bottom sheet */}
      {reactionsMenu && !bottomSheet && (
        <div
          data-reactions-menu
          className="fixed z-[51] flex items-center gap-0.5 px-2.5 py-2 rounded-full shadow-2xl animate-fade-up"
          style={{ left: reactionsMenu.x, top: reactionsMenu.y, background: "#1f2c34", border: "1px solid #2a3942", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          {["👍","❤️","😂","😮","😢","🙏","🔥"].map((emoji) => (
            <button
              key={emoji}
              onClick={async () => {
                if (!user || !reactionsMenu) return;
                const msgId = reactionsMenu.msgId;
                const msg = messages.find(m => m.id === msgId);
                if (!msg) return;
                const current: Record<string, string[]> = msg.reactions ?? {};
                const users = current[emoji] ?? [];
                const alreadyReacted = users.includes(user.id);
                const updated = { ...current, [emoji]: alreadyReacted ? users.filter(id => id !== user.id) : [...users, user.id] };
                if (updated[emoji].length === 0) delete updated[emoji];
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: updated } : m));
                await supabase.from("messages").update({ reactions: updated }).eq("id", msgId);
                setReactionsMenu(null);
                setCtxMenu(null);
              }}
              className="text-[22px] hover:scale-125 transition-transform active:scale-95 p-1 rounded-full hover:bg-[#2a3942]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Desktop floating context menu */}
      {ctxMenu && (
        <div
          data-ctx-menu
          className="fixed z-50 rounded-2xl overflow-hidden min-w-[200px] animate-fade-up"
          style={{ left: ctxMenu.x, top: ctxMenu.y, background: "#1f2c34", border: "1px solid #2a3942", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const msg = messages.find((m) => m.id === ctxMenu.msgId); if (msg) setReplyingTo(msg); setCtxMenu(null); setReactionsMenu(null); }} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] hover:bg-[#2a3942] transition-colors text-left text-[#e9edef] font-medium">
            <Reply className="h-[15px] w-[15px] text-[#8696a0] shrink-0" /> Reply
          </button>
          {ctxMenu.mine && ctxMenu.type === "text" && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const msg = messages.find((m) => m.id === ctxMenu.msgId); if (msg) { setEditText(msg.content ?? ""); setEditingId(msg.id); } setCtxMenu(null); setReactionsMenu(null); }} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] hover:bg-[#2a3942] transition-colors text-left text-[#e9edef] font-medium" style={{ borderTop: "1px solid #2a3942" }}>
              <Pencil className="h-[15px] w-[15px] text-[#8696a0] shrink-0" /> Edit
            </button>
          )}
          {(ctxMenu.mine || isAdmin) && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const id = ctxMenu.msgId; setCtxMenu(null); setReactionsMenu(null); setTimeout(() => deleteForEveryone(id), 50); }} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] hover:bg-[#2a3942] text-[#f15c6d] transition-colors text-left font-medium" style={{ borderTop: "1px solid #2a3942" }}>
              <Trash2 className="h-[15px] w-[15px] shrink-0" /> Delete for everyone
            </button>
          )}
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const id = ctxMenu.msgId; setCtxMenu(null); setReactionsMenu(null); setTimeout(() => deleteForMe(id), 50); }} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] hover:bg-[#2a3942] text-[#8696a0] transition-colors text-left font-medium" style={{ borderTop: "1px solid #2a3942" }}>
            <Trash2 className="h-[15px] w-[15px] shrink-0" /> Delete for me
          </button>
        </div>
      )}

      {/* Mobile bottom sheet — portaled to body */}
      {(bottomSheet || sheetClosing) && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end" style={{ WebkitTapHighlightColor: "transparent" }}>
          {/* Scrim */}
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.45)",
              animation: sheetClosing ? "scrim-out 0.24s ease forwards" : "scrim-in 0.24s ease forwards",
            }}
            onClick={closeMenus}
          />
          {/* Sheet */}
          <div
            className="relative w-full rounded-t-3xl overflow-hidden"
            style={{
              background: "#1f2c34",
              animation: sheetClosing ? "sheet-down 0.24s cubic-bezier(0.4,0,1,1) forwards" : "sheet-up 0.28s cubic-bezier(0.22,1,0.36,1) forwards",
              paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "#3d5260" }} />
            </div>

            {/* Reactions row */}
            <div className="flex items-center justify-around px-4 py-3" style={{ borderBottom: "1px solid #2a3942" }}>
              {["👍","❤️","😂","😮","😢","🙏","🔥"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={async () => {
                    if (!user || !bottomSheet) return;
                    const msgId = bottomSheet.msgId;
                    const msg = messages.find(m => m.id === msgId);
                    if (!msg) return;
                    const current: Record<string, string[]> = msg.reactions ?? {};
                    const users = current[emoji] ?? [];
                    const alreadyReacted = users.includes(user.id);
                    const updated = { ...current, [emoji]: alreadyReacted ? users.filter(id => id !== user.id) : [...users, user.id] };
                    if (updated[emoji].length === 0) delete updated[emoji];
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: updated } : m));
                    await supabase.from("messages").update({ reactions: updated }).eq("id", msgId);
                    closeMenus();
                  }}
                  className="text-[28px] active:scale-90 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action rows */}
            <div className="py-1">
              {/* Reply */}
              <button
                onClick={() => {
                  if (!bottomSheet) return;
                  const msg = messages.find((m) => m.id === bottomSheet.msgId);
                  if (msg) setReplyingTo(msg);
                  closeMenus();
                }}
                className="flex items-center gap-4 w-full px-5 py-3.5 text-[15px] text-[#e9edef] active:bg-[#2a3942] transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#2a3942" }}>
                  <Reply className="h-4 w-4 text-[#8696a0]" />
                </div>
                Reply
              </button>

              {/* Edit — only for own text messages */}
              {bottomSheet?.mine && bottomSheet.type === "text" && (
                <button
                  onClick={() => {
                    if (!bottomSheet) return;
                    const msg = messages.find((m) => m.id === bottomSheet.msgId);
                    if (msg) { setEditText(msg.content ?? ""); setEditingId(msg.id); }
                    closeMenus();
                  }}
                  className="flex items-center gap-4 w-full px-5 py-3.5 text-[15px] text-[#e9edef] active:bg-[#2a3942] transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#2a3942" }}>
                    <Pencil className="h-4 w-4 text-[#8696a0]" />
                  </div>
                  Edit
                </button>
              )}

              {/* Delete for everyone — own messages or admin */}
              {(bottomSheet?.mine || isAdmin) && (
                <button
                  onClick={() => {
                    if (!bottomSheet) return;
                    const id = bottomSheet.msgId;
                    closeMenus();
                    setTimeout(() => deleteForEveryone(id), 260);
                  }}
                  className="flex items-center gap-4 w-full px-5 py-3.5 text-[15px] text-[#f15c6d] active:bg-[#2a3942] transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(241,92,109,0.15)" }}>
                    <Trash2 className="h-4 w-4 text-[#f15c6d]" />
                  </div>
                  Delete for everyone
                </button>
              )}

              {/* Delete for me — always shown */}
              <button
                onClick={() => {
                  if (!bottomSheet) return;
                  const id = bottomSheet.msgId;
                  closeMenus();
                  setTimeout(() => deleteForMe(id), 260);
                }}
                className="flex items-center gap-4 w-full px-5 py-3.5 text-[15px] text-[#8696a0] active:bg-[#2a3942] transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#2a3942" }}>
                  <Trash2 className="h-4 w-4 text-[#8696a0]" />
                </div>
                Delete for me
              </button>
            </div>

            {/* Cancel */}
            <div className="px-4 pt-1">
              <button
                onClick={closeMenus}
                className="w-full py-3.5 rounded-2xl text-[15px] font-semibold text-[#f15c6d] active:opacity-70 transition-opacity"
                style={{ background: "#2a3942" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Composer */}
      <div className="shrink-0" style={{ background: "#111b21", borderTop: "1px solid #1a2530", paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}>

        {/* Reply preview */}
        {replyingTo && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl flex items-center gap-2.5" style={{ background: "#1f2c34", borderLeft: "3px solid #00a884" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-[#00a884] mb-0.5">Replying to</div>
              <div className="text-xs text-[#8696a0] truncate">
                {replyingTo.type === "voice" ? "🎙️ Voice note" : replyingTo.type === "image" ? "🖼️ Image" : replyingTo.type === "file" ? `📎 ${replyingTo.file_name ?? "File"}` : replyingTo.content ?? ""}
              </div>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-[#e9edef] transition-colors p-1 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* File previews */}
        {filePreviews.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-2">
            {filePreviews.map((fp, idx) => (
              <div key={idx} className="relative group">
                {fp.kind === "image" && fp.previewUrl ? (
                  <img src={fp.previewUrl} alt={fp.file.name} className="h-16 w-16 object-cover rounded-xl border border-[#2a3942]" />
                ) : fp.kind === "video" && fp.previewUrl ? (
                  <div className="h-16 w-24 relative rounded-xl border border-[#2a3942] overflow-hidden bg-black">
                    <video src={fp.previewUrl} className="h-full w-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="h-5 w-5 text-white" /></div>
                  </div>
                ) : (
                  <div className="h-16 w-32 flex flex-col items-center justify-center rounded-xl px-2 gap-1" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>
                    <FileText className="h-5 w-5 text-[#8696a0]" />
                    <span className="text-[10px] text-[#8696a0] truncate w-full text-center">{fp.file.name}</span>
                    <span className="text-[9px] text-[#8696a0]">{formatBytes(fp.file.size)}</span>
                  </div>
                )}
                <button onClick={() => removePreview(idx)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#f15c6d] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={send} className="flex items-end gap-2 px-3 pt-2 pb-1">
          {recording ? (
            /* Recording UI */
            <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#2a3942" }}>
              <button type="button" onClick={() => {
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current = null;
                audioChunksRef.current = [];
                setRecording(false);
                setRecordingSeconds(0);
                setWaveformBars(Array(24).fill(10));
              }} className="text-[#8696a0] hover:text-[#f15c6d] transition-colors shrink-0" title="Cancel">
                <X className="h-5 w-5" />
              </button>
              <div className="flex-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <div className="flex items-end gap-[2px] h-6 flex-1">
                  {waveformBars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-full bg-[#00a884] transition-all duration-75" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <span className="text-sm font-mono font-semibold text-red-400 shrink-0 w-10 text-right tabular-nums">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <button type="button" onClick={stopRecording} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white hover:opacity-90 transition-all active:scale-95 shrink-0 shadow-md">
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Hidden file inputs — one per category */}
              <input ref={fileInputRef}   type="file" multiple accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleFileSelect} />
              <input ref={photoInputRef}  type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              <input ref={docInputRef}    type="file" multiple accept="application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleFileSelect} />
              <input ref={audioInputRef}  type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac" className="hidden" onChange={handleFileSelect} />

              {/* Input area */}
              <div className="flex-1 flex items-end gap-1.5 rounded-2xl px-3 py-1.5 min-h-[46px] relative" style={{ background: "#2a3942" }}>

                {/* Attachment picker — portal bottom sheet */}
                {showAttachPicker && createPortal(
                  <div className="fixed inset-0 z-[300] flex flex-col justify-end" style={{ WebkitTapHighlightColor: "transparent" }}>
                    {/* Scrim */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setShowAttachPicker(false)} />

                    {/* Sheet */}
                    <div
                      className="relative w-full"
                      style={{
                        background: "#1f2c34",
                        borderRadius: "20px 20px 0 0",
                        animation: "sheet-up 0.3s cubic-bezier(0.22,1,0.36,1) forwards",
                        paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Drag handle */}
                      <div className="flex justify-center pt-3 pb-2">
                        <div className="w-9 h-[4px] rounded-full" style={{ background: "#3d5260" }} />
                      </div>

                      {/* Title */}
                      <div className="px-5 pb-4" style={{ borderBottom: "1px solid #2a3942" }}>
                        <p className="text-[16px] font-bold text-[#e9edef]">Share</p>
                      </div>

                      {/* 3-column icon grid */}
                      <div className="grid grid-cols-3 px-4 pt-4 pb-2 gap-1">

                        {/* Gallery */}
                        <button type="button" onClick={() => { setShowAttachPicker(false); photoInputRef.current?.click(); }}
                          className="flex flex-col items-center gap-2 py-4 rounded-2xl active:bg-[#2a3942] transition-colors">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}>
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                              <rect x="2" y="5" width="26" height="20" rx="3" fill="white" fillOpacity="0.25"/>
                              <rect x="2" y="5" width="26" height="20" rx="3" stroke="white" strokeWidth="1.8"/>
                              <circle cx="9.5" cy="11.5" r="2.5" fill="white"/>
                              <path d="M2 20l7-7 5 5 4-4 10 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          </div>
                          <span className="text-[12px] font-semibold text-[#e9edef]">Gallery</span>
                        </button>

                        {/* Camera */}
                        <button type="button" onClick={() => { setShowAttachPicker(false); cameraInputRef.current?.click(); }}
                          className="flex flex-col items-center gap-2 py-4 rounded-2xl active:bg-[#2a3942] transition-colors">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #f97316, #ef4444)" }}>
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                              <path d="M11 7l2-2h4l2 2h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4z" stroke="white" strokeWidth="1.8" fill="white" fillOpacity="0.2" strokeLinejoin="round"/>
                              <circle cx="15" cy="15" r="4" stroke="white" strokeWidth="1.8"/>
                              <circle cx="15" cy="15" r="1.5" fill="white"/>
                            </svg>
                          </div>
                          <span className="text-[12px] font-semibold text-[#e9edef]">Camera</span>
                        </button>

                        {/* Document */}
                        <button type="button" onClick={() => { setShowAttachPicker(false); docInputRef.current?.click(); }}
                          className="flex flex-col items-center gap-2 py-4 rounded-2xl active:bg-[#2a3942] transition-colors">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                              <path d="M7 4h12l6 6v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.8"/>
                              <path d="M19 4v6h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="10" y1="14" x2="20" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                              <line x1="10" y1="18" x2="20" y2="18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                              <line x1="10" y1="22" x2="16" y2="22" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <span className="text-[12px] font-semibold text-[#e9edef]">Document</span>
                        </button>

                        {/* Audio */}
                        <button type="button" onClick={() => { setShowAttachPicker(false); audioInputRef.current?.click(); }}
                          className="flex flex-col items-center gap-2 py-4 rounded-2xl active:bg-[#2a3942] transition-colors">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #ec4899, #be185d)" }}>
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                              <path d="M12 22V8l14-3v14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="9" cy="22" r="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.8"/>
                              <circle cx="23" cy="19" r="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.8"/>
                            </svg>
                          </div>
                          <span className="text-[12px] font-semibold text-[#e9edef]">Audio</span>
                        </button>

                        {/* Any file */}
                        <button type="button" onClick={() => { setShowAttachPicker(false); fileInputRef.current?.click(); }}
                          className="flex flex-col items-center gap-2 py-4 rounded-2xl active:bg-[#2a3942] transition-colors">
                          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                              <path d="M24 14l-9.5 9.5a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.6 5.6L11.6 21a2 2 0 0 1-2.8-2.8l8.5-8.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="text-[12px] font-semibold text-[#e9edef]">File</span>
                        </button>

                      </div>

                      {/* Cancel */}
                      <div className="px-4 pt-1 pb-2">
                        <button type="button" onClick={() => setShowAttachPicker(false)}
                          className="w-full py-4 rounded-2xl text-[15px] font-semibold transition-all active:opacity-70"
                          style={{ background: "#2a3942", color: "#f15c6d" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* Paperclip — toggles picker */}
                <button
                  type="button"
                  onClick={() => setShowAttachPicker(v => !v)}
                  className={`p-1.5 transition-all shrink-0 self-end mb-0.5 rounded-full ${showAttachPicker ? "text-[#00a884] bg-[#00a884]/10 rotate-45" : "text-[#8696a0] hover:text-[#e9edef]"}`}
                  style={{ transition: "transform 0.2s ease, color 0.15s" }}
                  title="Attach"
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                </button>

                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); broadcastTyping(); if (showAttachPicker) setShowAttachPicker(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e as unknown as FormEvent); } }}
                  rows={1}
                  placeholder={filePreviews.length > 0 ? `${filePreviews.length} file(s) ready…` : "Message"}
                  disabled={filePreviews.length > 0}
                  className="chat-textarea flex-1 resize-none bg-transparent outline-none py-2.5 max-h-32 text-[#e9edef] placeholder:text-[#8696a0] disabled:opacity-50 leading-snug self-center"
                  style={{ fontSize: "16px", lineHeight: "1.4" }}
                />
              </div>

              {/* Send / Mic button */}
              {!text.trim() && filePreviews.length === 0 ? (
                <button type="button" onClick={startRecording} disabled={uploading} title="Record voice note"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-white hover:opacity-90 transition-all active:scale-95 shrink-0 disabled:opacity-40 shadow-md">
                  <Mic className="h-5 w-5" />
                </button>
              ) : (
                <button type="submit" disabled={(!text.trim() && filePreviews.length === 0) || sending || uploading}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-white hover:opacity-90 transition-all active:scale-95 shrink-0 disabled:opacity-40 shadow-md">
                  {sending || uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ---- MessageBubble -----------------------------------------------------------

function QuotedMessage({ message, messages }: { message: Message; messages: Message[] }) {
  const quotedMsg = messages.find((m) => m.id === message.replied_to_id);
  if (!quotedMsg) return null;

  const quotedContent = quotedMsg.deleted_at
    ? "This message was deleted"
    : quotedMsg.type === "voice"
    ? "🎙️ Voice note"
    : quotedMsg.type === "image"
    ? "🖼️ Image"
    : quotedMsg.type === "file"
    ? `📎 ${quotedMsg.file_name ?? "File"}`
    : quotedMsg.content ?? "";

  return (
    <div
      className="flex gap-2 mb-2.5 pb-2 rounded-lg overflow-hidden pl-2.5 pr-2"
      style={{ background: "rgba(0,0,0,0.18)", borderLeft: "3px solid rgba(0,168,132,0.7)" }}
    >
      <div className="flex-1 min-w-0 pt-1.5 pb-0.5">
        <div className="font-semibold text-[#00a884] text-[11px] leading-none mb-1">
          {quotedMsg.sender_id === message.sender_id ? "You" : "Them"}
        </div>
        <div className="text-white/60 text-[12px] truncate leading-snug">{quotedContent}</div>
      </div>
    </div>
  );
}

function VoiceBubble({ message: m, mine, playingId, setPlayingId, senderProfile }: {
  message: Message;
  mine: boolean;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  senderProfile?: { display_name: string | null; avatar_url: string | null } | null;
}) {
  const isPlaying = playingId === m.id;
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!m.file_url) {
      console.error("[VoiceBubble] No file_url for message:", m.id);
      setError("No audio file");
      return;
    }
    
    console.log("[VoiceBubble] Loading audio:", m.file_url);
    setLoading(true);
    setError(null);
    
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audioRef.current = audio;
    
    // Set source with error handling
    audio.src = m.file_url;
    
    const handleLoadedMetadata = () => {
      console.log("[VoiceBubble] Metadata loaded, duration:", audio.duration);
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
        setLoading(false);
      } else {
        console.warn("[VoiceBubble] Duration is not finite:", audio.duration);
        // For some audio formats, duration might not be available until playing
        setDuration(0);
        setLoading(false);
      }
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
        // Update duration if it wasn't available before
        if (duration === 0 && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };
    
    const handleEnded = () => {
      console.log("[VoiceBubble] Playback ended");
      setProgress(0);
      setCurrentTime(0);
      setPlayingId(null);
    };
    
    const handleError = (e: Event) => {
      console.error("[VoiceBubble] Audio error:", e, audio.error);
      console.error("[VoiceBubble] Error code:", audio.error?.code);
      console.error("[VoiceBubble] Error message:", audio.error?.message);
      console.error("[VoiceBubble] Audio src:", audio.src);
      console.error("[VoiceBubble] Network state:", audio.networkState);
      console.error("[VoiceBubble] Ready state:", audio.readyState);
      
      let errorMsg = "Could not play voice note";
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = "Playback aborted";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = "Network error loading audio";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = "Audio format not supported";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = "Audio file not found or format not supported";
            break;
        }
      }
      
      setError(errorMsg);
      setLoading(false);
      toast.error(errorMsg);
      setPlayingId(null);
    };
    
    const handleCanPlay = () => {
      console.log("[VoiceBubble] Can play, duration:", audio.duration);
      setLoading(false);
      // Update duration if it wasn't available before
      if (audio.duration && isFinite(audio.duration) && duration === 0) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadeddata", () => console.log("[VoiceBubble] Data loaded"));
    audio.addEventListener("canplaythrough", () => console.log("[VoiceBubble] Can play through"));
    
    // Attempt to load
    audio.load();
    
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [m.file_url, setPlayingId]);

  // Pause when another message starts playing
  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
      setCurrentTime(0);
      setProgress(0);
    }
  }, [isPlaying]);

  // Auto-play when selected
  useEffect(() => {
    if (isPlaying && audioRef.current && !loading) {
      console.log("[VoiceBubble] Starting playback");
      audioRef.current.play().catch((err) => {
        console.error("[VoiceBubble] Play error:", err);
        setError("Could not play voice note");
        toast.error("Could not play voice note: " + err.message);
        setPlayingId(null);
      });
    }
  }, [isPlaying, loading, setPlayingId]);

  function handleToggle() {
    if (!audioRef.current || loading) {
      console.log("[VoiceBubble] Cannot toggle - loading or no audio ref");
      return;
    }
    if (isPlaying) {
      console.log("[VoiceBubble] Pausing");
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      console.log("[VoiceBubble] Playing");
      setPlayingId(m.id);
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    console.log("[VoiceBubble] Seeking to:", newTime);
    audioRef.current.currentTime = newTime;
    setProgress(pct * 100);
    setCurrentTime(newTime);
  }

  function fmtTime(s: number) {
    if (!isFinite(s) || s === 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const bars = Array.from({ length: 40 }, (_, i) => ({
    h: 15 + Math.abs(Math.sin(i * 0.5 + progress * 0.1) * 70 + Math.cos(i * 0.3) * 15),
    filled: (i / 40) * 100 <= progress,
  }));

  // Get sender initial for avatar
  const senderName = senderProfile?.display_name || "User";
  const senderInitial = senderName[0].toUpperCase();

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[240px] max-w-[300px] shadow-sm ${
      mine ? "rounded-tr-sm" : "rounded-tl-sm"
    }`} style={{ background: mine ? "#005c4b" : "#1f2c34" }}>
      {/* Play/Pause */}
      <button
        onClick={handleToggle}
        disabled={loading || error !== null}
        className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 transition-all active:scale-90 disabled:opacity-50 shadow-md ${
          mine ? "bg-white/20 hover:bg-white/30" : "bg-[#00a884] hover:bg-[#009070]"
        }`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" />
          : isPlaying ? <Pause className="h-4 w-4 text-white" />
          : <Play className="h-[15px] w-[15px] ml-0.5 text-white" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-[2px] h-6 cursor-pointer" onClick={handleSeek}>
          {bars.map((b, i) => (
            <div key={i} className={`flex-1 rounded-full transition-all duration-100 ${b.filled ? "bg-white" : (error ? "bg-red-400/30" : "bg-white/25")}`}
              style={{ height: `${b.h}%`, minWidth: "2px" }} />
          ))}
        </div>
        <div className="text-[11px] font-medium text-[#8696a0] tabular-nums">
          {error ? "⚠️ Error" : (isPlaying || currentTime > 0 ? fmtTime(currentTime) : fmtTime(duration))}
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "image";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function zoom(delta: number) {
    setScale(s => Math.min(5, Math.max(0.25, s + delta)));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoom(-e.deltaY * 0.001);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    setDragging(true);
    setStartDrag({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setPos({ x: e.clientX - startDrag.x, y: e.clientY - startDrag.y });
  }

  function handleMouseUp() { setDragging(false); }

  function handleDoubleClick() {
    if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); }
    else setScale(2.5);
  }

  function reset() { setScale(1); setPos({ x: 0, y: 0 }); }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(0,0,0,0.96)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      >
        <span className="text-white/70 text-sm truncate max-w-[55vw]">{name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => zoom(0.5)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all text-lg font-bold"
          >+</button>
          <button
            onClick={reset}
            className="px-2 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-mono"
          >{Math.round(scale * 100)}%</button>
          <button
            onClick={() => zoom(-0.5)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all text-lg font-bold"
          >−</button>
          <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.15)" }} />
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image area — takes all remaining height */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          minHeight: 0,          /* critical — lets flex child shrink */
          overflow: "hidden",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={src}
          alt={name}
          draggable={false}
          onDoubleClick={handleDoubleClick}
          className="select-none"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "block",
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.15s ease",
            userSelect: "none",
          }}
        />
      </div>

      {/* Bottom hint */}
      <div
        className="shrink-0 text-center py-2 text-xs"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        Scroll to zoom · Double-click to zoom in · Drag to pan · Esc to close
      </div>
    </div>,
    document.body
  );
}

function ImageBubble({ message: m, mine, timestamp, status }: { message: Message; mine: boolean; timestamp: string; status?: Message["status"] }) {
  const [open, setOpen] = useState(false);
  const [errored, setErrored] = useState(false);
  const corners = mine ? "rounded-[18px] rounded-tr-[4px]" : "rounded-[18px] rounded-tl-[4px]";

  return (
    <>
      <div
        className={`relative overflow-hidden shadow-md ${corners}`}
        style={{ width: 240, maxWidth: "100%" }}
      >
        {errored ? (
          /* Fallback when image fails to load */
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{ width: 240, height: 160, background: mine ? "#005c4b" : "#1f2c34" }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span className="text-[11px] text-[#8696a0]">Image unavailable</span>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="block w-full focus:outline-none active:opacity-90"
            style={{ lineHeight: 0 }}
          >
            <img
              src={m.file_url!}
              alt={m.file_name ?? "image"}
              onError={() => setErrored(true)}
              className="w-full block"
              style={{
                minHeight: 120,
                maxHeight: 300,
                objectFit: "cover",
                display: "block",
                width: "100%",
              }}
            />
          </button>
        )}

        {/* Timestamp + tick overlaid at bottom-right — WhatsApp style */}
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-end items-end px-2 pb-1.5 pointer-events-none select-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)",
            paddingTop: 24,
          }}
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-white/90 tabular-nums" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
              {timestamp}
            </span>
            {mine && (
              status === "seen"
                ? <CheckCheck className="h-[13px] w-[13px] text-[#53bdeb] drop-shadow-sm" />
                : status === "delivered"
                  ? <CheckCheck className="h-[13px] w-[13px] text-white/85 drop-shadow-sm" />
                  : <Check className="h-[13px] w-[13px] text-white/85 drop-shadow-sm" />
            )}
          </div>
        </div>
      </div>

      {open && !errored && (
        <ImageLightbox src={m.file_url!} name={m.file_name ?? "image"} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MessageBubble({ message: m, mine, playingId, setPlayingId, onDelete, messages, senderProfile }: {
  message: Message;
  mine: boolean;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  onDelete: (id: string) => void;
  messages: Message[];
  senderProfile?: { display_name: string | null; avatar_url: string | null } | null;
}) {
  const base = mine
    ? "text-[#e9edef] rounded-tr-sm"
    : "text-[#e9edef] rounded-tl-sm";

  // ── Call message (WhatsApp style) ────────────────────────────────────────────
  if (m.type === "call") {
    const cd = m.call_data;
    const isVideo = cd?.call_type === "video";
    const status = cd?.status ?? "ended";
    const isMissed = status === "missed";
    const isDeclined = status === "declined";
    const isEnded = status === "ended";
    const duration = cd?.duration_seconds ?? 0;

    // WhatsApp logic:
    // - Initiator (sender_id = initiator) sees outgoing arrow
    // - Receiver sees incoming arrow
    // - Missed = receiver didn't answer → receiver sees "Missed call", initiator sees "No answer"
    const isInitiator = m.sender_id === m.sender_id; // always true — we use mine prop
    const outgoing = mine; // if mine=true, I sent this call (I'm the initiator)

    // WhatsApp-style call icons
    const PhoneOutgoing = () => (
      // Phone with outgoing arrow (green)
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="17 3 22 3 22 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="22" y1="3" x2="17" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    
    const PhoneIncomingMissed = () => (
      // Phone with incoming arrow (red for missed)
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="7 21 2 21 2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="2" y1="21" x2="7" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    
    const PhoneAnswered = () => (
      // Simple phone icon (answered call)
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    
    const VideoOutgoing = () => (
      // Video camera with outgoing arrow
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M23 7l-7 5 7 5V7z" fill="currentColor"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="currentColor"/>
        <polyline points="17 3 22 3 22 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="22" y1="3" x2="17" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    
    const VideoIncomingMissed = () => (
      // Video camera with incoming arrow (red for missed)
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M23 7l-7 5 7 5V7z" fill="currentColor"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="currentColor"/>
        <polyline points="7 21 2 21 2 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="2" y1="21" x2="7" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    
    const VideoAnswered = () => (
      // Simple video camera icon (answered call)
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 7l-7 5 7 5V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    );

    // Pick the right icon
    let IconEl: React.ReactNode;
    if (isMissed || isDeclined) {
      // missed/declined: outgoing = no answer arrow, incoming = missed arrow
      IconEl = outgoing
        ? (isVideo ? <VideoOutgoing /> : <PhoneOutgoing />)
        : (isVideo ? <VideoIncomingMissed /> : <PhoneIncomingMissed />);
    } else {
      // ended/answered
      IconEl = isVideo ? <VideoAnswered /> : <PhoneAnswered />;
    }

    // Label logic
    let titleText = isVideo ? "Video call" : "Voice call";
    let subtitleText = "";
    let canCallBack = false;

    if (outgoing) {
      if (isMissed)        { subtitleText = "No answer"; }
      else if (isDeclined) { subtitleText = "Declined"; }
      else if (isEnded && duration > 0) { subtitleText = formatDur(duration); }
      else if (isEnded)    { subtitleText = "0:00"; }
    } else {
      if (isMissed)        { titleText = isVideo ? "Missed video call" : "Missed voice call"; subtitleText = "Tap to call back"; canCallBack = true; }
      else if (isDeclined) { subtitleText = "You declined"; }
      else if (isEnded && duration > 0) { subtitleText = formatDur(duration); }
      else if (isEnded)    { subtitleText = "0:00"; }
    }

    // Icon circle color
    const isBad = (isMissed || isDeclined);
    const iconBg = isBad && !outgoing
      ? "bg-red-500/15"
      : mine ? "bg-white/20" : "bg-[#00a884]/15";
    const iconFg = isBad && !outgoing
      ? "text-red-400"
      : mine ? "text-white" : "text-[#00a884]";

    return (
      <CallBubble
        mine={mine}
        callData={cd}
        isMissed={isMissed}
        isDeclined={isDeclined}
        isEnded={isEnded}
        isVideo={isVideo}
        outgoing={outgoing}
        IconEl={IconEl}
        titleText={titleText}
        subtitleText={subtitleText}
        canCallBack={canCallBack}
        iconBg={iconBg}
        iconFg={iconFg}
      />
    );
  }

  // ── Voice ───────────────────────────────────────────────────────────────────
  if (m.type === "voice" && m.file_url) {
    return <VoiceBubble message={m} mine={mine} playingId={playingId} setPlayingId={setPlayingId} senderProfile={senderProfile} />;
  }

  // ── Image ───────────────────────────────────────────────────────────────────
  if (m.type === "image" && m.file_url) {
    return <ImageBubble message={m} mine={mine} timestamp={formatTime(m.created_at)} status={m.status} />;
  }

  // ── File / Video / Document ─────────────────────────────────────────────────
  if (m.type === "file" && m.file_url) {
    const name = m.file_name ?? "File";
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const isVideo = /^(mp4|mov|webm|avi|mkv|m4v|3gp)$/.test(ext);
    const bubbleBg = mine ? "#005c4b" : "#1f2c34";
    const corners = mine ? "rounded-[18px] rounded-tr-[4px]" : "rounded-[18px] rounded-tl-[4px]";

    // ── Video — inline player ──────────────────────────────────────────────
    if (isVideo) {
      return (
        <div
          className={`overflow-hidden shadow-md ${corners}`}
          style={{ width: 240, maxWidth: "100%", background: "#000" }}
        >
          <video
            src={m.file_url}
            controls
            playsInline
            className="w-full block"
            style={{ maxHeight: 240, minHeight: 100, display: "block" }}
          />
          {/* Footer with name + download */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: bubbleBg }}>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/15 text-white shrink-0">{ext}</span>
            <span className="text-[11px] text-[#8696a0] truncate flex-1">{name}</span>
            <a
              href={m.file_url}
              download={name}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-[#8696a0] hover:text-[#e9edef] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      );
    }

    // ── Document card — WhatsApp style ────────────────────────────────────
    const bgColor = docBgColor(ext);
    return (
      <div
        className={`overflow-hidden shadow-md ${corners}`}
        style={{ width: 260, maxWidth: "100%", background: bubbleBg }}
      >
        {/* Top: icon + name + download */}
        <a
          href={m.file_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 pt-3 pb-2 hover:opacity-90 active:opacity-70 transition-opacity"
        >
          {/* Coloured ext badge */}
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 shadow-sm"
            style={{ background: bgColor + "28" }}
          >
            <span className="text-[10px] font-black uppercase leading-none tracking-tight" style={{ color: bgColor }}>
              {ext.slice(0, 4) || "FILE"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#e9edef] leading-snug" style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {name}
            </div>
            <div className="text-[11px] text-[#8696a0] mt-0.5">
              {m.file_size ? formatBytes(m.file_size) : ext.toUpperCase()}
            </div>
          </div>
          <Download className="h-4 w-4 shrink-0 text-[#8696a0]" />
        </a>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginLeft: 12, marginRight: 12 }} />

        {/* Bottom: open label */}
        <div className="flex items-center justify-center py-2">
          <span className="text-[12px] font-semibold text-[#00a884]">Open</span>
        </div>
      </div>
    );
  }

  // ── Deleted ─────────────────────────────────────────────────────────────────
  if (m.deleted_at) {
    return (
      <div className={`px-3.5 py-2 rounded-2xl text-[13px] italic text-[#8696a0] flex items-center gap-2 ${mine ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={{ background: mine ? "#00433a" : "#182229", border: "1px solid #2a3942" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        This message was deleted
      </div>
    );
  }

  // ── Emoji-only — per-emoji animated ─────────────────────────────────────────
  const emojiOnly = m.content ? /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s)+$/u.test(m.content.trim()) : false;
  const emojiChars = emojiOnly && m.content
    ? [...m.content.trim()].filter(c => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(c))
    : [];

  if (emojiChars.length > 0 && emojiChars.length <= 3) {
    const size = emojiChars.length === 1 ? "text-6xl" : emojiChars.length === 2 ? "text-5xl" : "text-4xl";

    /** Map each emoji to its animation class(es).
     *  entryClass  = played once on mount
     *  loopClass   = looped after entry (optional)
     */
    function getEmojiAnim(emoji: string): { entry: string; loop?: string } {
      // laugh / ROFL
      if (["😂","🤣","😹"].includes(emoji)) return { entry: "emoji-laugh" };
      // cry / sob
      if (["😭","😢","🥺"].includes(emoji)) return { entry: "emoji-cry" };
      // heart variants
      if (["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💖","💗","💓","💞","💝","🫶","♥️","💘","💕"].includes(emoji))
        return { entry: "emoji-heart", loop: "emoji-heart-pulse" };
      // fire
      if (["🔥"].includes(emoji)) return { entry: "emoji-fire", loop: "emoji-fire-loop" };
      // shock / scream
      if (["😮","😲","😱","🤯"].includes(emoji)) return { entry: "emoji-shock" };
      // party / thumbs
      if (["👍","🎉","🥳","🎊","✨","🌟","⭐"].includes(emoji)) return { entry: "emoji-spin-pop" };
      // skull / dead
      if (["💀","☠️"].includes(emoji)) return { entry: "emoji-tumble" };
      // default bounce
      return { entry: "animate-emoji-bounce" };
    }

    return (
      <div className="flex gap-1 px-1 py-1 select-none">
        {emojiChars.map((emoji, i) => {
          const { entry, loop } = getEmojiAnim(emoji);
          return (
            <EmojiChar
              key={`${m.id}-${i}`}
              emoji={emoji}
              size={size}
              entryClass={entry}
              loopClass={loop}
              delay={i * 80}
            />
          );
        })}
      </div>
    );
  }

  // ── Plain text ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`px-3.5 py-2 rounded-2xl text-[14px] whitespace-pre-wrap break-words leading-relaxed shadow-sm ${base} ${mine ? "rounded-tr-sm" : "rounded-tl-sm"}`}
      style={{ background: mine ? "#005c4b" : "#1f2c34" }}
    >
      {m.replied_to_id && <QuotedMessage message={m} messages={messages} />}
      {m.pinned && <Pin className="inline h-3 w-3 mr-1 opacity-70" />}
      {m.content}
    </div>
  );
}

// ── EmojiChar — entry animation then optional loop ────────────────────────────
function EmojiChar({ emoji, size, entryClass, loopClass, delay }: {
  emoji: string;
  size: string;
  entryClass: string;
  loopClass?: string;
  delay: number;
}) {
  const [phase, setPhase] = useState<"entry" | "loop">("entry");

  return (
    <span
      className={`${size} inline-block ${phase === "entry" ? entryClass : (loopClass ?? "")}`}
      style={{ animationDelay: phase === "entry" ? `${delay}ms` : "0ms" }}
      onAnimationEnd={() => { if (phase === "entry" && loopClass) setPhase("loop"); }}
    >
      {emoji}
    </span>
  );
}

// ── CallBubble — WhatsApp-style bottom sheet that portals to document.body ──
function CallBubble({ mine, callData, isMissed, isDeclined, isEnded, isVideo, outgoing, IconEl, titleText, subtitleText, canCallBack, iconBg, iconFg }: {
  mine: boolean;
  callData: any;
  isMissed: boolean;
  isDeclined: boolean;
  isEnded: boolean;
  isVideo: boolean;
  outgoing: boolean;
  IconEl: React.ReactNode;
  titleText: string;
  subtitleText: string;
  canCallBack: boolean;
  iconBg: string;
  iconFg: string;
}) {
  const [showSheet, setShowSheet] = useState(false);
  const [closing, setClosing] = useState(false);

  function close() {
    setClosing(true);
    setTimeout(() => { setClosing(false); setShowSheet(false); }, 260);
  }

  function callBack(type: "voice" | "video") {
    close();
    setTimeout(() => {
      const fn = (window as any).__initiateCall;
      if (fn) fn(type);
    }, 280);
  }

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (showSheet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showSheet]);

  const sheet = showSheet ? createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col justify-end"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Scrim — fades in */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{
          animation: closing ? "scrim-out 0.26s ease forwards" : "scrim-in 0.26s ease forwards",
        }}
        onClick={close}
      />

      {/* Sheet — slides up from bottom */}
      <div
        className="relative w-full"
        style={{
          animation: closing
            ? "sheet-down 0.26s cubic-bezier(0.4,0,1,1) forwards"
            : "sheet-up 0.3s cubic-bezier(0.22,1,0.36,1) forwards",
          background: "#1f2c34",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-9 h-[4px] rounded-full" style={{ background: "#3d5260" }} />
        </div>

        {/* Contact name / call type */}
        <div className="px-6 pb-5" style={{ borderBottom: "1px solid #2a3942" }}>
          <p className="text-[18px] font-bold text-[#e9edef] leading-tight truncate">
            {isMissed && !outgoing ? "Missed call" : isEnded ? "Call ended" : isDeclined ? "Call declined" : "Call"}
          </p>
          <p className="text-[13px] text-[#8696a0] mt-0.5">Choose how to call back</p>
        </div>

        {/* Two big option rows — like WhatsApp */}
        <div className="px-4 pt-3 pb-2 flex flex-col gap-1">

          {/* Voice call row */}
          <button
            onClick={() => callBack("voice")}
            className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl transition-all active:scale-[0.98] active:opacity-80"
            style={{ background: "#2a3942" }}
          >
            <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ background: "#00a884" }}>
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-[15px] font-semibold text-[#e9edef]">Voice call</div>
              <div className="text-[12px] text-[#8696a0] mt-0.5">Start an audio call</div>
            </div>
          </button>

          {/* Video call row */}
          <button
            onClick={() => callBack("video")}
            className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl transition-all active:scale-[0.98] active:opacity-80"
            style={{ background: "#2a3942" }}
          >
            <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ background: "#00a884" }}>
              <Video className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-[15px] font-semibold text-[#e9edef]">Video call</div>
              <div className="text-[12px] text-[#8696a0] mt-0.5">Start a video call</div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <div className="px-4 pt-2">
          <button
            onClick={close}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold transition-all active:opacity-70"
            style={{ background: "#2a3942", color: "#f15c6d" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm min-w-[180px] max-w-[230px] shadow-sm transition-opacity active:opacity-70 cursor-pointer ${mine ? "rounded-tr-sm" : "rounded-tl-sm"}`}
        style={{ background: mine ? "#005c4b" : "#1f2c34" }}
      >
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <span className={iconFg}>{IconEl}</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className={`font-semibold text-sm leading-tight ${isMissed && !outgoing ? "text-red-400" : "text-[#e9edef]"}`}>{titleText}</div>
          {subtitleText && (
            <div className={`text-[11px] mt-0.5 ${canCallBack ? "text-[#00a884] font-medium" : "text-[#8696a0]"}`}>
              {subtitleText}
            </div>
          )}
        </div>
      </button>

      {sheet}
    </>
  );
}

function docBgColor(ext: string): string {
  const map: Record<string, string> = {
    pdf: "#f15c6d",
    doc: "#4a90d9", docx: "#4a90d9",
    xls: "#25d366", xlsx: "#25d366", csv: "#25d366",
    ppt: "#f97316", pptx: "#f97316",
    zip: "#ffd60a", rar: "#ffd60a", "7z": "#ffd60a",
    txt: "#8696a0", md: "#8696a0",
    mp3: "#a855f7", wav: "#a855f7", m4a: "#a855f7",
  };
  return map[ext] ?? "#00a884";
}
