import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Code2, Palette, Search, Cpu, Globe, Layers, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Ajibola Gbenga Joseph" },
      { name: "description", content: "Website design, web development, SEO optimization, and AI-powered digital solutions by Ajibola Gbenga Joseph." },
    ],
  }),
  component: ServicesPage,
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

const services = [
  {
    icon: Palette,
    title: "Website Design",
    tagline: "Designs that convert visitors into clients",
    desc: "I craft visually stunning, user-centered website designs that reflect your brand identity and drive conversions. Every layout is intentional — built to guide your visitors toward taking action.",
    features: ["Custom UI/UX Design", "Mobile-First Responsive", "Brand Identity Integration", "Conversion-Optimized Layouts", "Figma Prototyping"],
    color: "from-pink-500/20 to-purple-500/20",
    accent: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    icon: Code2,
    title: "Web Development",
    tagline: "Clean code, blazing performance",
    desc: "From simple landing pages to complex web applications, I build with modern frameworks and best practices. Your site will be fast, secure, and scalable — ready to grow with your business.",
    features: ["React / Next.js / HTML+CSS", "WordPress Development", "Custom Web Applications", "API Integration", "Performance Optimization"],
    color: "from-blue-500/20 to-cyan-500/20",
    accent: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Search,
    title: "SEO Optimization",
    tagline: "Get found by the right people",
    desc: "Ranking on Google isn't luck — it's strategy. I implement technical and on-page SEO that drives organic traffic, improves your domain authority, and puts you ahead of competitors.",
    features: ["Technical SEO Audit", "On-Page Optimization", "Keyword Research & Strategy", "Core Web Vitals", "Google Search Console Setup"],
    color: "from-green-500/20 to-emerald-500/20",
    accent: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Cpu,
    title: "AI-Powered Solutions",
    tagline: "The future of digital, today",
    desc: "As Co-Founder of Edgebrook AI Solutions, I integrate cutting-edge AI capabilities into digital products — from intelligent chatbots to automated workflows that save time and scale your business.",
    features: ["AI Chatbot Integration", "Automated Workflows", "Smart Content Systems", "Data-Driven Personalization", "AI-Assisted Development"],
    color: "from-orange-500/20 to-yellow-500/20",
    accent: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: Globe,
    title: "Digital Strategy",
    tagline: "Strategy before execution",
    desc: "Before writing a line of code, I help you define your digital strategy — understanding your audience, competitive landscape, and growth goals to ensure every decision drives results.",
    features: ["Competitor Analysis", "User Research", "Growth Roadmap", "Brand Positioning", "Content Strategy"],
    color: "from-violet-500/20 to-indigo-500/20",
    accent: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    icon: Layers,
    title: "Maintenance & Support",
    tagline: "I don't disappear after launch",
    desc: "Ongoing support, updates, and performance monitoring to keep your digital presence running at its best. Long-term partnerships are my standard — your success is my success.",
    features: ["Regular Updates & Patches", "Performance Monitoring", "Content Updates", "Security Audits", "Priority Support"],
    color: "from-teal-500/20 to-cyan-500/20",
    accent: "text-teal-400",
    bg: "bg-teal-400/10",
  },
];

function ServicesPage() {
  useReveal();
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-blob" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <Zap className="h-3.5 w-3.5" />
            What I Offer
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Services Built for
            <br />
            <span className="shimmer-text">Real Results</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From strategy to launch and beyond — every service is designed to grow your business,
            strengthen your brand, and deliver measurable outcomes.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="container mx-auto px-6 pb-24 section-reveal">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((s, i) => (
            <div
              key={s.title}
              className="group relative rounded-3xl border border-border bg-card overflow-hidden hover-lift card-glow transition-all duration-300"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Gradient top bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${s.color.replace('/20', '')}`} />
              <div className="p-8">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.bg} ${s.accent} mb-5 group-hover:scale-110 transition-transform`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div className={`text-xs font-medium ${s.accent} mb-2`}>{s.tagline}</div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{s.desc}</p>
                <ul className="space-y-2">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${s.accent}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="container mx-auto px-6 py-16 section-reveal">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How We Work Together</h2>
          <p className="mt-3 text-muted-foreground">A simple, transparent process from first call to final delivery.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[
            { step: "01", title: "Discovery Call", desc: "We discuss your goals, timeline, and budget." },
            { step: "02", title: "Proposal", desc: "I send a detailed scope, timeline, and pricing." },
            { step: "03", title: "Build & Iterate", desc: "Regular check-ins and revisions throughout." },
            { step: "04", title: "Launch & Support", desc: "Go live with confidence and ongoing support." },
          ].map((p, i) => (
            <div key={p.step} className="relative rounded-2xl border border-border bg-card p-6 hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 80}ms` }}>
              {i < 3 && <div className="hidden md:block absolute top-8 -right-2.5 w-5 h-px bg-border z-10" />}
              <div className="text-3xl font-bold text-gradient mb-3">{p.step}</div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20 section-reveal">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 text-center">
          <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Ready to Get Started?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Let's discuss your project and build something great together.
            </p>
            <Button asChild size="lg" className="mt-8 h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/contact">Book a Free Consultation <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
