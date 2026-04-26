import { createFileRoute, useNavigate, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Loader2, MessageCircle, Home, Users, Settings, FileText, LogOut, CheckSquare, ShieldCheck } from "lucide-react";
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

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Online/offline tracking
  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").update({ status: "online", last_seen: new Date().toISOString() }).eq("user_id", user.id);
    const handler = () => {
      void supabase.from("profiles").update({ status: "offline", last_seen: new Date().toISOString() }).eq("user_id", user.id);
    };
    window.addEventListener("beforeunload", handler);
    return () => { handler(); window.removeEventListener("beforeunload", handler); };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-border hover:bg-sidebar-accent transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-border/60">
            <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
          </div>
          <span className="font-bold">Ajibola.</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {isAdmin ? (
            // Admin sees everything
            <>
              <NavItem to="/dashboard" icon={Home} label="Overview" exact />
              <NavItem to="/dashboard/chat" icon={MessageCircle} label="Inbox" />
              <NavItem to="/dashboard/files" icon={FileText} label="Files" />
              <NavItem to="/dashboard/users" icon={Users} label="Clients" />
              <NavItem to="/dashboard/tasks" icon={CheckSquare} label="Tasks" />
              <NavItem to="/dashboard/settings" icon={Settings} label="Settings" />
            </>
          ) : (
            // Clients only see Chat
            <>
              <NavItem to="/dashboard/chat" icon={MessageCircle} label="Messages" />
            </>
          )}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold shrink-0">
              {(user.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.email}</div>
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
      </aside>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
