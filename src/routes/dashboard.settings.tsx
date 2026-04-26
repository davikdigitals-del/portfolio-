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
    <div className="h-full overflow-y-auto p-8 md:p-10">
      <div className="max-w-xl animate-fade-up space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and photo.</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="font-semibold">Profile</h2>

          {/* Avatar upload */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || "Profile"}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold ring-2 ring-border">
                  {initial}
                </div>
              )}
              {/* Overlay on hover */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Camera className="h-5 w-5 text-white" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This photo is shown to clients in the chat
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {uploading ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <p className="text-xs text-muted-foreground">
              This is the name clients see when chatting with you.
            </p>
          </div>

          <Button
            onClick={save}
            disabled={loading}
            className="bg-gradient-primary hover:opacity-90 shadow-glow"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save changes
          </Button>
        </div>

        {/* Admin badge */}
        {role === "admin" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-sm">Admin account</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                You have full admin access to this workspace.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
