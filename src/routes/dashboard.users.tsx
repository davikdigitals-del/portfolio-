import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Users, Search, MessageCircle, Loader2,
  CheckCheck, Clock, FileText, Image, Mic,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/users")({
  component: ClientsPage,
});

interface Client {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: "online" | "offline";
  last_seen: string | null;
  created_at: string;
  // enriched
  conversation_id: string | null;
  total_messages: number;
  unread_admin: number;
  last_message: string | null;
  last_message_at: string | null;
}

function formatLastSeen(iso: string | null, online: boolean): string {
  if (online) return "Online";
  if (!iso) return "Never seen";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function lastMsgPreview(text: string | null): { icon: React.ReactNode; label: string } {
  if (!text) return { icon: null, label: "No messages yet" };
  const t = text.trim();
  if (t.includes("voice-") || t.toLowerCase().includes("voice note") || t.includes("🎙️"))
    return { icon: <Mic className="h-3 w-3 shrink-0" />, label: "Voice note" };
  if (t.match(/\.(jpg|jpeg|png|gif|webp)$/i) || t.includes("🖼️"))
    return { icon: <Image className="h-3 w-3 shrink-0" />, label: "Photo" };
  if (t.match(/\.(pdf|doc|docx|zip|xls)$/i) || t.includes("📎"))
    return { icon: <FileText className="h-3 w-3 shrink-0" />, label: "Document" };
  return { icon: null, label: t.length > 48 ? t.slice(0, 48) + "…" : t };
}

function ClientsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || !isAdmin) return;
    void load();

    // Live presence updates
    const ch = supabase.channel("clients-presence-watch")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { user_id: string; status: string; last_seen: string };
        setClients((prev) =>
          prev.map((c) =>
            c.user_id === p.user_id
              ? { ...c, status: p.status as "online" | "offline", last_seen: p.last_seen }
              : c
          )
        );
      })
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [user, isAdmin]);

  async function load() {
    setLoading(true);

    // Get all non-admin profiles
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "user");

    const userIds = (allRoles ?? []).map((r) => r.user_id);
    if (userIds.length === 0) { setClients([]); setLoading(false); return; }

    const [{ data: profiles }, { data: convs }] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", userIds),
      supabase.from("conversations").select("id, user_id, last_message, last_message_at, unread_admin"),
    ]);

    const convByUser = new Map((convs ?? []).map((c) => [c.user_id, c]));

    // Message counts per conversation
    const convIds = (convs ?? []).map((c) => c.id);
    let msgCounts: Record<string, number> = {};
    if (convIds.length > 0) {
      // Count messages per conversation using a simple query
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .is("deleted_at", null);

      for (const m of msgs ?? []) {
        msgCounts[m.conversation_id] = (msgCounts[m.conversation_id] ?? 0) + 1;
      }
    }

    const enriched: Client[] = (profiles ?? []).map((p) => {
      const conv = convByUser.get(p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        avatar_url: p.avatar_url,
        status: p.status as "online" | "offline",
        last_seen: p.last_seen,
        created_at: p.created_at,
        conversation_id: conv?.id ?? null,
        total_messages: conv ? (msgCounts[conv.id] ?? 0) : 0,
        unread_admin: conv?.unread_admin ?? 0,
        last_message: conv?.last_message ?? null,
        last_message_at: conv?.last_message_at ?? null,
      };
    });

    // Sort: online first, then by last message
    enriched.sort((a, b) => {
      if (a.status === "online" && b.status !== "online") return -1;
      if (b.status === "online" && a.status !== "online") return 1;
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bt - at;
    });

    setClients(enriched);
    setLoading(false);
  }

  function openChat(convId: string | null) {
    if (!convId) return;
    sessionStorage.setItem("openConvId", convId);
    void navigate({ to: "/dashboard/chat" });
  }

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.display_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const onlineCount = clients.filter((c) => c.status === "online").length;

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#0b141a" }}>
        <p className="text-[#8696a0]">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#0b141a" }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[#2a3942]" style={{ background: "#111b21" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#00a884]/15 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-[#00a884]" />
            </div>
            <div>
              <h1 className="font-bold text-[#e9edef] text-[15px]">Clients</h1>
              {!loading && (
                <p className="text-[11px] text-[#8696a0]">
                  {clients.length} total
                  {onlineCount > 0 && (
                    <span className="ml-2 text-[#25d366]">· {onlineCount} online</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8696a0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none text-[#e9edef] placeholder:text-[#8696a0]"
              style={{ background: "#2a3942", border: "1px solid #3d5260" }}
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-full bg-[#1f2c34] flex items-center justify-center">
            <Users className="h-6 w-6 text-[#2a3942]" />
          </div>
          <p className="text-[#8696a0] text-sm">
            {search ? "No clients match your search" : "No clients yet"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Column headers — desktop only */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-2.5 border-b border-[#2a3942] text-[11px] font-semibold text-[#8696a0] uppercase tracking-wide" style={{ background: "#111b21" }}>
            <span>Client</span>
            <span>Last Message</span>
            <span>Messages</span>
            <span>Joined</span>
            <span />
          </div>

          {filtered.map((client) => {
            const name = client.display_name ?? client.email ?? "Unknown";
            const initial = name[0].toUpperCase();
            const online = client.status === "online";
            const { icon: msgIcon, label: msgLabel } = lastMsgPreview(client.last_message);

            return (
              <div
                key={client.user_id}
                className="flex items-center gap-4 px-4 md:px-6 py-3.5 border-b border-[#1a2530] hover:bg-[#111b21] transition-colors cursor-default"
              >
                {/* Avatar + online dot */}
                <div className="relative shrink-0">
                  {client.avatar_url ? (
                    <img src={client.avatar_url} alt={name} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center text-white text-[15px] font-bold">
                      {initial}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#0b141a] ${online ? "bg-[#25d366]" : "bg-[#8696a0]"}`}
                  />
                </div>

                {/* Name + presence */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] text-[#e9edef] truncate">{name}</span>
                    {client.unread_admin > 0 && (
                      <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-[#00a884] text-white">
                        {client.unread_admin}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-xs ${online ? "text-[#25d366]" : "text-[#8696a0]"}`}>
                      {formatLastSeen(client.last_seen, online)}
                    </span>
                    {client.email && client.display_name && (
                      <span className="text-[#3d5260] text-xs">· {client.email}</span>
                    )}
                  </div>
                </div>

                {/* Last message — hidden on small screens */}
                <div className="hidden md:flex flex-col min-w-0 w-44 shrink-0">
                  {client.last_message ? (
                    <>
                      <div className="flex items-center gap-1 text-[12px] text-[#8696a0] truncate">
                        {msgIcon}
                        <span className="truncate">{msgLabel}</span>
                      </div>
                      {client.last_message_at && (
                        <span className="text-[10px] text-[#3d5260] mt-0.5">
                          {formatLastSeen(client.last_message_at, false)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[12px] text-[#3d5260] italic">No messages</span>
                  )}
                </div>

                {/* Message count */}
                <div className="hidden md:flex flex-col items-center w-16 shrink-0">
                  <span className="text-[15px] font-bold text-[#e9edef]">{client.total_messages}</span>
                  <span className="text-[10px] text-[#8696a0]">messages</span>
                </div>

                {/* Joined */}
                <div className="hidden md:flex flex-col items-start w-24 shrink-0">
                  <span className="text-[12px] text-[#8696a0]">{formatJoined(client.created_at)}</span>
                </div>

                {/* Open chat button */}
                <button
                  onClick={() => openChat(client.conversation_id)}
                  disabled={!client.conversation_id}
                  title="Open chat"
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <MessageCircle className="h-[18px] w-[18px]" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
