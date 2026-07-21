import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { Preloader } from "@/components/preloader";
import { InstallPrompt } from "@/components/install-prompt";
import { OfflineBanner } from "@/components/OfflineBanner";
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
      { title: "Website Designer & Website Developer | Ajibola Gbenga Joseph" },
      { name: "description", content: "Ajibola Gbenga Joseph is a professional website designer and website developer with 5+ years experience. I build custom websites that look great, load fast, and convert visitors into clients. Available worldwide." },
      { name: "keywords", content: "website designer, website developer, website design, website development, web designer, web developer, professional website designer, professional website developer, freelance website designer, freelance website developer, hire website designer, hire website developer, custom website design, custom website development, website designer Nigeria, website developer Nigeria, affordable website designer, business website designer, e-commerce website designer, landing page designer, responsive website designer, WordPress website designer, React website developer, website redesign" },
      { name: "author", content: "Ajibola Gbenga Joseph" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Ajibola Joseph" },
      // Open Graph
      { property: "og:site_name", content: "Ajibola Gbenga Joseph" },
      { property: "og:title", content: "Website Designer & Website Developer | Ajibola Gbenga Joseph" },
      { property: "og:description", content: "Professional website designer and website developer. Custom websites, e-commerce, landing pages and web apps that convert. Based in Nigeria, serving clients worldwide." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ajibolagbengajoseph.site/" },
      { property: "og:image", content: "https://ajibolagbengajoseph.site/me.webp" },
      { property: "og:image:alt", content: "Ajibola Gbenga Joseph — Website Designer & Developer" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "en_US" },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Website Designer & Developer | Ajibola Gbenga Joseph" },
      { name: "twitter:description", content: "Professional website designer and developer. Custom websites, e-commerce, landing pages and web apps that convert. Based in Nigeria, serving clients worldwide." },
      { name: "twitter:image", content: "https://ajibolagbengajoseph.site/me.webp" },
      { name: "twitter:image:alt", content: "Ajibola Gbenga Joseph — Website Designer & Developer" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/webp", href: "/me.webp" },
      { rel: "apple-touch-icon", href: "/me.webp" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "canonical", href: "https://ajibolagbengajoseph.site/" },
      { rel: "dns-prefetch", href: "https://gcckwqkzjoxraikosash.supabase.co" },
      { rel: "preconnect", href: "https://gcckwqkzjoxraikosash.supabase.co" },
    ],
    scripts: [
      // Person schema
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Ajibola Gbenga Joseph",
          url: "https://ajibolagbengajoseph.site/",
          image: "https://ajibolagbengajoseph.site/me.webp",
          jobTitle: "Website Designer & Website Developer",
          description: "Professional website designer and website developer with 5+ years experience building modern, fast, conversion-focused websites and web applications for businesses worldwide.",
          email: "gbengajosephajibola@gmail.com",
          nationality: "Nigerian",
          worksFor: {
            "@type": "Organization",
            name: "Edgebrook AI Solutions",
            url: "https://ajibolagbengajoseph.site/",
          },
          hasOccupation: {
            "@type": "Occupation",
            name: "Website Designer and Developer",
            occupationLocation: { "@type": "Country", name: "Nigeria" },
            skills: "Website Design, Website Development, Web Design, Web Development, Full Stack Development, React, Next.js, WordPress, UI/UX Design, SEO, Tech Advisory",
          },
          sameAs: [
            "https://www.tiktok.com/@joseph_4124",
            "https://www.youtube.com/@AjibolaGbengaJoseph1",
            "https://share.google/aXjcfG6DMAOnPqXk4",
          ],
          knowsAbout: [
            "Website Design",
            "Website Development",
            "Web Design",
            "Web Development",
            "Full-Stack Development",
            "React",
            "Next.js",
            "WordPress",
            "SEO",
            "UI/UX Design",
            "Tech Advisory",
            "E-Commerce Websites",
            "Landing Page Design",
            "Mobile App Development",
            "Responsive Web Design",
            "Custom Website Design",
            "Business Website Design",
            "Freelance Web Designer",
            "Freelance Web Developer",
          ],
        }),
      },
      // WebSite schema (enables Google Sitelinks search box)
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Ajibola Gbenga Joseph — Website Designer & Developer",
          url: "https://ajibolagbengajoseph.site/",
          description: "Professional website design, web development and tech advisory services. Custom websites built to convert visitors into clients.",
          inLanguage: "en",
          author: {
            "@type": "Person",
            name: "Ajibola Gbenga Joseph",
          },
        }),
      },
      // ProfessionalService schema
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Ajibola Gbenga Joseph — Website Design & Development",
          url: "https://ajibolagbengajoseph.site/",
          image: "https://ajibolagbengajoseph.site/me.webp",
          description: "Professional website design and development services. Custom websites, e-commerce, landing pages, full-stack web applications and tech advisory for businesses worldwide.",
          priceRange: "$$",
          areaServed: "Worldwide",
          availableLanguage: "English",
          serviceType: [
            "Website Design",
            "Website Development",
            "Web Design",
            "Web Development",
            "Full Stack Development",
            "WordPress Development",
            "E-Commerce Website Design",
            "Landing Page Design",
            "UI/UX Design",
            "Tech Advisory",
          ],
          founder: {
            "@type": "Person",
            name: "Ajibola Gbenga Joseph",
          },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Web Design & Development Services",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Website Design and Development",
                  description: "Custom, mobile-first website design and development built to convert visitors into clients.",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Full Stack Web Development",
                  description: "Scalable full-stack web applications using React, Next.js, Node.js and cloud platforms.",
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Tech Advisory",
                  description: "Strategic technology consulting, architecture planning and AI integration guidance.",
                },
              },
            ],
          },
        }),
      },
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
      <OfflineBanner />
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

    // Subscribe to incoming calls — only fires when the dashboard listener is NOT active.
    // Use a unique channel name (root-calls-) distinct from the dashboard (global-calls-)
    // so the two channels never share a channel object. The handler short-circuits
    // immediately if the dashboard's __setIncomingCall handler is already registered.
    const ch = supabase.channel(`root-calls-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "calls",
        filter: `receiver_id=eq.${user.id}`,
      }, async (payload) => {
        const call = payload.new as Call;
        if (call.status !== "ringing") return;

        // Dashboard is mounted and handles this — do nothing
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
