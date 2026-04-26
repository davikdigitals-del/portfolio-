import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, MessageCircle, Loader2, CheckCheck, Check, Search, Pin,
  Sparkles, Paperclip, Mic, Download, X, Volume2, VolumeX,
  Play, Pause, FileText, Bell, BellOff, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requestNotificationPermission,
  sendPushNotification,
  startUnreadReminder,
  stopUnreadReminder,
} from "@/lib/notifications";

export const Route = createFileRoute("/dashboard/chat")({
  head: () => ({ meta: [{ title: "Chat - Pulse" }] }),
  component: ChatPage,
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
  type: "text" | "file" | "image" | "voice";
  status: "sent" | "delivered" | "seen";
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  pinned: boolean;
  deleted_at: string | null;
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

// ── WhatsApp-style presence ──────────────────────────────────────────────────
// Online = heartbeat running. Offline = heartbeat missed for >90s OR explicit unload.
// We do NOT set offline on visibilitychange (background tab ≠ offline).
// The DB trigger handles stale sessions: if last_seen > 90s ago → show as offline.
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
      // Use sendBeacon so it fires even when tab/browser closes on mobile
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
      const body = JSON.stringify({ status: "offline", last_seen: new Date().toISOString() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      }
      // Also try normal fetch as fallback
      await supabase
        .from("profiles")
        .update({ status: "offline", last_seen: new Date().toISOString() })
        .eq("user_id", userId);
    }

    // Set online immediately
    void setOnline();

    // Heartbeat every 25 seconds — keeps last_seen fresh
    const heartbeat = setInterval(() => void setOnline(), 25_000);

    // Set offline on page unload (works on desktop)
    const handleUnload = () => { void setOffline(); };

    // On mobile: pagehide fires more reliably than beforeunload
    const handlePageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) void setOffline(); // not going into bfcache
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handlePageHide);
      void setOffline();
    };
  }, [userId]);
}

// ── Stale presence cleanup: mark users offline if last_seen > 90s ago ─────────
// This runs on the admin side to auto-expire stale "online" statuses
function useStalePresenceCleanup(isAdmin: boolean) {
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(async () => {
      const cutoff = new Date(Date.now() - 90_000).toISOString(); // 90 seconds ago
      await supabase
        .from("profiles")
        .update({ status: "offline" })
        .eq("status", "online")
        .lt("last_seen", cutoff);
    }, 30_000); // check every 30s
    return () => clearInterval(interval);
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

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

function formatLastSeenShort(iso: string | null): string {
  if (!iso) return "Last seen recently";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Last seen yesterday";
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;
  return `Last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
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
    "Notification" in window ? Notification.permission : "unsupported"
  );

  // ── WhatsApp-style presence ──
  usePresence(user?.id);
  useStalePresenceCleanup(isAdmin);

  // Request browser push permission on mount — auto-prompt after 2s
  useEffect(() => {
    if (notifPermission !== "default") return;
    const t = setTimeout(async () => {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? "granted" : "denied");
    }, 2000);
    return () => clearTimeout(t);
  }, []);

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

  // Fetch admin profile — clients need to see admin's real name/avatar/status
  useEffect(() => {
    if (isAdmin) return;
    void (async () => {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      if (!adminRole) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, status, last_seen")
        .eq("user_id", adminRole.user_id)
        .maybeSingle();
      if (profile) setAdminProfile(profile as AdminProfile);
    })();
  }, [isAdmin]);

  // Real-time admin profile updates (so client sees live online/offline in sidebar too)
  useEffect(() => {
    if (isAdmin || !adminProfile?.user_id) return;
    const ch = supabase.channel(`admin-presence:${adminProfile.user_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${adminProfile.user_id}`,
      }, (payload) => {
        const p = payload.new as AdminProfile;
        setAdminProfile((prev) => prev
          ? { ...prev, status: p.status, last_seen: p.last_seen ?? prev.last_seen }
          : prev
        );
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [isAdmin, adminProfile?.user_id]);

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
        if (enriched.length && !activeId) setActiveId(enriched[0].id);
      }
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => { if (user) void loadConversations(); }, [user, isAdmin]);

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
        void loadConversations();
        const updated = payload.new as Conversation;
        const unread = isAdmin ? updated.unread_admin : updated.unread_user;
        if (unread > 0 && updated.id !== activeId && notifsOn) {
          const label = isAdmin
            ? "A client sent you a message"
            : `New message from ${adminProfile?.display_name ?? "Ajibola"}`;
          const nid = crypto.randomUUID();
          setAlerts((prev) => [{ id: nid, text: label, convId: updated.id }, ...prev.slice(0, 3)]);
          if (soundOn) playBeep();
          // Always send push notification — SW handles showing it even in background
          void sendPushNotification(
            isAdmin ? "📩 New message" : "💬 New message",
            label,
            { tag: `msg-${updated.id}` }
          );
          setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== nid)), 5000);
        }
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, isAdmin, activeId, soundOn, notifsOn, loadConversations, adminProfile?.display_name]);

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

  return (
    <div className="flex h-full relative">
      {/* Notification alerts */}
      <div className="fixed top-16 md:top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {alerts.map((a) => (
          <div key={a.id} className="pointer-events-auto flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-lg animate-fade-up text-sm max-w-xs">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1 truncate">{a.text}</span>
            <button onClick={() => { setActiveId(a.convId); setAlerts((p) => p.filter((x) => x.id !== a.id)); }} className="text-primary text-xs font-medium hover:underline shrink-0">View</button>
            <button onClick={() => setAlerts((p) => p.filter((x) => x.id !== a.id))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className={`flex flex-col border-r border-border bg-surface/50 ${active ? "hidden md:flex md:w-80" : "flex w-full md:w-80"}`}>
        <div className="h-16 border-b border-border px-5 flex items-center justify-between">
          <h2 className="font-semibold">{isAdmin ? "Inbox" : "Your conversation"}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setSoundOn((v) => !v)} title={soundOn ? "Mute sound" : "Enable sound"} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={() => setNotifsOn((v) => !v)} title={notifsOn ? "Disable notifications" : "Enable notifications"} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              {notifsOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            {"Notification" in window && Notification.permission === "default" && (
              <button
                onClick={() => requestNotificationPermission().then((ok) => ok && toast.success("Push notifications enabled!"))}
                title="Enable push notifications"
                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors text-[10px] font-medium"
              >
                Allow
              </button>
            )}
          </div>
        </div>
        {/* Notification permission banner */}
        {notifPermission === "default" && (
          <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-foreground flex-1">Enable notifications to get message alerts</span>
            <button
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotifPermission(granted ? "granted" : "denied");
                if (granted) toast.success("Notifications enabled!");
              }}
              className="text-xs font-semibold text-primary hover:underline shrink-0"
            >
              Allow
            </button>
          </div>
        )}
        {notifPermission === "denied" && (
          <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
            <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Notifications blocked. Enable in browser settings.</span>
          </div>
        )}
        {isAdmin && (
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="pl-9 h-9" />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No conversations yet.</div>
          ) : (
            <ul className="p-2 space-y-1">
              {filtered.map((c) => {
                const unread = isAdmin ? c.unread_admin : c.unread_user;

                // CLIENT view: show admin's avatar, name, online status
                if (!isAdmin) {
                  const adminOnline = adminProfile?.status === "online";
                  const adminName = adminProfile?.display_name ?? "Ajibola Gbenga Joseph";
                  const adminInitial = adminName[0].toUpperCase();
                  return (
                    <li key={c.id}>
                      <button onClick={() => setActiveId(c.id)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${activeId === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                        <div className="relative shrink-0">
                          {adminProfile?.avatar_url ? (
                            <img src={adminProfile.avatar_url} alt={adminName} className="h-10 w-10 rounded-full object-cover ring-2 ring-border" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">{adminInitial}</div>
                          )}
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${adminOnline ? "bg-green-500" : "bg-gray-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{adminName}</span>
                            {c.last_message_at && <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(c.last_message_at)}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className={`text-xs truncate ${adminOnline ? "text-green-500 font-medium" : "text-muted-foreground"}`}>
                              {adminOnline ? "Online" : formatLastSeenShort(adminProfile?.last_seen ?? null)}
                            </span>
                            {unread > 0 && <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">{unread}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                }

                // ADMIN view: show client avatar, name, online status
                const clientOnline = c.profile?.status === "online";
                const clientName = c.profile?.display_name ?? c.profile?.email ?? "User";
                const clientInitial = clientName[0].toUpperCase();
                return (
                  <li key={c.id}>
                    <button onClick={() => setActiveId(c.id)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${activeId === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                      <div className="relative shrink-0">
                        {c.profile?.avatar_url ? (
                          <img src={c.profile.avatar_url} alt={clientName} className="h-10 w-10 rounded-full object-cover ring-2 ring-border" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">{clientInitial}</div>
                        )}
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${clientOnline ? "bg-green-500" : "bg-gray-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{clientName}</span>
                          {c.last_message_at && <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(c.last_message_at)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">{c.last_message ?? "Start the conversation"}</span>
                          {unread > 0 && <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">{unread}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Active chat */}
      <section className={`flex-1 flex-col ${active ? "flex" : "hidden md:flex"}`}>
        {active ? (
          <ActiveChat conversation={active} isAdmin={isAdmin} adminProfile={adminProfile} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm animate-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4"><MessageCircle className="h-6 w-6" /></div>
              <h2 className="text-lg font-semibold">Select a conversation</h2>
              <p className="text-sm text-muted-foreground mt-1">Pick a thread on the left to start chatting.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---- ActiveChat --------------------------------------------------------------

function ActiveChat({ conversation, isAdmin, adminProfile, onBack }: { conversation: Conversation; isAdmin: boolean; adminProfile: AdminProfile | null; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [theyTyping, setTheyTyping] = useState(false);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [counterpartStatus, setCounterpartStatus] = useState<string>(
    isAdmin ? (conversation.profile?.status ?? "offline") : (adminProfile?.status ?? "offline")
  );
  const [lastSeen, setLastSeen] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages + existing summary + counterpart status
  useEffect(() => {
    if (!conversation || !user) return;
    void (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
      await supabase.from("conversations").update(updates).eq("id", conversation.id);
      const { data: sumData } = await supabase.from("ai_summaries").select("summary").eq("conversation_id", conversation.id).maybeSingle();
      if (sumData) setSummary(sumData.summary);

      // For admin: watch the client's profile
      // For client: watch the admin's profile (use adminProfile.user_id)
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

  // Real-time status updates for counterpart
  useEffect(() => {
    if (!conversation) return;
    const counterpartId = isAdmin ? conversation.user_id : adminProfile?.user_id ?? null;
    if (!counterpartId) return;

    const statusChannel = supabase.channel(`presence-watch:${counterpartId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${counterpartId}`,
      }, (payload) => {
        const updated = payload.new as { status: string; last_seen: string };
        setCounterpartStatus(updated.status);
        setLastSeen(updated.last_seen ?? null);
      })
      .subscribe();

    return () => { void supabase.removeChannel(statusChannel); };
  }, [conversation.id, isAdmin, adminProfile?.user_id]);

  // Sync counterpart status when adminProfile prop updates (for client side)
  useEffect(() => {
    if (!isAdmin && adminProfile) {
      setCounterpartStatus(adminProfile.status);
      setLastSeen(adminProfile.last_seen ?? null);
    }
  }, [isAdmin, adminProfile?.status, adminProfile?.last_seen]);

  // Realtime messages
  useEffect(() => {
    if (!conversation || !user) return;
    const ch = supabase.channel(`conv:${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const msg = payload.new as Message;
        // Skip if it's one of our optimistic messages (already in state)
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          if (exists) return prev;
          // Replace any matching optimistic temp message
          const hasTemp = prev.some((m) => m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.content === msg.content);
          if (hasTemp) return prev.map((m) => (m.id.startsWith("temp-") && m.sender_id === msg.sender_id && m.content === msg.content) ? msg : m);
          return [...prev, msg];
        });

        if (msg.sender_id !== user.id) {
          // Message from counterpart — mark as seen immediately and clear unread
          const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
          void supabase.from("conversations").update(updates).eq("id", conversation.id);
          void supabase.from("messages").update({ status: "seen" }).eq("id", msg.id).then(() => {
            // Update local state immediately so sender sees "seen" right away
            setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "seen" } : m));
          });
        } else {
          // Our own message — mark as delivered
          void supabase.from("messages").update({ status: "delivered" }).eq("id", msg.id).then(() => {
            setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: "delivered" } : m));
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== user.id) {
          setTheyTyping(true);
          setTimeout(() => setTheyTyping(false), 2500);
          // Show push notification when app is in background
          if (document.hidden) {
            const typingName = isAdmin
              ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "A client")
              : (adminProfile?.display_name ?? "Ajibola");
            void sendPushNotification(
              `✍️ ${typingName} is typing...`,
              "Open the chat to reply.",
              { tag: "typing-indicator" }
            );
          }
        }
      })
      .subscribe();
    typingChannelRef.current = ch;

    // Mark all existing unread messages from counterpart as seen on open
    void (async () => {
      const counterpartId = isAdmin ? conversation.user_id : adminProfile?.user_id ?? null;
      if (counterpartId) {
        const { data: updated } = await supabase
          .from("messages")
          .update({ status: "seen" })
          .eq("conversation_id", conversation.id)
          .eq("sender_id", counterpartId)
          .neq("status", "seen")
          .select("id");
        // Update local state immediately
        if (updated && updated.length > 0) {
          const seenIds = new Set(updated.map((m: { id: string }) => m.id));
          setMessages((prev) => prev.map((m) => seenIds.has(m.id) ? { ...m, status: "seen" } : m));
        }
      }
    })();
    
    return () => { void supabase.removeChannel(ch); typingChannelRef.current = null; };
  }, [conversation.id, user, isAdmin, adminProfile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, theyTyping]);

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
      // Persist summary
      await supabase.from("ai_summaries").upsert({
        conversation_id: conversation.id,
        summary: summaryText,
        generated_by: user?.id,
        generated_at: new Date().toISOString(),
      }, { onConflict: "conversation_id" });
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
      };
      setMessages((prev) => [...prev, optimistic]);
    }

    // Upload all files in parallel
    await Promise.all(filePreviews.map(async (fp, idx) => {
      const ext = fp.file.name.split(".").pop() ?? "bin";
      const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-files")
        .upload(path, fp.file, { contentType: fp.file.type });

      if (upErr) {
        toast.error(`Failed to upload ${fp.file.name}`);
        // Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimisticIds[idx]));
        return;
      }

      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
      const fileUrl = urlData?.publicUrl ?? path;

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

      // Replace optimistic with real message
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
      
      // Pick the best supported format
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setWaveformBars(Array(24).fill(10));
        void sendVoiceNote(mimeType);
      };
      mr.start(100); // collect data every 100ms for reliability
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
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
    
    // Determine file extension from mime type
    const ext = mimeType?.includes("ogg") ? "ogg" : mimeType?.includes("mp4") ? "mp4" : "webm";
    const finalMime = mimeType || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: finalMime });
    
    if (blob.size < 100) {
      toast.error("Recording too short, please try again");
      setUploading(false);
      return;
    }
    
    const fileName = `voice-${crypto.randomUUID()}.${ext}`;
    const path = `${conversation.id}/${fileName}`;
    
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(path, blob, { contentType: finalMime, upsert: false });
    
    if (upErr) {
      toast.error("Failed to upload voice note: " + upErr.message);
      setUploading(false);
      return;
    }
    
    // Get a signed URL (works with private buckets)
    const { data: signedData, error: signErr } = await supabase.storage
      .from("chat-files")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    
    if (signErr || !signedData?.signedUrl) {
      toast.error("Failed to get voice note URL");
      setUploading(false);
      return;
    }
    
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: null,
      type: "voice",
      file_url: signedData.signedUrl,
      file_name: fileName,
      file_size: blob.size,
    });
    
    toast.success("Voice note sent!");
    setUploading(false);
  }

  // ---- Edit message ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function saveEdit(msgId: string) {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: editText.trim() })
      .eq("id", msgId);
    if (error) toast.error("Failed to edit message");
    else {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: editText.trim() } : m));
      setEditingId(null);
    }
  }

  // ---- Context menu (long press / right click) ----
  const [ctxMenu, setCtxMenu] = useState<{ msgId: string; x: number; y: number; mine: boolean; type: string } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openCtxMenu(e: React.MouseEvent | React.TouchEvent, msg: Message, mine: boolean) {
    e.preventDefault();
    e.stopPropagation();
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    // Clamp to viewport
    const menuW = 160, menuH = 100;
    x = Math.min(x, window.innerWidth - menuW - 8);
    y = Math.min(y, window.innerHeight - menuH - 8);
    setCtxMenu({ msgId: msg.id, x, y, mine, type: msg.type });
  }

  function startLongPress(e: React.TouchEvent, msg: Message, mine: boolean) {
    longPressTimer.current = setTimeout(() => {
      openCtxMenu(e, msg, mine);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("touchstart", close);
    };
  }, [ctxMenu]);

  // ---- Delete message ----
  async function deleteMessage(msgId: string) {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: "This message was deleted" })
      .eq("id", msgId);
    if (error) toast.error("Failed to delete message");
    else setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deleted_at: new Date().toISOString(), content: "This message was deleted" } : m));
    setCtxMenu(null);
  }

  // ---- Send text ----
  async function send(e: FormEvent) {
    e.preventDefault();
    if (filePreviews.length > 0) { await uploadAndSendFiles(); return; }
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");

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
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data: inserted, error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
      type: "text",
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

  const counterpartName = isAdmin
    ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "User")
    : (adminProfile?.display_name ?? "Ajibola Gbenga Joseph");
  const counterpartInitial = counterpartName[0].toUpperCase();
  const isOnline = counterpartStatus === "online";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-16 border-b border-border px-5 flex items-center gap-3 bg-surface/40 shrink-0">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>&#8592;</Button>
        <div className="relative">
          {!isAdmin && adminProfile?.avatar_url ? (
            <img src={adminProfile.avatar_url} alt={counterpartName} className="h-9 w-9 rounded-full object-cover ring-2 ring-border" />
          ) : isAdmin && conversation.profile?.avatar_url ? (
            <img src={conversation.profile.avatar_url} alt={counterpartName} className="h-9 w-9 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">{counterpartInitial}</div>
          )}
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{counterpartName}</div>
          <div className={`text-xs font-medium ${isOnline ? "text-green-500" : "text-muted-foreground"}`}>
            {isOnline ? "Online" : formatLastSeenShort(lastSeen)}
          </div>
        </div>
        {isAdmin && conversation.profile?.email && (
          <div className="hidden md:block text-xs text-muted-foreground mr-2">{conversation.profile.email}</div>
        )}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowSummary((v) => !v); if (!summary) void generateSummary(); }}
            className="gap-1.5 text-xs h-8 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI Summary
          </Button>
        )}
      </header>

      {/* AI Summary panel */}
      {isAdmin && showSummary && (
        <div className="border-b border-border bg-primary/5 px-5 py-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-primary mb-1">Thread Summary</div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating summary...
                  </div>
                ) : (
                  <p className="text-xs text-foreground/80 leading-relaxed">{summary ?? "No summary yet."}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => void generateSummary()} className="h-7 text-xs px-2" disabled={summaryLoading}>
                Regenerate
              </Button>
              <button onClick={() => setShowSummary(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3" onClick={() => setCtxMenu(null)}>
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Say hello
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = messages[i - 1];
          const showGap = !prev || prev.sender_id !== m.sender_id;
          const showAvatar = !mine && (!messages[i + 1] || messages[i + 1].sender_id !== m.sender_id);
          const canEdit = mine && m.type === "text" && !m.deleted_at;
          const canDelete = (mine || isAdmin) && !m.deleted_at;

          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start items-end gap-2"} ${showGap ? "mt-3" : ""} animate-message-in`}>
              {!mine && showAvatar && (
                <div className="shrink-0 mb-1">
                  {isAdmin ? (
                    conversation.profile?.avatar_url ? (
                      <img src={conversation.profile.avatar_url} alt="client" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold">{counterpartInitial}</div>
                    )
                  ) : (
                    adminProfile?.avatar_url ? (
                      <img src={adminProfile.avatar_url} alt={adminProfile.display_name || "Admin"} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold">{counterpartInitial}</div>
                    )
                  )}
                </div>
              )}
              {!mine && !showAvatar && <div className="w-7 shrink-0" />}

              <div className="max-w-[75%]">
                {/* Inline edit mode */}
                {editingId === m.id ? (
                  <div className="flex items-end gap-2 rounded-2xl border border-primary/60 bg-card p-2 min-w-[200px]">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(m.id); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={1}
                      className="flex-1 resize-none bg-transparent outline-none text-sm px-1 max-h-24"
                    />
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => void saveEdit(m.id)} className="text-xs text-primary font-medium hover:underline">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onContextMenu={(e) => (canEdit || canDelete) ? openCtxMenu(e, m, mine) : undefined}
                    onTouchStart={(e) => (canEdit || canDelete) ? startLongPress(e, m, mine) : undefined}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    className="select-none"
                  >
                    <MessageBubble message={m} mine={mine} playingId={playingId} setPlayingId={setPlayingId} onDelete={deleteMessage} />
                  </div>
                )}
                <div className={`flex items-center gap-1 mt-1 text-[10px] text-muted-foreground ${mine ? "justify-end mr-2" : "ml-2"}`}>
                  <span>{formatTime(m.created_at)}</span>
                  {mine && !m.deleted_at && (m.status === "seen" ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        {theyTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-surface-elevated rounded-bl-sm">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-typing" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-typing [animation-delay:160ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-typing [animation-delay:320ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp-style context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 rounded-2xl border border-border bg-card shadow-xl overflow-hidden min-w-[160px] animate-fade-up"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.mine && ctxMenu.type === "text" && (
            <button
              onClick={() => {
                const msg = messages.find((m) => m.id === ctxMenu.msgId);
                if (msg) { setEditText(msg.content ?? ""); setEditingId(msg.id); }
                setCtxMenu(null);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
            >
              <Pencil className="h-4 w-4 text-primary shrink-0" />
              Edit message
            </button>
          )}
          {(ctxMenu.mine || isAdmin) && (
            <button
              onClick={() => deleteMessage(ctxMenu.msgId)}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              Delete message
            </button>
          )}
        </div>
      )}

      {/* File previews */}
      {filePreviews.length > 0 && (
        <div className="px-4 pt-3 border-t border-border bg-surface/40 flex flex-wrap gap-2 shrink-0">
          {filePreviews.map((fp, idx) => (
            <div key={idx} className="relative group">
              {fp.kind === "image" && fp.previewUrl ? (
                <img src={fp.previewUrl} alt={fp.file.name} className="h-16 w-16 object-cover rounded-lg border border-border" />
              ) : fp.kind === "video" && fp.previewUrl ? (
                <div className="h-16 w-24 relative rounded-lg border border-border overflow-hidden bg-black">
                  <video src={fp.previewUrl} className="h-full w-full object-cover opacity-70" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="h-16 w-32 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/40 px-2 gap-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">{fp.file.name}</span>
                  <span className="text-[9px] text-muted-foreground">{formatBytes(fp.file.size)}</span>
                </div>
              )}
              <button onClick={() => removePreview(idx)} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={send} className="p-4 border-t border-border bg-surface/40 shrink-0">
        {recording ? (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/5 px-4 py-3">
            {/* Cancel */}
            <button
              type="button"
              onClick={() => {
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
                mediaRecorderRef.current = null;
                audioChunksRef.current = [];
                setRecording(false);
                setRecordingSeconds(0);
                setWaveformBars(Array(24).fill(10));
              }}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Cancel recording"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Live waveform */}
            <div className="flex-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <div className="flex items-end gap-[2px] h-6 flex-1">
                {waveformBars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-red-400 transition-all duration-75"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <span className="text-sm font-mono font-medium text-red-500 shrink-0 w-10 text-right">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95 shrink-0 shadow-glow"
              title="Send voice note"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/60 focus-within:shadow-glow transition-all">
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file" className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e as unknown as FormEvent); } }}
              rows={1}
              placeholder={filePreviews.length > 0 ? `${filePreviews.length} file(s) ready to send...` : "Type a message..."}
              disabled={filePreviews.length > 0}
              className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-sm max-h-32 placeholder:text-muted-foreground disabled:opacity-50"
            />
            {/* Show mic when no text, send when text */}
            {!text.trim() && filePreviews.length === 0 ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading}
                title="Record voice note"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95 shrink-0 disabled:opacity-40"
              >
                <Mic className="h-4 w-4" />
              </button>
            ) : (
              <Button
                type="submit"
                disabled={(!text.trim() && filePreviews.length === 0) || sending || uploading}
                size="sm"
                className="bg-gradient-primary hover:opacity-90 shadow-glow h-9 w-9 p-0 shrink-0"
              >
                {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

// ---- MessageBubble -----------------------------------------------------------

function VoiceBubble({ message: m, mine, playingId, setPlayingId }: {
  message: Message;
  mine: boolean;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
}) {
  const isPlaying = playingId === m.id;
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!m.file_url) return;
    const audio = new Audio(m.file_url);
    audio.preload = "metadata";
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.onended = () => {
      setProgress(0);
      setCurrentTime(0);
      setPlayingId(null);
    };
    audio.onerror = () => {
      toast.error("Could not play voice note");
      setPlayingId(null);
    };
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [m.file_url]);

  // Pause when another message starts playing
  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  function handleToggle() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      setPlayingId(m.id);
      audioRef.current.play().catch(() => {
        toast.error("Could not play voice note");
        setPlayingId(null);
      });
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * 100);
  }

  function fmtTime(s: number) {
    if (!isFinite(s) || s === 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const bars = Array.from({ length: 30 }, (_, i) => ({
    h: 20 + Math.abs(Math.sin(i * 0.9 + 1) * 60 + Math.cos(i * 0.4) * 20),
    filled: (i / 30) * 100 <= progress,
  }));

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[220px] max-w-[280px] ${
      mine ? "bg-gradient-primary text-primary-foreground rounded-br-sm shadow-glow" : "bg-surface-elevated text-foreground rounded-bl-sm"
    }`}>
      <button
        onClick={handleToggle}
        className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 transition-all active:scale-95 ${
          mine ? "bg-white/25 hover:bg-white/35" : "bg-primary hover:bg-primary/90"
        }`}
      >
        {isPlaying
          ? <Pause className={`h-4 w-4 ${mine ? "text-white" : "text-primary-foreground"}`} />
          : <Play className={`h-4 w-4 ml-0.5 ${mine ? "text-white" : "text-primary-foreground"}`} />
        }
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-end gap-[2px] h-8 cursor-pointer" onClick={handleSeek}>
          {bars.map((b, i) => (
            <div key={i} className={`flex-1 rounded-full transition-colors ${
              b.filled ? (mine ? "bg-white" : "bg-primary") : (mine ? "bg-white/35" : "bg-muted-foreground/30")
            }`} style={{ height: `${b.h}%` }} />
          ))}
        </div>
        <div className={`flex items-center justify-between text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
          <span>{isPlaying || currentTime > 0 ? fmtTime(currentTime) : fmtTime(duration)}</span>
          <span className={`flex items-center gap-1 ${mine ? "text-white/50" : "text-muted-foreground/60"}`}>
            <Mic className="h-2.5 w-2.5" /> Voice note
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message: m, mine, playingId, setPlayingId, onDelete }: {
  message: Message;
  mine: boolean;
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const base = mine
    ? "bg-gradient-primary text-primary-foreground rounded-br-sm shadow-glow"
    : "bg-surface-elevated text-foreground rounded-bl-sm";

  if (m.type === "voice" && m.file_url) {
    return <VoiceBubble message={m} mine={mine} playingId={playingId} setPlayingId={setPlayingId} />;
  }

  if (m.type === "image" && m.file_url) {
    return (
      <div className={`rounded-2xl overflow-hidden ${mine ? "rounded-br-sm" : "rounded-bl-sm"} max-w-[240px]`}>
        <img src={m.file_url} alt={m.file_name ?? "image"} className="w-full object-cover" />
        <div className={`flex items-center justify-between gap-2 px-3 py-2 ${mine ? "bg-gradient-primary text-primary-foreground" : "bg-surface-elevated"}`}>
          <span className="text-xs truncate">{m.file_name}</span>
          <a href={m.file_url} download={m.file_name ?? "image"} target="_blank" rel="noreferrer" className="shrink-0 hover:opacity-70 transition-opacity">
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (m.type === "file" && m.file_url) {
    // Check if it's a video by file extension
    const isVideo = m.file_name ? /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(m.file_name) : false;
    if (isVideo) {
      return (
        <div className={`rounded-2xl overflow-hidden ${mine ? "rounded-br-sm" : "rounded-bl-sm"} max-w-[280px]`}>
          <video
            src={m.file_url}
            controls
            className="w-full rounded-t-2xl"
            style={{ maxHeight: 200 }}
          />
          <div className={`flex items-center justify-between gap-2 px-3 py-2 ${mine ? "bg-gradient-primary text-primary-foreground" : "bg-surface-elevated"}`}>
            <span className="text-xs truncate">{m.file_name}</span>
            <a href={m.file_url} download={m.file_name ?? "video"} target="_blank" rel="noreferrer" className="shrink-0 hover:opacity-70 transition-opacity">
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${base} min-w-[180px] max-w-[260px]`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${mine ? "bg-white/20" : "bg-primary/10"}`}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{m.file_name ?? "File"}</div>
          {m.file_size && <div className={`text-[10px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>{formatBytes(m.file_size)}</div>}
        </div>
        <a href={m.file_url} download={m.file_name ?? "file"} target="_blank" rel="noreferrer" className="shrink-0 hover:opacity-70 transition-opacity">
          <Download className="h-4 w-4" />
        </a>
      </div>
    );
  }

  // text
  if (m.deleted_at) {
    return (
      <div className={`px-4 py-2.5 rounded-2xl text-sm italic text-muted-foreground bg-muted/30 rounded-${mine ? "br" : "bl"}-sm`}>
        This message was deleted
      </div>
    );
  }

  return (
    <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${base}`}>
      {m.pinned && <Pin className="inline h-3 w-3 mr-1 opacity-70" />}
      {m.content}
    </div>
  );
}

