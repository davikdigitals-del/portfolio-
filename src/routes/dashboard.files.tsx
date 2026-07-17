import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  FileText, Image, Mic, Film, Search, Download,
  Loader2, MessageCircle, File, Filter,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/files")({
  component: FilesPage,
});

// Keep ComingSoon exported so tasks/users imports still work if cached
export function ComingSoon({
  icon: Icon, title, desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="h-full flex items-center justify-center p-8" style={{ background: "#0b141a" }}>
      <div className="text-center max-w-md animate-fade-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884] mb-4">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-[#e9edef]">{title}</h2>
        <p className="mt-2 text-[#8696a0] text-sm">{desc}</p>
      </div>
    </div>
  );
}

type FileType = "all" | "image" | "voice" | "video" | "document";

interface SharedFile {
  id: string;
  conversation_id: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  type: "image" | "file" | "voice";
  created_at: string;
  sender_id: string;
  // enriched
  senderName: string;
  senderAvatar: string | null;
  senderIsAdmin: boolean;
  clientName: string;
  ext: string;
  fileType: "image" | "voice" | "video" | "document";
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getExt(name: string | null): string {
  if (!name) return "";
  return (name.split(".").pop() ?? "").toLowerCase();
}

function classifyFile(msgType: "image" | "file" | "voice", name: string | null): "image" | "voice" | "video" | "document" {
  if (msgType === "voice") return "voice";
  if (msgType === "image") return "image";
  const ext = getExt(name);
  if (/^(mp4|mov|webm|avi|mkv|m4v|3gp)$/.test(ext)) return "video";
  return "document";
}

const EXT_COLORS: Record<string, string> = {
  pdf: "#f15c6d", doc: "#4a90d9", docx: "#4a90d9",
  xls: "#25d366", xlsx: "#25d366", csv: "#25d366",
  ppt: "#f97316", pptx: "#f97316",
  zip: "#ffd60a", rar: "#ffd60a",
  txt: "#8696a0", md: "#8696a0",
  mp3: "#a855f7", wav: "#a855f7", m4a: "#a855f7", ogg: "#a855f7",
  mp4: "#53bdeb", mov: "#53bdeb", webm: "#53bdeb",
};

function extColor(ext: string): string {
  return EXT_COLORS[ext] ?? "#8696a0";
}

const TYPE_FILTERS: { key: FileType; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <File className="h-3.5 w-3.5" /> },
  { key: "image", label: "Photos", icon: <Image className="h-3.5 w-3.5" /> },
  { key: "video", label: "Videos", icon: <Film className="h-3.5 w-3.5" /> },
  { key: "voice", label: "Voice", icon: <Mic className="h-3.5 w-3.5" /> },
  { key: "document", label: "Docs", icon: <FileText className="h-3.5 w-3.5" /> },
];

function FilesPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileType>("all");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;
    void load();
  }, [user, isAdmin]);

  async function load() {
    setLoading(true);

    // All messages that have files (image, file, voice types with file_url)
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, file_url, file_name, file_size, type, created_at")
      .in("type", ["image", "file", "voice"])
      .not("file_url", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!msgs || msgs.length === 0) { setFiles([]); setLoading(false); return; }

    // Collect unique sender ids and conversation ids
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const convIds = [...new Set(msgs.map((m) => m.conversation_id))];

    const [{ data: profiles }, { data: convs }, { data: adminRoles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email, avatar_url").in("user_id", senderIds),
      supabase.from("conversations").select("id, user_id"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));

    // Get client profiles for conversations
    const clientUserIds = [...new Set((convs ?? []).map((c) => c.user_id))];
    const { data: clientProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", clientUserIds);

    const clientMap = new Map((clientProfiles ?? []).map((p) => [p.user_id, p]));
    const convToClient = new Map((convs ?? []).map((c) => [c.id, c.user_id]));

    const enriched: SharedFile[] = msgs.map((m) => {
      const sender = profileMap.get(m.sender_id);
      const clientUserId = convToClient.get(m.conversation_id);
      const client = clientUserId ? clientMap.get(clientUserId) : undefined;
      const ext = getExt(m.file_name);
      const fileType = classifyFile(m.type as "image" | "file" | "voice", m.file_name);

      return {
        id: m.id,
        conversation_id: m.conversation_id,
        file_url: m.file_url!,
        file_name: m.file_name,
        file_size: m.file_size,
        type: m.type as "image" | "file" | "voice",
        created_at: m.created_at,
        sender_id: m.sender_id,
        senderName: sender?.display_name ?? sender?.email ?? "Unknown",
        senderAvatar: sender?.avatar_url ?? null,
        senderIsAdmin: adminIds.has(m.sender_id),
        clientName: client?.display_name ?? client?.email ?? "Unknown client",
        ext,
        fileType,
      };
    });

    setFiles(enriched);
    setLoading(false);
  }

  const filtered = files.filter((f) => {
    if (typeFilter !== "all" && f.fileType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !f.file_name?.toLowerCase().includes(q) &&
        !f.clientName.toLowerCase().includes(q) &&
        !f.senderName.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<{ label: string; files: SharedFile[] }[]>((acc, f) => {
    const d = new Date(f.created_at);
    const now = new Date();
    let label: string;
    if (d.toDateString() === now.toDateString()) label = "Today";
    else if (d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString([], { month: "long", year: "numeric" });

    const existing = acc.find((g) => g.label === label);
    if (existing) existing.files.push(f);
    else acc.push({ label, files: [f] });
    return acc;
  }, []);

  const totalSize = files.reduce((s, f) => s + (f.file_size ?? 0), 0);

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
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-[#00a884]/15 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-[#00a884]" />
          </div>
          <div>
            <h1 className="font-bold text-[#e9edef] text-[15px]">Files</h1>
            {!loading && (
              <p className="text-[11px] text-[#8696a0]">
                {files.length} files · {formatBytes(totalSize)}
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8696a0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none text-[#e9edef] placeholder:text-[#8696a0]"
              style={{ background: "#2a3942", border: "1px solid #3d5260" }}
            />
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {TYPE_FILTERS.map((f) => {
            const count = f.key === "all" ? files.length : files.filter((x) => x.fileType === f.key).length;
            const active = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
                style={{
                  background: active ? "#00a884" : "#2a3942",
                  color: active ? "#fff" : "#8696a0",
                }}
              >
                {f.icon}
                {f.label}
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1 rounded-full"
                    style={{ background: active ? "rgba(255,255,255,0.25)" : "#3d5260", color: active ? "#fff" : "#8696a0" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-full bg-[#1f2c34] flex items-center justify-center">
            <FileText className="h-6 w-6 text-[#2a3942]" />
          </div>
          <p className="text-[#8696a0] text-sm">
            {search || typeFilter !== "all" ? "No files match your filters" : "No shared files yet"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">{group.label}</span>
                <div className="flex-1 h-px" style={{ background: "#2a3942" }} />
              </div>

              {/* Images grid */}
              {group.files.some((f) => f.fileType === "image") && typeFilter !== "document" && typeFilter !== "voice" && typeFilter !== "video" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
                  {group.files.filter((f) => f.fileType === "image").map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLightbox(f.file_url)}
                      className="relative rounded-xl overflow-hidden aspect-square group hover:opacity-90 transition-opacity"
                      style={{ background: "#1f2c34" }}
                    >
                      <img
                        src={f.file_url}
                        alt={f.file_name ?? "image"}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-1.5 opacity-0 group-hover:opacity-100">
                        <a
                          href={f.file_url}
                          download={f.file_name ?? "image"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                      {/* Client chip */}
                      <div className="absolute top-1 left-1">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[60px] block"
                          style={{ background: "rgba(0,0,0,0.6)", color: "#e9edef" }}
                        >
                          {f.clientName.split(" ")[0]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Non-image file rows */}
              {group.files
                .filter((f) => f.fileType !== "image")
                .filter((f) => typeFilter === "all" || f.fileType === typeFilter)
                .map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    onOpenChat={() => {
                      sessionStorage.setItem("openConvId", f.conversation_id);
                      void navigate({ to: "/dashboard/chat" });
                    }}
                  />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <a
              href={lightbox}
              download
              target="_blank"
              rel="noreferrer"
              className="h-9 w-9 rounded-full bg-[#1f2c34] flex items-center justify-center text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={() => setLightbox(null)}
              className="h-9 w-9 rounded-full bg-[#1f2c34] flex items-center justify-center text-[#e9edef] hover:bg-[#2a3942] transition-colors text-lg font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileRow({ file: f, onOpenChat }: { file: SharedFile; onOpenChat: () => void }) {
  const Icon =
    f.fileType === "voice" ? Mic :
    f.fileType === "video" ? Film :
    FileText;

  const color = extColor(f.ext);
  const name = f.file_name ?? (f.fileType === "voice" ? "Voice note" : "File");

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111b21] transition-colors group"
      style={{ border: "1px solid transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a3942")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
    >
      {/* File icon */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
        style={{ background: color + "22" }}
      >
        {f.ext ? (
          <span className="text-[9px] font-black uppercase" style={{ color }}>{f.ext.slice(0, 4)}</span>
        ) : (
          <Icon className="h-4 w-4" style={{ color }} />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#e9edef] truncate leading-snug">{name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Sender */}
          <span className="text-[11px] text-[#8696a0]">
            {f.senderIsAdmin ? "You" : f.clientName}
          </span>
          {f.file_size != null && (
            <span className="text-[10px] text-[#3d5260]">· {formatBytes(f.file_size)}</span>
          )}
          <span className="text-[10px] text-[#3d5260]">· {formatDate(f.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onOpenChat}
          title="View in chat"
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10 transition-all"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <a
          href={f.file_url}
          download={name}
          target="_blank"
          rel="noreferrer"
          title="Download"
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10 transition-all"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
