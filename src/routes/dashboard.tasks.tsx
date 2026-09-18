import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CheckSquare, Plus, X, Loader2, ChevronDown,
  Circle, Clock, CheckCircle2, User, MessageCircle, Trash2, GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/tasks")({
  component: TasksPage,
});

type TaskStatus = "open" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  conversation_id: string;
  created_at: string;
  updated_at: string;
  clientName?: string;
  clientAvatar?: string | null;
}

interface Conversation {
  id: string;
  user_id: string;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null };
}

const COLUMNS: { key: TaskStatus; label: string; color: string; icon: React.ReactNode }[] = [
  {
    key: "open",
    label: "Open",
    color: "#8696a0",
    icon: <Circle className="h-4 w-4" />,
  },
  {
    key: "in_progress",
    label: "In Progress",
    color: "#ffd60a",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    key: "done",
    label: "Done",
    color: "#25d366",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function TasksPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newConvId, setNewConvId] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("open");
  const [creating, setCreating] = useState(false);

  // Drag state
  const dragTaskId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;
    void load();
  }, [user, isAdmin]);

  async function load() {
    setLoading(true);
    const [{ data: tasksData }, { data: convsData }] = await Promise.all([
      supabase.from("tasks").select("*").order("updated_at", { ascending: false }),
      supabase.from("conversations").select("id, user_id"),
    ]);

    const convList = convsData ?? [];
    const userIds = convList.map((c) => c.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
    const convMap = new Map(
      convList.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id),
      })).map((c) => [c.id, c])
    );

    setConversations(
      convList.map((c) => ({ ...c, profile: profileMap.get(c.user_id) })) as Conversation[]
    );

    const enriched: Task[] = (tasksData ?? []).map((t) => {
      const conv = convMap.get(t.conversation_id);
      const p = conv ? profileMap.get(conv.user_id) : undefined;
      return {
        ...t,
        clientName: p?.display_name ?? p?.email ?? "Unknown client",
        clientAvatar: p?.avatar_url ?? null,
      };
    });

    setTasks(enriched);
    setLoading(false);
  }

  async function createTask() {
    if (!newTitle.trim() || !newConvId || !user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        status: newStatus,
        conversation_id: newConvId,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      toast.error("Failed to create task");
    } else if (data) {
      const conv = conversations.find((c) => c.id === newConvId);
      const enriched: Task = {
        ...data,
        clientName: conv?.profile?.display_name ?? conv?.profile?.email ?? "Unknown client",
        clientAvatar: conv?.profile?.avatar_url ?? null,
      };
      setTasks((prev) => [enriched, ...prev]);
      toast.success("Task created");
      setNewTitle("");
      setNewDesc("");
      setNewConvId("");
      setNewStatus("open");
      setShowCreate(false);
    }
    setCreating(false);
  }

  async function moveTask(taskId: string, newStatusVal: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: newStatusVal } : t)
    );
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatusVal })
      .eq("id", taskId);
    if (error) {
      toast.error("Failed to update task");
      void load();
    }
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) toast.error("Failed to delete task");
    else toast.success("Task deleted");
  }

  function handleDragStart(taskId: string) {
    dragTaskId.current = taskId;
  }

  function handleDrop(status: TaskStatus) {
    if (!dragTaskId.current) return;
    void moveTask(dragTaskId.current, status);
    dragTaskId.current = null;
    setDragOver(null);
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;

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
      <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-[#2a3942]" style={{ background: "#111b21" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#00a884]/15 flex items-center justify-center">
            <CheckSquare className="h-4.5 w-4.5 text-[#00a884]" />
          </div>
          <div>
            <h1 className="font-bold text-[#e9edef] text-[15px]">Tasks</h1>
            {!loading && (
              <p className="text-[11px] text-[#8696a0]">
                {done}/{total} completed
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#00a884] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Progress bar */}
      {!loading && total > 0 && (
        <div className="shrink-0 h-1 mx-6 mt-3 rounded-full overflow-hidden" style={{ background: "#2a3942" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round((done / total) * 100)}%`, background: "#25d366" }}
          />
        </div>
      )}

      {/* Kanban columns */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
          <div className="flex gap-4 h-full min-w-[680px]">
            {COLUMNS.map((col) => {
              const colTasks = tasksByStatus(col.key);
              const isOver = dragOver === col.key;
              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded-2xl flex-1 min-w-[200px] overflow-hidden transition-all"
                  style={{
                    background: isOver ? "#1a2530" : "#111b21",
                    border: `1px solid ${isOver ? col.color + "60" : "#2a3942"}`,
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(col.key)}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-[#2a3942]">
                    <span style={{ color: col.color }}>{col.icon}</span>
                    <span className="font-semibold text-sm" style={{ color: col.color }}>{col.label}</span>
                    <span
                      className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: col.color + "22", color: col.color }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {colTasks.length === 0 && (
                      <div
                        className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed text-[#8696a0] text-xs"
                        style={{ borderColor: "#2a3942" }}
                      >
                        Drop here
                      </div>
                    )}
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMove={moveTask}
                        onDelete={deleteTask}
                        onOpenChat={() => {
                          void navigate({ to: "/dashboard/chat" });
                          // pass conversation via sessionStorage so chat page can auto-open it
                          sessionStorage.setItem("openConvId", task.conversation_id);
                        }}
                        onDragStart={() => handleDragStart(task.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create task modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "#1f2c34" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3942]">
              <h3 className="font-semibold text-[#e9edef] text-base">New Task</h3>
              <button onClick={() => setShowCreate(false)} className="text-[#8696a0] hover:text-[#e9edef]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-[#8696a0] mb-1.5 block font-medium uppercase tracking-wide">Title *</label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Build landing page"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#00a884] text-[#e9edef] placeholder:text-[#8696a0]"
                  style={{ background: "#2a3942", border: "1px solid #3d5260" }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-[#8696a0] mb-1.5 block font-medium uppercase tracking-wide">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional details..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#00a884] text-[#e9edef] placeholder:text-[#8696a0] resize-none"
                  style={{ background: "#2a3942", border: "1px solid #3d5260" }}
                />
              </div>

              {/* Client */}
              <div>
                <label className="text-xs text-[#8696a0] mb-1.5 block font-medium uppercase tracking-wide">Client *</label>
                <div className="relative">
                  <select
                    value={newConvId}
                    onChange={(e) => setNewConvId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none text-[#e9edef]"
                    style={{ background: "#2a3942", border: "1px solid #3d5260" }}
                  >
                    <option value="">Select a client…</option>
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.profile?.display_name ?? c.profile?.email ?? c.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0] pointer-events-none" />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-[#8696a0] mb-1.5 block font-medium uppercase tracking-wide">Status</label>
                <div className="flex gap-2">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => setNewStatus(col.key)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{
                        background: newStatus === col.key ? col.color + "22" : "transparent",
                        borderColor: newStatus === col.key ? col.color : "#2a3942",
                        color: newStatus === col.key ? col.color : "#8696a0",
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createTask}
                disabled={!newTitle.trim() || !newConvId || creating}
                className="w-full py-3 rounded-xl bg-[#00a884] text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onMove,
  onDelete,
  onOpenChat,
  onDragStart,
}: {
  task: Task;
  onMove: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onOpenChat: () => void;
  onDragStart: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const nextStatuses = COLUMNS.filter((c) => c.key !== task.status);
  const initial = (task.clientName ?? "?")[0].toUpperCase();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-xl p-3 select-none cursor-grab active:cursor-grabbing group"
      style={{ background: "#202c33", border: "1px solid #2a3942" }}
    >
      {/* Drag handle + title row */}
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-[#3d5260] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="flex-1 text-[13px] font-semibold text-[#e9edef] leading-snug">{task.title}</p>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-[#8696a0] mt-1.5 leading-relaxed line-clamp-2 pl-6">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 pl-6">
        {/* Client chip */}
        <button
          onClick={onOpenChat}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          title="Open chat"
        >
          {task.clientAvatar ? (
            <img src={task.clientAvatar} alt={task.clientName} className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-[#00a884] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {initial}
            </div>
          )}
          <span className="text-[11px] text-[#8696a0] truncate max-w-[80px]">{task.clientName}</span>
          <MessageCircle className="h-3 w-3 text-[#8696a0]" />
        </button>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#8696a0] tabular-nums">{formatDate(task.updated_at)}</span>

          {/* Actions */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="h-6 w-6 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-all"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 bottom-full mb-1 rounded-xl overflow-hidden shadow-2xl z-10 min-w-[150px]"
                style={{ background: "#1f2c34", border: "1px solid #2a3942" }}
              >
                {nextStatuses.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => { onMove(task.id, col.key); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-[#e9edef] hover:bg-[#2a3942] transition-colors text-left"
                  >
                    <span style={{ color: col.color }}>{col.icon}</span>
                    Move to {col.label}
                  </button>
                ))}
                <button
                  onClick={() => { onDelete(task.id); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-[#f15c6d] hover:bg-[#2a3942] transition-colors text-left border-t border-[#2a3942]"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
