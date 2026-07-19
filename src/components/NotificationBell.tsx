import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, MessageCircle, Phone, CheckCheck, Trash2, X, BellOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = "new_message" | "missed_call" | "incoming_call" | "task_created" | "system";

interface AppNotification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string | null;
  conversation_id: string | null;
  read: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function notifIcon(type: NotifType) {
  switch (type) {
    case "new_message":    return <MessageCircle className="h-4 w-4 text-[#00a884]" />;
    case "missed_call":
    case "incoming_call":  return <Phone className="h-4 w-4 text-[#f15c6d]" />;
    default:               return <Bell className="h-4 w-4 text-[#8696a0]" />;
  }
}

function notifBg(type: NotifType): string {
  switch (type) {
    case "new_message":   return "rgba(0,168,132,0.12)";
    case "missed_call":
    case "incoming_call": return "rgba(241,92,109,0.12)";
    default:              return "rgba(134,150,160,0.12)";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Pass true to render icon-only (collapsed sidebar on md breakpoint) */
  iconOnly?: boolean;
}

export function NotificationBell({ iconOnly = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.read).length;

  // ── Load + realtime ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifs((data as AppNotification[]) ?? []);
    }

    void load();

    // Use a unique channel name per mount to avoid Supabase "already subscribed" error
    const channelName = `notifs:${user.id}:${Date.now()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifs((prev) => [n, ...prev].slice(0, 50));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifs((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const old = payload.old as { id: string };
          setNotifs((prev) => prev.filter((x) => x.id !== old.id));
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  // Use user.id (stable string) not user object to avoid unnecessary re-subscriptions
  }, [user?.id]);

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        bellRef.current?.contains(e.target as Node)
      ) return;
      closePanel();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  function closePanel() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 220);
  }

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  async function markAllRead() {
    if (!user) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  }

  async function deleteNotif(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }

  async function clearAll() {
    if (!user) return;
    setNotifs([]);
    await supabase.from("notifications").delete().eq("user_id", user.id);
  }

  function handleNotifClick(n: AppNotification) {
    void markRead(n.id);
    closePanel();
    if (n.conversation_id) {
      sessionStorage.setItem("openConvId", n.conversation_id);
      void navigate({ to: "/dashboard/chat" });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const bell = (
    <button
      ref={bellRef}
      onClick={() => open ? closePanel() : setOpen(true)}
      title="Notifications"
      className={`relative flex items-center justify-center lg:justify-start gap-3 lg:px-4 py-3 w-full text-sm transition-colors
        ${open ? "text-[#e9edef] bg-[#2a3942]" : "text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"}`}
    >
      <div className="relative shrink-0">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-[16px] min-w-[16px] px-[3px] text-[9px] font-bold rounded-full bg-[#f15c6d] text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>
      <span className="hidden lg:block flex-1 text-left">Notifications</span>
      {unread > 0 && (
        <span className="hidden lg:inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-[#f15c6d] text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  // Panel — slides in from the left on desktop, bottom sheet on mobile
  const panel = (open || closing) && createPortal(
    <>
      {/* Scrim — mobile only */}
      <div
        className="fixed inset-0 z-[89] md:hidden"
        style={{
          background: "rgba(0,0,0,0.5)",
          animation: closing ? "scrim-out 0.22s ease forwards" : "scrim-in 0.22s ease forwards",
        }}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed z-[90] flex flex-col shadow-2xl"
        style={{
          // Mobile: bottom sheet
          // Desktop: left side panel anchored next to sidebar
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "85vh",
          borderRadius: "20px 20px 0 0",
          background: "#111b21",
          border: "1px solid #2a3942",
          animation: closing
            ? "sheet-down 0.22s cubic-bezier(0.4,0,1,1) forwards"
            : "sheet-up 0.26s cubic-bezier(0.22,1,0.36,1) forwards",
          // Desktop override
          ...(window.innerWidth >= 768 ? {
            top: 0,
            bottom: 0,
            left: 72,   // right of icon-only sidebar on md
            right: "auto",
            width: 360,
            maxHeight: "100vh",
            borderRadius: 0,
            borderLeft: "1px solid #2a3942",
            animation: closing
              ? "slide-panel-out 0.22s ease forwards"
              : "slide-panel-in 0.26s cubic-bezier(0.22,1,0.36,1) forwards",
          } : {}),
        } as React.CSSProperties}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5 shrink-0"
          style={{ background: "#202c33", borderBottom: "1px solid #2a3942" }}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#00a884]" />
            <span className="font-bold text-[#e9edef] text-[15px]">Notifications</span>
            {unread > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-[#f15c6d] text-white">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                title="Mark all read"
                className="h-8 w-8 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#2a3942] transition-all"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                title="Clear all"
                className="h-8 w-8 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#f15c6d] hover:bg-[#2a3942] transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={closePanel}
              className="h-8 w-8 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 select-none">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(134,150,160,0.1)" }}
              >
                <BellOff className="h-5 w-5 text-[#3d5260]" />
              </div>
              <p className="text-[#8696a0] text-sm">No notifications yet</p>
            </div>
          ) : (
            <ul>
              {notifs.map((n: AppNotification) => (
                <li key={n.id} className="group relative">
                  <button
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors border-b ${
                      n.read
                        ? "hover:bg-[#1a2530]"
                        : "hover:bg-[#1a2530]"
                    }`}
                    style={{
                      background: n.read ? "transparent" : "rgba(0,168,132,0.04)",
                      borderColor: "#1a2530",
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: notifBg(n.type) }}
                    >
                      {notifIcon(n.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="text-[13px] leading-snug"
                          style={{ color: n.read ? "#8696a0" : "#e9edef", fontWeight: n.read ? 400 : 600 }}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#3d5260] shrink-0 tabular-nums mt-0.5">
                          {formatAge(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-[12px] text-[#8696a0] mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-[#00a884] shrink-0 mt-2" />
                    )}
                  </button>

                  {/* Delete button — appears on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); void deleteNotif(n.id); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#f15c6d] hover:bg-[#2a3942] opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body
  );

  return (
    <>
      {bell}
      {panel}
    </>
  );
}
