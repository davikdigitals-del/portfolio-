import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { Preloader } from "@/components/preloader";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/notifications";
import { SCHEMA_TEMPLATES, generateSEOMeta } from "@/lib/seo";
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
  head: () => {
    const seoData = generateSEOMeta({
      title: "Website Designer & Website Developer | Ajibola Gbenga Joseph",
      description: "Ajibola Gbenga Joseph is a professional website designer and website developer with 5+ years experience. I build custom websites that look great, load fast, and convert visitors into clients. Available worldwide.",
      keywords: [
        "website designer Nigeria",
        "website developer Lagos",
        "freelance website designer",
        "professional website developer",
        "custom website design",
        "business website designer",
        "hire website designer"
      ],
      schema: [
        SCHEMA_TEMPLATES.person,
        SCHEMA_TEMPLATES.organization,
        SCHEMA_TEMPLATES.website,
        SCHEMA_TEMPLATES.professionalService
      ]
    });

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
        { name: "theme-color", content: "#000000" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Ajibola Joseph" },
        ...seoData.meta
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/webp", href: "/me.webp" },
        { rel: "apple-touch-icon", href: "/me.webp" },
        { rel: "manifest", href: "/manifest.json" },
        ...seoData.links
      ],
      scripts: seoData.scripts
    };
  },
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
            SplashScreen.hide().catch(() => { });
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
            SplashScreen.hide().catch(() => { });
          });
        });
      }
    });
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("[SW] Registered"))
        .catch(() => console.log("[SW] Registration failed"));
    }
  }, []);

  // Initialize analytics
  useEffect(() => {
    import('@/lib/analytics').then(({ initAnalytics }) => {
      initAnalytics();
    });
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  // Background call management for native app
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  useEffect(() => {
    const handleIncomingCall = async (payload: any) => {
      console.log('[App] Incoming call received:', payload);

      const call: Call = {
        id: payload.call_id,
        caller_id: payload.caller_id,
        caller_name: payload.caller_name || 'Unknown',
        caller_avatar: payload.caller_avatar,
        type: payload.type || 'voice',
        timestamp: new Date().toISOString(),
        status: 'incoming'
      };

      setIncomingCall(call);

      // Show native notification if available
      try {
        await sendPushNotification(
          `Incoming ${call.type} call`,
          `${call.caller_name} is calling...`,
          {
            call_id: call.id,
            caller_id: call.caller_id,
            type: 'incoming_call'
          }
        );
      } catch (error) {
        console.error('[App] Failed to show call notification:', error);
      }
    };

    // Listen for real-time call events
    const callSubscription = supabase
      .channel('calls')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'calls'
      }, handleIncomingCall)
      .subscribe();

    return () => {
      callSubscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return <Preloader />;
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <Toaster />
        <InstallPrompt />
        <OfflineBanner />

        {/* Incoming Call UI for native app */}
        {incomingCall && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center border border-border">
              <div className="mb-6">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  {incomingCall.caller_avatar ? (
                    <img
                      src={incomingCall.caller_avatar}
                      alt={incomingCall.caller_name}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="text-2xl">👤</div>
                  )}
                </div>
                <h3 className="text-xl font-semibold">{incomingCall.caller_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Incoming {incomingCall.type} call
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIncomingCall(null)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-full py-3 px-6 font-medium"
                >
                  Decline
                </button>
                <button
                  onClick={() => {
                    // Handle accept call logic here
                    setIncomingCall(null);
                  }}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-full py-3 px-6 font-medium"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthProvider>
  );
}