import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, ArrowRight, Sparkles, Clock, TrendingUp,
  Users, CheckSquare, FileText, Bell, Circle, Mic, Image,
  ChevronRight, BarChart2, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

interface RecentConv {
  id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_admin: number;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null; status: string };
}

interface AdminStats {
  totalClients: number;
  totalMessages: number;
  unreadTotal: number;
  openTasks: number;
  activeNow: number;
  filesShared: number;
  voiceNotes: number;
}

function DashboardOverview() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [stats, setStats] = useState<AdminStats>({
    totalClients: 0, totalMessages: 0, unreadTotal: 0,
    openTasks: 0, activeNow: 0, filesShared: 0, voiceNotes: 0,
  });
  const [recentConvs, setRecentConvs] = useState<RecentConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUnread, setUserUnread] = useState(0);
  const [userMessages, setUserMessages] = useState(0);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, role]);

  async function load() {
    setLoading(true);
    if (isAdmin) {
      const [
        { count: clients },
        { count: messages },
        { data: convs },
        { count: openTasks },
        { count: filesShared },
        { count: voiceNotes },
        { data: activeProfiles },
      ] = await Promise.all([
        supabase.from("conversations").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("conversations").select("id, last_message, last_message_at, unread_admin, user_id")
          .order("last_message_at", { ascending: false }).limit(6),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("messages").select("*", { count: "exact", head: true }).in("type", ["file", "image"]),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("type", "voice"),
        supabase.from("profiles").select("user_id").eq("status", "online"),
      ]);

      // attach profiles to recent convs
      let enriched: RecentConv[] = [];
      if (convs && convs.length > 0) {
        const userIds = convs.map((c) => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email, avatar_url, status")
          .in("user_id", userIds);
        const byUser = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
        enriched = convs.map((c) => ({ ...c, profile: byUser.get(c.user_id) })) as RecentConv[];
      }

      const unreadTotal = enriched.reduce((sum, c) => sum + (c.unread_admin ?? 0), 0);

      setStats({
        totalClients: clients ?? 0,
        totalMessages: messages ?? 0,
        unreadTotal,
        openTasks: openTasks ?? 0,
        activeNow: (activeProfiles?.length ?? 0),
        filesShared: filesShared ?? 0,
        voiceNotes: voiceNotes ?? 0,
      });
      setRecentConvs(enriched);
    } else {
      const { data: conv } = await supabase
        .from("conversations").select("unread_user").eq("user_id", user!.id).maybeSingle();
      const { count: msgs } = await supabase
        .from("messages").select("*", { count: "exact", head: true }).eq("sender_id", user!.id);
      setUserUnread(conv?.unread_user ?? 0);
      setUserMessages(msgs ?? 0);
    }
    setLoading(false);
  }

  if (!isAdmin) {
    return <ClientOverview user={user} unread={userUnread} messages={userMessages} loading={loading} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 md:p-10 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-medium text-primary uppercase tracking-widest">Admin Dashboard</span>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Good {getGreeting()}, <span className="text-gradient">{user?.email?.split("@")[0]}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Here's everything happening across your client conversations.</p>
          </div>
          <Button asChild className="bg-gradient-primary hover:opacity-90 shadow-glow gap-2">
            <Link to="/dashboard/chat"><Inbox className="h-4 w-4" /> Open Inbox</Link>
          </Button>
        </div>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total clients" value={stats.totalClients} icon={Users} loading={loading} />
          <StatCard label="Total messages" value={stats.totalMessages} icon={MessageCircle} loading={loading} />
          <StatCard label="Unread" value={stats.unreadTotal} icon={Bell} loading={loading} accent={stats.unreadTotal > 0} />
          <StatCard label="Online now" value={stats.activeNow} icon={Circle} loading={loading} green />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Open tasks" value={stats.openTasks} icon={CheckSquare} loading={loading} />
          <StatCard label="Files shared" value={stats.filesShared} icon={FileText} loading={loading} />
          <StatCard label="Voice notes" value={stats.voiceNotes} icon={Mic} loading={loading} />
        </div>

        {/* Recent conversations */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Recent conversations</h2>
            <Link to="/dashboard/chat" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : recentConvs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No client conversations yet. Share your link to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {recentConvs.map((c) => {
                const name = c.profile?.display_name ?? c.profile?.email ?? "Unknown";
                const initial = name[0].toUpperCase();
                const online = c.profile?.status === "online";
                return (
                  <Link
                    key={c.id}
                    to="/dashboard/chat"
                    className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-colors group"
                  >
                    <div className="relative shrink-0">
                      {c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt={name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">
                          {initial}
                        </div>
                      )}
                      {online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.last_message_at ? formatTime(c.last_message_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {c.last_message ?? "No messages yet"}
                        </span>
                        {c.unread_admin > 0 && (
                          <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                            {c.unread_admin}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            to="/dashboard/chat"
            icon={MessageCircle}
            title="Reply to clients"
            desc="Open the inbox and respond to pending messages."
            badge={stats.unreadTotal > 0 ? `${stats.unreadTotal} unread` : undefined}
          />
          <QuickAction
            to="/dashboard/tasks"
            icon={CheckSquare}
            title="Manage tasks"
            desc="Review open tasks created from conversations."
            badge={stats.openTasks > 0 ? `${stats.openTasks} open` : undefined}
          />
          <QuickAction
            to="/dashboard/users"
            icon={Users}
            title="View clients"
            desc="See all registered clients and their status."
          />
          <QuickAction
            to="/dashboard/settings"
            icon={Sparkles}
            title="Your profile"
            desc="Update your name and avatar — clients see this."
          />
        </div>
      </div>
    </div>
  );
}

// ---- Client overview (non-admin) --------------------------------------------

function ClientOverview({ user, unread, messages, loading }: {
  user: { email?: string } | null;
  unread: number;
  messages: number;
  loading: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto p-8 md:p-10">
      <div className="max-w-2xl animate-fade-up">
        <span className="text-sm text-primary font-medium">Welcome back</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Hi, <span className="text-gradient">{user?.email?.split("@")[0]}</span> 👋
        </h1>
        <p className="mt-2 text-muted-foreground">Send a message and get a reply in real time.</p>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <StatCard label="Messages sent" value={messages} icon={TrendingUp} loading={loading} />
          <StatCard label="Unread replies" value={unread} icon={Bell} loading={loading} accent={unread > 0} />
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-gradient-surface p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
          <div className="relative">
            <MessageCircle className="h-8 w-8 text-primary mb-3" />
            <h2 className="text-xl font-bold">Start a conversation</h2>
            <p className="mt-2 text-sm text-muted-foreground">Send a message and get a reply in real time.</p>
            <Button asChild className="mt-5 bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/dashboard/chat">Open chat <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ---------------------------------------------------------

function StatCard({ label, value, icon: Icon, loading, accent, green }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  loading: boolean; accent?: boolean; green?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 hover-lift">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
        accent ? "bg-primary text-primary-foreground" :
        green ? "bg-success/15 text-success" :
        "bg-primary/10 text-primary"
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">
        {loading ? <span className="inline-block h-7 w-12 rounded-md bg-muted animate-pulse" /> : value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc, badge }: {
  to: string; icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; badge?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-colors group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
    </Link>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
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
