import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  Loader2, MessageCircle, Home, Users, Settings,
  FileText, LogOut, CheckSquare, ShieldCheck, Menu, X, Phone, Video, PhoneOff,
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
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const routerState = useRouterState();

  usePresence(user?.id);
  useViewportHeight();

  // Global call listener - listen for all incoming calls (both admin and client)
  useEffect(() => {
    if (!user) return;

    console.log(`[CallListener] Setting up global call listener for ${isAdmin ? 'admin' : 'client'}, user ID:`, user.id);
    
    const ch = supabase.channel(`global-calls-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "calls",
      }, (payload) => {
        console.log("[CallListener] Received call event:", payload);
        const call = payload.new as Call;
        
        // Show incoming call if we're the receiver and it's ringing
        if (call.receiver_id === user.id && call.status === "ringing") {
          console.log("[CallListener] Incoming call for me:", call.id, "Type:", call.call_type);
          setIncomingCall(call);
          void sendPushNotification(
            call.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call",
            "Someone is calling...",
            { tag: `call-${call.id}` }
          );
        } else {
          console.log("[CallListener] Call not for me. Receiver:", call.receiver_id, "My ID:", user.id, "Status:", call.status);
        }
      })
      .subscribe((status) => {
        console.log("[CallListener] Subscription status:", status);
      });

    return () => { 
      console.log("[CallListener] Cleaning up call listener");
      void supabase.removeChannel(ch); 
    };
  }, [user, isAdmin]);

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

  return (
    // calc(var(--vh, 1vh) * 100) = real visible height, shrinks when keyboard opens
    <div className="flex bg-background overflow-hidden" style={{ height: "calc(var(--vh, 1vh) * 100)" }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar — fixed, uses safe-area-inset-top */}
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
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-40 w-72 flex flex-col bg-sidebar border-r border-border transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SidebarContent />
      </aside>

      {/* Main content — offset by mobile top bar height */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 md:pt-0 pt-14">
        <Outlet />
      </main>

      {/* Global incoming call modal for both admin and client */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-primary/20 to-background">
          {/* Caller info */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {/* Avatar placeholder */}
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-5xl font-bold ring-4 ring-primary">
              {isAdmin ? "C" : "A"}
            </div>

            {/* Caller name */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground">
                {isAdmin ? "Client Calling" : "Ajibola Calling"}
              </h1>
              <p className="text-lg text-muted-foreground mt-2">
                {incomingCall.call_type === "video" ? "📹 Video call" : "☎️ Voice call"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-8 pb-12">
            <button
              onClick={async () => {
                // Decline the call
                await supabase
                  .from("calls")
                  .update({ status: "declined", ended_at: new Date().toISOString() })
                  .eq("id", incomingCall.id);
                setIncomingCall(null);
              }}
              className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all active:scale-95 shadow-lg"
              title="Decline call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={() => {
                // Navigate to chat with this conversation and answer the call
                const conversationId = incomingCall.conversation_id;
                void navigate({ to: `/dashboard/chat?conv=${conversationId}&call=${incomingCall.id}` });
              }}
              className="flex items-center justify-center h-16 w-16 rounded-full bg-green-500 text-white hover:opacity-90 transition-all active:scale-95 shadow-lg"
              title="Answer call"
            >
              <Phone className="h-7 w-7" />
            </button>
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
