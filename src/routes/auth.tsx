import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getDisposableEmailError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Search = { mode?: "login" | "register" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "register" ? "register" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Pulse" },
      { name: "description", content: "Sign in or create your Pulse account to start chatting." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const { signIn, signUp, user, loading } = useAuth();

  const [isRegister, setIsRegister] = useState(mode === "register");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Validate email format and check for disposable emails
  function validateEmail(val: string): string | null {
    // Check basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return "Please enter a valid email address";
    }

    // Check for disposable email
    return getDisposableEmailError(val);
  }

  // Validate email in real time when registering
  function handleEmailChange(val: string) {
    setEmail(val);
    if (isRegister && val.includes("@")) {
      setEmailError(validateEmail(val));
    } else if (isRegister && val.length > 0) {
      setEmailError("Email must contain @");
    } else {
      setEmailError(null);
    }
  }

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard" });
    }
  }, [loading, user, navigate]);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset email sent! Check your inbox.");
        setShowForgotPassword(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Validate before setting submitting so the button never gets stuck
    if (isRegister && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (isRegister && emailError) {
      toast.error(emailError);
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const { error, message } = await signUp(email, password, displayName || email.split("@")[0]);
        if (error) {
          toast.error(error);
        } else if (message) {
          // Email confirmation required — stay on page and inform user
          toast.success(message, { duration: 6000 });
        } else {
          // Auto-confirmed (e.g. email confirmations disabled in Supabase)
          toast.success("Welcome to Pulse!");
          void navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else if (error.includes("Email not confirmed")) {
            toast.error("Please confirm your email address before signing in. Check your inbox.");
          } else {
            toast.error(error);
          }
        } else {
          toast.success("Welcome back!");
          // Navigation handled by the useEffect watching `user`
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0b141a" }}>
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884] shadow-lg mb-4">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e9edef]">Pulse</h1>
          <p className="text-sm text-[#8696a0] mt-1">
            {showForgotPassword ? "Reset your password" : isRegister ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        <div className="rounded-2xl p-6 space-y-4" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-lg px-3 py-3 text-base text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:border-[#00a884]"
                  style={{ background: "#2a3942", border: "1px solid #3d5260", fontSize: "16px" }}
                />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-lg bg-[#00a884] text-white font-semibold text-base hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-[48px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
              </button>
              <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-sm text-[#8696a0] hover:text-[#e9edef] transition-colors min-h-[44px]">
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Display name</label>
                  <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name"
                    className="w-full rounded-lg px-3 py-3 text-base text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:border-[#00a884]"
                    style={{ background: "#2a3942", border: "1px solid #3d5260", fontSize: "16px" }} />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Email</label>
                <input id="email" type="email" required value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className={`w-full rounded-lg px-3 py-3 text-base text-[#e9edef] placeholder:text-[#8696a0] outline-none transition-colors`}
                  style={{
                    background: "#2a3942",
                    border: `1px solid ${isRegister && emailError ? "#f15c6d" : "#3d5260"}`,
                    fontSize: "16px",
                  }}
                />
                {isRegister && emailError && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 text-[#f15c6d] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#f15c6d] leading-snug">{emailError}</p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">Password</label>
                  {!isRegister && (
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-[#00a884] hover:underline min-h-[44px] px-1">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isRegister ? "new-password" : "current-password"}
                  className="w-full rounded-lg px-3 py-3 text-base text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:border-[#00a884]"
                  style={{ background: "#2a3942", border: "1px solid #3d5260", fontSize: "16px" }} />
              </div>
              <button type="submit" disabled={submitting || (isRegister && !!emailError)} className="w-full py-3.5 rounded-lg bg-[#00a884] text-white font-semibold text-base hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-[48px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isRegister ? "Create account" : "Sign in"}
              </button>
            </form>
          )}

          {!showForgotPassword && (
            <div className="text-center text-sm text-[#8696a0] pt-2">
              {isRegister ? "Already have an account?" : "New to Pulse?"}{" "}
              <button onClick={() => { setIsRegister(!isRegister); setEmailError(null); }} className="text-[#00a884] hover:underline font-medium">
                {isRegister ? "Sign in" : "Create one"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[#8696a0] hover:text-[#e9edef] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
