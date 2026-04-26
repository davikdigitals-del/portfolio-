import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
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
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard" });
    }
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (isRegister) {
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        const { error } = await signUp(email, password, displayName || email.split("@")[0]);
        if (error) {
          toast.error(error);
        } else {
          toast.success("Welcome to Pulse!");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) toast.error(error);
        else toast.success("Welcome back!");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 bg-gradient-hero">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="rounded-3xl border border-border bg-card shadow-elevated p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Pulse</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister ? "Start chatting in under a minute." : "Sign in to continue your conversations."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isRegister ? "new-password" : "current-password"} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "New to Pulse?"}{" "}
            <button onClick={() => setIsRegister(!isRegister)} className="text-primary hover:underline font-medium">
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
