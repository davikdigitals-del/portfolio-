import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Camera, User } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
      });
  }, [user]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      // Upload to avatars bucket
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        toast.error("Upload failed: " + upErr.message);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Add cache-busting so the new image shows immediately
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("user_id", user.id);

      if (updateErr) {
        toast.error("Failed to save photo: " + updateErr.message);
        return;
      }

      setAvatarUrl(newUrl);
      toast.success("Profile photo updated!");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function save() {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  }

  const initial = (name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8" style={{ background: "#0b141a" }}>
      <div className="max-w-lg animate-fade-up space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#e9edef]">Settings</h1>
          <p className="text-sm text-[#8696a0] mt-0.5">Manage your profile and photo.</p>
        </div>

        {/* Profile card */}
        <div className="rounded-xl p-5 space-y-5" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>
          <h2 className="font-semibold text-[#e9edef] text-sm">Profile</h2>

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || "Profile"} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-[#00a884] flex items-center justify-center text-white text-2xl font-bold">
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#e9edef]">Profile photo</p>
              <p className="text-xs text-[#8696a0] mt-0.5">Shown to clients in chat</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="mt-2 text-xs text-[#00a884] hover:underline disabled:opacity-50">
                {uploading ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Email</label>
            <input value={user?.email ?? ""} disabled
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#8696a0] outline-none cursor-not-allowed"
              style={{ background: "#2a3942", border: "1px solid #3d5260" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:border-[#00a884]"
              style={{ background: "#2a3942", border: "1px solid #3d5260" }} />
            <p className="text-xs text-[#8696a0]">This is the name clients see when chatting with you.</p>
          </div>

          <button onClick={save} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00a884] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>

        {/* Admin badge */}
        {role === "admin" && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#1f2c34", border: "1px solid #00a884/30" }}>
            <ShieldCheck className="h-5 w-5 text-[#00a884] shrink-0" />
            <div>
              <div className="font-semibold text-sm text-[#e9edef]">Admin account</div>
              <div className="text-xs text-[#8696a0] mt-0.5">You have full admin access to this workspace.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
