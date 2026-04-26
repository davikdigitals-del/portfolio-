import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

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

  return (
    <div className="h-full overflow-y-auto p-8 md:p-10">
      <div className="max-w-xl animate-fade-up space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile.</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-semibold">Profile</h2>
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
            <p className="text-xs text-muted-foreground">This is the name clients see when chatting with you.</p>
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

        {/* Admin badge — only shown to admin */}
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
