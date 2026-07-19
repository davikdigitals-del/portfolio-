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
    if (uid === userId && (cached === "admin" || cached === "user")) return cached as Role;
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

// Fetch role with a hard 4-second timeout so loading never hangs forever
async function fetchRole(userId: string): Promise<Role> {
  // Return cached role immediately if available
  const cached = getCachedRole(userId);

  const fetchPromise = supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .then(({ data, error }) => {
      if (error || !data) return cached ?? ("user" as Role);
      const isAdmin = data.some((r) => r.role === "admin");
      const resolved: Role = isAdmin ? "admin" : "user";
      setCachedRole(userId, resolved);
      return resolved;
    })
    .catch(() => cached ?? ("user" as Role));

  // Hard 4s timeout — never block the UI longer than this
  const timeoutPromise = new Promise<Role>((resolve) =>
    setTimeout(() => resolve(cached ?? "user"), 4000)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Bootstrap: get existing session once, resolve role, then set loading=false
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (!mounted) return;

      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        // Apply cached role instantly so UI doesn't wait
        const cached = getCachedRole(existing.user.id);
        if (cached) setRole(cached);

        // Fetch fresh role (with timeout)
        const resolved = await fetchRole(existing.user.id);
        if (mounted) setRole(resolved);
      }

      if (mounted) setLoading(false);
    }).catch(() => {
      // getSession itself failed — unblock the UI
      if (mounted) setLoading(false);
    });

    // Listen for auth changes (sign in / sign out / token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Apply cached role instantly to avoid a null-role flash
        const cached = getCachedRole(newSession.user.id);
        if (cached) {
          setRole(cached);
          // Already have a cached role — unblock loading now, role will silently refresh
          if (mounted) setLoading(false);
        }

        // Fetch fresh role (with timeout), then clear loading if not already cleared
        const resolved = await fetchRole(newSession.user.id);
        if (mounted) {
          setRole(resolved);
          setLoading(false); // no-op if already false
        }
      } else {
        setRole(null);
        clearCachedRole();
        // Signed out — unblock immediately
        if (mounted) setLoading(false);
      }
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
    // Block disposable / throwaway email domains
    const disposableError = getDisposableEmailError(email);
    if (disposableError) return { error: disposableError };

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
