import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { Preloader } from "@/components/preloader";
import { InstallPrompt } from "@/components/install-prompt";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/notifications";
import type { Call } from "@/lib/calls";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-fade-up">
        <h1 className="text-8xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { name: "google-site-verification", content: "DH3NzpT-c8lOBYg4rmgEODmIUkpSw9gDOZSqEocS7XM" },
      { title: "Pulse — Premium real-time chat for clients" },
      { name: "description", content: "Premium real-time chat platform connecting you with your clients. Smart tagging, AI summaries, and lightning-fast messaging." },
      { name: "author", content: "Pulse" },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pulse" },
      { property: "og:title", content: "Pulse — Premium real-time chat" },
      { property: "og:description", content: "Premium real-time chat platform connecting you with your clients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/webp", href: "/me.webp" },
      { rel: "apple-touch-icon", href: "/me.webp" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "dns-prefetch", href: "https://gcckwqkzjoxraikosash.supabase.co" },
      { rel: "preconnect", href: "https://gcckwqkzjoxraikosash.supabase.co" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [ready, setReady] = useState(false);

  // Initialize native app features only if running as native
  useEffect(() => {
    // Use Capacitor.isNativePlatform() — reliable check for actual native app
    // window.Capacitor exists even in browser (JS bundle), so don't use that
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        console.log('[App] Running as native mobile app on', Capacitor.getPlatform());
        
        // Fallback: hide splash screen after 5 seconds no matter what
        const splashTimeout = setTimeout(() => {
          console.warn('[App] Splash screen timeout - forcing hide');
          import('@capacitor/splash-screen').then(({ SplashScreen }) => {
            SplashScreen.hide().catch(() => {});
          });
        }, 5000);
        
        import('@/lib/native').then(({ initializeNativeApp }) => {
          void initializeNativeApp().finally(() => {
            clearTimeout(splashTimeout);
          });
        }).catch((err) => {
          console.error('[App] Failed to initialize native app:', err);
          clearTimeout(splashTimeout);
          // Hide splash screen even if initialization fails
          import('@capacitor/splash-screen').then(({ SplashScreen }) => {
            SplashScreen.hide().catch(() => {});
          });
        });
      }
    });
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <AuthProvider>
      <GlobalCallListener />
      {!ready && <Preloader onDone={() => setReady(true)} />}
      <div className={ready ? "opacity-100 transition-opacity duration-500" : "opacity-0"}>
        <Outlet />
      </div>
      <Toaster position="top-right" />
      <InstallPrompt />
    </AuthProvider>
  );
}

// Separate component so it's inside AuthProvider and can use useAuth
function GlobalCallListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check URL params for incoming call (from push notification tap)
    const params = new URLSearchParams(window.location.search);
    const callId = params.get("call");
    const convId = params.get("conv");
    if (callId && convId) {
      window.history.replaceState({}, "", window.location.pathname);
      // Fetch the call and show incoming screen if still ringing
      supabase.from("calls").select("*").eq("id", callId).maybeSingle().then(({ data: call }) => {
        if (!call) return;
        if (call.status === "ringing") {
          // Show incoming call screen via dashboard handler
          const setIncoming = (window as any).__setIncomingCall;
          if (setIncoming) {
            void setIncoming(call);
          } else {
            // Dashboard not mounted yet — store for when it mounts
            (window as any).__pendingCall = call;
          }
        } else if (call.status === "active") {
          // Call already active — store for JOIN
          (window as any).__pendingCall = call;
        }
      });
    }

    // Subscribe to incoming calls — only fires if dashboard listener isn't active
    const ch = supabase.channel(`root-calls-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "calls",
        filter: `receiver_id=eq.${user.id}`,
      }, async (payload) => {
        const call = payload.new as Call;
        if (call.status !== "ringing") return;

        // If dashboard is mounted, it handles everything — skip
        if ((window as any).__setIncomingCall) return;

        // Dashboard not mounted — show push notification so user can tap to open
        const { data: profile } = await supabase
          .from("profiles").select("display_name").eq("user_id", call.initiator_id).maybeSingle();
        void sendPushNotification(
          call.call_type === "video" ? "📹 Incoming video call" : "☎️ Incoming voice call",
          `${profile?.display_name ?? "Someone"} is calling...`,
          { tag: `call-${call.id}`, requireInteraction: true }
        );
      })
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  return null;
}
