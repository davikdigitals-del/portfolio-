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
          if (error.includes("Invalid login credentials")) {
            toast.error("Invalid email or password");
          } else if (error.includes("Email not confirmed")) {
            toast.error("Please confirm your email before signing in");
          } else {
            toast.error(error);
          }
          return;
        }
        // After sign in, check admin role via RPC (avoids RLS timing issues)
        const { data: roleResult } = await supabase.rpc("claim_admin_role");
        // If they're already admin, claim_admin_role returns 'ok:already_admin'
        // If they're not admin and no bootstrap, returns 'error:not_authorized'
        if (roleResult === "ok:already_admin" || roleResult === "ok:bootstrapped" || roleResult === "ok:promoted") {
          toast.success("Welcome back!");
          window.location.href = "/dashboard";
        } else {
          toast.error("This account does not have admin privileges");
          await signOut();
        }
      } else {
        // Register admin account
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/admin`,
            data: { display_name: name || email.split("@")[0] },
          },
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        if (!data.user) {
          toast.error("Failed to create account");
          return;
        }

        // Email confirmation required
        if (!data.session) {
          toast.success(
            "Account created! Check your email to confirm, then sign in here.",
            { duration: 8000 }
          );
          setMode("login");
          return;
        }

        // We have a session — assign admin role via the secure RPC
        const { data: roleResult, error: rpcError } = await supabase.rpc("claim_admin_role");
        if (rpcError) {
          console.error("RPC error:", rpcError);
          toast.error("Account created but role assignment failed: " + rpcError.message);
          return;
        }

        if (roleResult === "ok:bootstrapped" || roleResult === "ok:already_admin" || roleResult === "ok:promoted") {
          toast.success("Admin account created! Redirecting...");
          window.location.href = "/dashboard";
        } else {
          toast.error("Account created but could not assign admin role. Run the SQL fix in Supabase.");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b141a" }}>
        <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0b141a" }}>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884] shadow-lg mb-4">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#e9edef]">Admin Portal</h1>
          <p className="text-sm text-[#8696a0] mt-0.5">Ajibola Gbenga Joseph</p>
        </div>

        <div className="rounded-2xl p-6 space-y-4" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>
          <div>
            <h2 className="text-lg font-bold text-[#e9edef]">
              {mode === "login" ? "Welcome back" : "Create admin account"}
            </h2>
            <p className="text-xs text-[#8696a0] mt-0.5">
              {mode === "login" ? "Sign in to access your dashboard." : "Set up your admin account."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajibola Gbenga Joseph" autoComplete="name"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#e9edef] placeholder:text-[#8696a0] outline-none"
                  style={{ background: "#2a3942", border: "1px solid #3d5260" }} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email"
                className="w-full rounded-lg px-3 py-2.5 text-sm text-[#e9edef] placeholder:text-[#8696a0] outline-none"
                style={{ background: "#2a3942", border: "1px solid #3d5260" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-[#e9edef] placeholder:text-[#8696a0] outline-none"
                  style={{ background: "#2a3942", border: "1px solid #3d5260" }} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef] transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#00a884] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign in to Dashboard" : "Create Admin Account"}
            </button>
          </form>

          <div className="text-center text-sm text-[#8696a0]">
            {mode === "login" ? "First time here?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-[#00a884] hover:underline font-medium">
              {mode === "login" ? "Create admin account" : "Sign in"}
            </button>
          </div>

          {mode === "login" && (
            <div className="p-3 rounded-lg text-xs text-[#8696a0]" style={{ background: "#2a3942" }}>
              <strong className="text-[#e9edef]">Troubleshooting:</strong> Check your email for a confirmation link if you can't sign in.
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[#8696a0] hover:text-[#e9edef] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
          <p className="text-xs text-[#8696a0]">Administrators only</p>
        </div>
      </div>
    </div>
  );
}
