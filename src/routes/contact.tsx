import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { MapPin, Clock, MessageCircle, ArrowRight, MapPinned, Youtube } from "lucide-react";
import { FaTiktok, FaThreads } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

const SITE_URL = "https://ajibolagbengajoseph.site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Hire a Website Designer & Website Developer | Contact Ajibola Gbenga Joseph" },
      { name: "description", content: "Ready to hire a professional website designer or website developer? Get in touch with Ajibola Gbenga Joseph. Available for website design, website development, and digital projects worldwide. Reply within 24 hours." },
      { name: "keywords", content: "hire website designer, hire website developer, website designer for hire, website developer for hire, professional website designer, professional website developer, freelance website designer, freelance website developer, contact website designer, website design quote, website development quote, website designer Nigeria, website developer Nigeria, get website designed, website design consultation" },
      { property: "og:title", content: "Hire a Website Designer & Website Developer | Contact Ajibola Gbenga Joseph" },
      { property: "og:description", content: "Ready to hire a professional website designer or website developer? Available worldwide. Reply within 24 hours." },
      { property: "og:url", content: `${SITE_URL}/contact` },
      { property: "og:image", content: `${SITE_URL}/me.webp` },
      { property: "og:image:alt", content: "Hire Ajibola Gbenga Joseph — Website Designer & Developer" },
      { name: "twitter:title", content: "Hire a Website Designer & Website Developer | Contact Ajibola Gbenga Joseph" },
      { name: "twitter:description", content: "Ready to hire a professional website designer or website developer? Available worldwide. Reply within 24 hours." },
      { name: "twitter:image", content: `${SITE_URL}/me.webp` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/contact` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Hire a Website Designer & Website Developer | Contact Ajibola Gbenga Joseph",
          url: `${SITE_URL}/contact`,
          description: "Contact Ajibola Gbenga Joseph to hire a professional website designer and website developer for your next project.",
          inLanguage: "en",
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
            ],
          },
          mainEntity: {
            "@type": "Person",
            name: "Ajibola Gbenga Joseph",
            jobTitle: "Website Designer & Website Developer",
            email: "gbengajosephajibola@gmail.com",
            url: `${SITE_URL}/`,
            availableService: [
              { "@type": "Service", name: "Website Design", serviceType: "Website Design" },
              { "@type": "Service", name: "Website Development", serviceType: "Web Development" },
              { "@type": "Service", name: "E-Commerce Website Design", serviceType: "E-Commerce" },
              { "@type": "Service", name: "Landing Page Design", serviceType: "Landing Page" },
              { "@type": "Service", name: "Full Stack Development", serviceType: "Full Stack Development" },
            ],
          },
        }),
      },
    ],
  }),
  component: ContactPage,
});

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".section-reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function ContactPage() {
  useReveal();
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-blob [animation-delay:4s]" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Available for new projects
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Hire a Website Designer
              <br />
              <span className="shimmer-text">&amp; Website Developer</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Looking to hire a professional <strong className="text-foreground">website designer</strong> or <strong className="text-foreground">website developer</strong>? I'd love to hear about your project.
              Send me a message and I'll get back to you within 24 hours.
            </p>

            {/* Primary CTA */}
            <div className="mt-10">
              <Button
                asChild
                size="lg"
                className="h-14 px-10 bg-gradient-primary hover:opacity-90 shadow-glow text-base gap-3 rounded-2xl"
              >
                <Link to="/auth" search={{ mode: "register" } as never}>
                  <MessageCircle className="h-5 w-5" />
                  Send Me a Message
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Sign up free · No credit card · Reply within 24h
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info cards */}
      <section className="container mx-auto px-6 pb-20 section-reveal">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: MessageCircle, label: "Send a Message", value: "Direct chat with me", href: "/auth?mode=register", color: "bg-primary/10 text-primary" },
            { icon: MapPin, label: "Location", value: "Nigeria · Available Worldwide", href: null, color: "bg-success/10 text-success" },
            { icon: Clock, label: "Response Time", value: "Within 24 hours", href: null, color: "bg-warning/10 text-warning" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-card p-6 hover-lift card-glow transition-all duration-300 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color} mx-auto mb-4`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
              {item.href ? (
                <Link to={item.href} className="text-sm font-medium hover:text-primary transition-colors break-all">{item.value}</Link>
              ) : (
                <div className="text-sm font-medium">{item.value}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Social links */}
      <section className="container mx-auto px-6 pb-24 section-reveal">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Connect With Me</h2>
            <p className="text-sm text-muted-foreground mb-8">Message me directly or find me on social media.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {[
                { icon: MessageCircle, label: "Send Message", href: "/auth?mode=register", color: "hover:border-primary/40" },
                { icon: MapPinned, label: "Google My Business", href: "https://share.google/aXjcfG6DMAOnPqXk4", color: "hover:border-red-400/40" },
                { icon: FaTiktok, label: "TikTok", href: "https://www.tiktok.com/@joseph_4124", color: "hover:border-pink-400/40" },
                { icon: Youtube, label: "YouTube", href: "https://www.youtube.com/@AjibolaGbengaJoseph1", color: "hover:border-red-500/40" },
                { icon: FaThreads, label: "Threads", href: "https://www.threads.com/@gbengajosephajibola", color: "hover:border-black/40" },
              ].map((s) => (
                <Link
                  key={s.label}
                  to={s.href as any}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover-lift ${s.color}`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="container mx-auto px-6 pb-24 section-reveal">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 text-center max-w-3xl mx-auto">
          <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
          <div className="relative">
            {/* Availability indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-success" />
                <div className="absolute inset-0 rounded-full bg-success animate-pulse-ring" />
              </div>
              <span className="text-sm font-medium">Currently available for new projects</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
              Click below, sign up in seconds, and send me your first message directly.
            </p>
            <Button
              asChild
              size="lg"
              className="h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow gap-2"
            >
              <Link to="/auth" search={{ mode: "register" } as never}>
                <MessageCircle className="h-4 w-4" />
                Start a Conversation
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
