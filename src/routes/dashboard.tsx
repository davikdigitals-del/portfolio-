import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  Loader2, MessageCircle, Home, Users, Settings,
  FileText, LogOut, CheckSquare, ShieldCheck, Menu, X, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const routerState = useRouterState();

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [routerState.location.pathname]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Load profile (name + avatar for sidebar)
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

  // Unread badge — admin sees total unread_admin, client sees unread_user
  useEffect(() => {
    if (!user) return;
    async function fetchUnread() {
      if (isAdmin) {
        const { data } = await supabase
          .from("conversations")
          .select("unread_admin");
        const total = (data ?? []).reduce((s, c) => s + (c.unread_admin ?? 0), 0);
        setUnreadCount(total);
      } else {
        const { data } = await supabase
          .from("conversations")
          .select("unread_user")
          .eq("user_id", user!.id)
          .maybeSingle();
        setUnreadCount(data?.unread_user ?? 0);
      }
    }
    void fetchUnread();

    // Real-time unread updates
    const ch = supabase.channel("dashboard-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void fetchUnread();
      })
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
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-2 px-5 h-16 border-b border-border hover:bg-sidebar-accent transition-colors shrink-0"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-border/60">
          <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
        </div>
        <span className="font-bold">Ajibola.</span>
      </Link>

      {/* Nav */}
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

      {/* User info */}
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-border flex items-center justify-between px-4">
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
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-40 w-72 flex flex-col bg-sidebar border-r border-border transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col md:pt-0 pt-14">
        <Outlet />
      </main>
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
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
