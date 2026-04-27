import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "user";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_CACHE_KEY = "pulsechat_role";
const ROLE_CACHE_UID_KEY = "pulsechat_role_uid";

function getCachedRole(userId: string): Role | null {
  try {
    const uid = localStorage.getItem(ROLE_CACHE_UID_KEY);
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (uid === userId && cached === "admin") return "admin";
    if (uid === userId && cached === "user") return "user";
  } catch { /* ignore */ }
  return null;
}

function setCachedRole(userId: string, role: Role) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, role);
    localStorage.setItem(ROLE_CACHE_UID_KEY, userId);
  } catch { /* ignore */ }
}

function clearCachedRole() {
  try {
    localStorage.removeItem(ROLE_CACHE_KEY);
    localStorage.removeItem(ROLE_CACHE_UID_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch role with retry — keeps loading=true until role is resolved
  async function fetchRole(userId: string, retries = 3): Promise<void> {
    // Apply cached role immediately so UI doesn't flash client view
    const cached = getCachedRole(userId);
    if (cached) {
      setRole(cached);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.warn(`[Auth] Role fetch attempt ${attempt} failed:`, error.message);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * attempt)); // back-off
            continue;
          }
          // All retries failed — keep cached or fall back to user
          if (!cached) setRole("user");
          return;
        }

        const isAdmin = (data ?? []).some((r) => r.role === "admin");
        const resolved: Role = isAdmin ? "admin" : "user";
        setRole(resolved);
        setCachedRole(userId, resolved);
        return;
      } catch (err) {
        console.warn(`[Auth] Role fetch attempt ${attempt} threw:`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
    }

    // Exhausted retries — keep cached or fall back
    if (!cached) setRole("user");
  }

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchRole(newSession.user.id);
      } else {
        setRole(null);
        clearCachedRole();
      }
    });

    // Then check existing session — keep loading=true until role resolved
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (!mounted) return;
      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        await fetchRole(existing.user.id);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: displayName },
      },
    });

    if (data?.user && !data.session) {
      return {
        error: null,
        message: "Please check your email to confirm your account before signing in.",
      };
    }

    return { error: error?.message ?? null };
  }

  async function signOut() {
    clearCachedRole();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
