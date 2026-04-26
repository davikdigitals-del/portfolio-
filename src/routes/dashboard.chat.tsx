import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, MessageCircle, Loader2, CheckCheck, Check, Search, Pin,
  Sparkles, Paperclip, Mic, MicOff, Download, X, Volume2, VolumeX,
  Play, Pause, FileText, Image as ImageIcon, Bell, BellOff,
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
}

interface FilePreview {
  file: File;
  previewUrl: string | null;
  kind: "image" | "file";
}

interface AdminProfile {
  display_name: string | null;
  avatar_url: string | null;
  status: string;
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

  // Request browser push permission on mount
  useEffect(() => {
    void requestNotificationPermission();
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

  // Fetch the admin's profile so clients see the real name/avatar
  useEffect(() => {
    if (isAdmin) return; // admin doesn't need to fetch themselves
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
        .select("display_name, avatar_url, status")
        .eq("user_id", adminRole.user_id)
        .maybeSingle();
      if (profile) setAdminProfile(profile as AdminProfile);
    })();
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
        if (enriched.length && !activeId) setActiveId(enriched[0].id);
      }
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => { if (user) void loadConversations(); }, [user, isAdmin]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
        void loadConversations();
        const updated = payload.new as Conversation;
        const unread = isAdmin ? updated.unread_admin : updated.unread_user;
        if (unread > 0 && updated.id !== activeId && notifsOn) {
          const label = isAdmin ? "A user sent a message" : `New message from ${adminProfile?.display_name ?? "your host"}`;
          const nid = crypto.randomUUID();
          setAlerts((prev) => [{ id: nid, text: label, convId: updated.id }, ...prev.slice(0, 3)]);
          if (soundOn) playBeep();
          // Phone-style push notification (works in background tab too)
          sendPushNotification(
            isAdmin ? "📩 New client message" : "💬 New message",
            label,
            { tag: `msg-${updated.id}` }
          );
          setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== nid)), 5000);
        }
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, isAdmin, activeId, soundOn, notifsOn, loadConversations]);

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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
      <aside className={`${active && "hidden md:flex"} flex-col w-full md:w-80 border-r border-border bg-surface/50`}>
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
                const initial = (c.profile?.display_name ?? c.profile?.email ?? "U")[0].toUpperCase();
                const name = isAdmin ? (c.profile?.display_name ?? c.profile?.email ?? "User") : (adminProfile?.display_name ?? "...");
                return (
                  <li key={c.id}>
                    <button onClick={() => setActiveId(c.id)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${activeId === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                      <div className="relative shrink-0">
                        {!isAdmin && adminProfile?.avatar_url ? (
                          <img src={adminProfile.avatar_url} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">{initial}</div>
                        )}
                        {c.profile?.status === "online" && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{name}</span>
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
      <section className={`${!active && "hidden md:flex"} flex-1 flex-col`}>
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
  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages + existing summary
  useEffect(() => {
    if (!conversation || !user) return;
    void (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
      await supabase.from("conversations").update(updates).eq("id", conversation.id);
      // Load existing summary
      const { data: sumData } = await supabase.from("ai_summaries").select("summary").eq("conversation_id", conversation.id).maybeSingle();
      if (sumData) setSummary(sumData.summary);
    })();
  }, [conversation.id, user, isAdmin]);

  // Realtime messages
  useEffect(() => {
    if (!conversation || !user) return;
    const ch = supabase.channel(`conv:${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        const updates = isAdmin ? { unread_admin: 0 } : { unread_user: 0 };
        if (msg.sender_id !== user.id) {
          void supabase.from("conversations").update(updates).eq("id", conversation.id);
          void supabase.from("messages").update({ status: "seen" }).eq("id", msg.id);
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
          // Push typing notification only when tab is not focused
          if (document.hidden) {
            const typingName = isAdmin
              ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "A client")
              : (adminProfile?.display_name ?? "Ajibola");
            sendPushNotification(
              `✍️ ${typingName} is typing...`,
              "Open the chat to reply.",
              { tag: "typing-indicator" }
            );
          }
        }
      })
      .subscribe();
    typingChannelRef.current = ch;
    return () => { void supabase.removeChannel(ch); typingChannelRef.current = null; };
  }, [conversation.id, user, isAdmin]);

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
    const previews: FilePreview[] = files.map((f) => ({
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      kind: f.type.startsWith("image/") ? "image" : "file",
    }));
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
    for (const fp of filePreviews) {
      const ext = fp.file.name.split(".").pop() ?? "bin";
      const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-files").upload(path, fp.file);
      if (upErr) { toast.error(`Failed to upload ${fp.file.name}`); continue; }
      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
      const fileUrl = urlData?.publicUrl ?? path;
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: fp.file.name,
        type: fp.kind === "image" ? "image" : "file",
        file_url: fileUrl,
        file_name: fp.file.name,
        file_size: fp.file.size,
      });
    }
    setFilePreviews([]);
    setUploading(false);
  }

  // ---- Voice recording ----
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void sendVoiceNote(); };
      mr.start();
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

  async function sendVoiceNote() {
    if (!user || !audioChunksRef.current.length) return;
    setUploading(true);
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const path = `${conversation.id}/voice-${crypto.randomUUID()}.webm`;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, blob);
    if (upErr) { toast.error("Failed to upload voice note"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
    const fileUrl = urlData?.publicUrl ?? path;
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: null,
      type: "voice",
      file_url: fileUrl,
      file_name: "Voice note",
      file_size: blob.size,
    });
    setUploading(false);
  }

  // ---- Playback ----
  function togglePlay(msgId: string, url: string) {
    let audio = audioRefs.current.get(msgId);
    if (!audio) {
      audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      audioRefs.current.set(msgId, audio);
    }
    if (playingId === msgId) {
      audio.pause();
      setPlayingId(null);
    } else {
      audioRefs.current.forEach((a, id) => { if (id !== msgId) { a.pause(); a.currentTime = 0; } });
      void audio.play();
      setPlayingId(msgId);
    }
  }

  // ---- Send text ----
  async function send(e: FormEvent) {
    e.preventDefault();
    if (filePreviews.length > 0) { await uploadAndSendFiles(); return; }
    if (!user || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
      type: "text",
    });
    if (error) { toast.error("Failed to send"); setText(content); }
    setSending(false);
  }

  const counterpartName = isAdmin
    ? (conversation.profile?.display_name ?? conversation.profile?.email ?? "User")
    : (adminProfile?.display_name ?? "...");
  const counterpartInitial = counterpartName[0].toUpperCase();
  const isOnline = isAdmin ? conversation.profile?.status === "online" : (adminProfile?.status === "online");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-16 border-b border-border px-5 flex items-center gap-3 bg-surface/40 shrink-0">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>&#8592;</Button>
        <div className="relative">
          {!isAdmin && adminProfile?.avatar_url ? (
            <img src={adminProfile.avatar_url} alt={counterpartName} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">{counterpartInitial}</div>
          )}
          {isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{counterpartName}</div>
          <div className="text-xs text-muted-foreground">{isOnline ? "Online" : "Offline"}</div>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
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
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${showGap ? "mt-3" : ""} animate-message-in`}>
              <div className="max-w-[75%]">
                <MessageBubble message={m} mine={mine} playingId={playingId} onTogglePlay={togglePlay} />
                <div className={`flex items-center gap-1 mt-1 text-[10px] text-muted-foreground ${mine ? "justify-end mr-2" : "ml-2"}`}>
                  <span>{formatTime(m.created_at)}</span>
                  {mine && (m.status === "seen" ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
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

      {/* File previews */}
      {filePreviews.length > 0 && (
        <div className="px-4 pt-3 border-t border-border bg-surface/40 flex flex-wrap gap-2 shrink-0">
          {filePreviews.map((fp, idx) => (
            <div key={idx} className="relative group">
              {fp.kind === "image" && fp.previewUrl ? (
                <img src={fp.previewUrl} alt={fp.file.name} className="h-16 w-16 object-cover rounded-lg border border-border" />
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
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/60 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">Recording...</span>
              <span className="text-sm text-muted-foreground">{recordingSeconds}s</span>
            </div>
            <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-1.5">
              <MicOff className="h-4 w-4" /> Stop & Send
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/60 focus-within:shadow-glow transition-all">
            <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.csv" className="hidden" onChange={handleFileSelect} />
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
            <button type="button" onClick={startRecording} title="Record voice note" disabled={uploading} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40">
              <Mic className="h-4 w-4" />
            </button>
            <Button type="submit" disabled={(!text.trim() && filePreviews.length === 0) || sending || uploading} size="sm" className="bg-gradient-primary hover:opacity-90 shadow-glow h-9 w-9 p-0 shrink-0">
              {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

// ---- MessageBubble -----------------------------------------------------------

function MessageBubble({ message: m, mine, playingId, onTogglePlay }: {
  message: Message;
  mine: boolean;
  playingId: string | null;
  onTogglePlay: (id: string, url: string) => void;
}) {
  const base = mine
    ? "bg-gradient-primary text-primary-foreground rounded-br-sm shadow-glow"
    : "bg-surface-elevated text-foreground rounded-bl-sm";

  if (m.type === "voice" && m.file_url) {
    const isPlaying = playingId === m.id;
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${base} min-w-[160px]`}>
        <button
          onClick={() => onTogglePlay(m.id, m.file_url!)}
          className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${mine ? "bg-white/20 hover:bg-white/30" : "bg-primary/10 hover:bg-primary/20"} transition-colors`}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex gap-0.5 items-end h-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-0.5 rounded-full ${mine ? "bg-white/60" : "bg-primary/40"} ${isPlaying ? "animate-pulse" : ""}`}
                style={{ height: `${30 + Math.sin(i * 0.8) * 50}%` }}
              />
            ))}
          </div>
          <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>
            Voice note {m.file_size ? `· ${formatBytes(m.file_size)}` : ""}
          </div>
        </div>
      </div>
    );
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
  return (
    <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${base}`}>
      {m.pinned && <Pin className="inline h-3 w-3 mr-1 opacity-70" />}
      {m.content}
    </div>
  );
}

