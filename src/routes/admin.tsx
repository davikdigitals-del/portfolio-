import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Ajibola Gbenga Joseph" }] }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const { user, role, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already logged in as admin, go straight to dashboard
  useEffect(() => {
    if (loading) return;
    if (user && role === "admin") {
      void navigate({ to: "/dashboard" });
    }
    // If logged in as non-admin, sign them out silently so admin can log in
    if (user && role === "user") {
      void signOut();
    }
  }, [user, role, loading, navigate, signOut]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error);
        }
        // navigation handled by useEffect above
      } else {
        // Register and immediately assign admin role
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (data.user) {
          // Assign admin role directly
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert({ user_id: data.user.id, role: "admin" }, { onConflict: "user_id,role" });
          if (roleError) {
            toast.error("Account created but role assignment failed: " + roleError.message);
          } else {
            toast.success("Admin account created! Signing you in...");
            // Sign in immediately
            await signIn(email, password);
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 bg-gradient-hero">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>

        <div className="rounded-3xl border border-border bg-card shadow-elevated p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold text-lg">Admin Portal</div>
              <div className="text-xs text-muted-foreground">Ajibola Gbenga Joseph</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create admin account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login"
              ? "Sign in to access your dashboard."
              : "Set up your admin account to manage the site."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ajibola Gbenga Joseph"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : mode === "login" ? "Sign in to Dashboard" : "Create Admin Account"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "First time here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" ? "Create admin account" : "Sign in"}
            </button>
          </div>
        </div>

        {/* Security note */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          This page is for site administrators only.
        </p>
      </div>
    </div>
  );
}
