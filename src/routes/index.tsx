import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Code2, Palette, Search, Layers, Cpu, Globe, ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ajibola Gbenga Joseph — Web Designer & Developer" },
      { name: "description", content: "I design and build websites that look great and actually work. Based in Nigeria, working with clients worldwide." },
    ],
  }),
  component: HomePage,
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

function HomePage() {
  useReveal();
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteHeader />
      <HeroSection />
      <WhatIDoSection />
      <IndustriesSection />
      <BenefitsSection />
      <ProcessSection />
      <WhyDifferentSection />
      <ToolsSection />
      <CTASection />
      <SiteFooter />
      <FloatingChat />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/5 blur-3xl animate-blob [animation-delay:3s]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="container mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center relative z-10">
        {/* Left — text */}
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Open to new projects
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] animate-fade-up">
            Designing Digital
            <br />
            <span className="shimmer-text">Experiences</span>
            <br />
            That Convert
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed animate-fade-up [animation-delay:120ms] opacity-0">
            I'm Ajibola Gbenga Joseph — a web designer, tech advisor and developer from Nigeria.
            I build websites that look sharp, load fast, and turn visitors into clients.
          </p>

          <div className="flex flex-wrap gap-3 animate-fade-up [animation-delay:240ms] opacity-0">
            <Button asChild size="lg" className="h-12 px-7 bg-gradient-primary hover:opacity-90 shadow-glow text-base gap-2">
              <Link to="/contact">Start a Project <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base">
              <Link to="/case-studies">See My Work</Link>
            </Button>
          </div>

          <div className="flex gap-8 pt-2 animate-fade-up [animation-delay:360ms] opacity-0">
            {[
              { value: "5+", label: "Years exp." },
              { value: "50+", label: "Projects done" },
              { value: "100%", label: "Satisfaction" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-gradient">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — floating info cards */}
        <div className="relative flex justify-center animate-reveal-right opacity-0">
          <div className="relative w-full max-w-sm space-y-4">
            <div className="glass border border-border/60 rounded-2xl px-5 py-4 shadow-card animate-float flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Experience</div>
                <div className="text-sm font-semibold">5+ Years Building</div>
              </div>
            </div>
            <div className="glass border border-border/60 rounded-2xl px-5 py-4 shadow-card animate-float [animation-delay:1s] flex items-center gap-4 ml-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Reach</div>
                <div className="text-sm font-semibold">Clients Worldwide</div>
              </div>
            </div>
            <div className="glass border border-border/60 rounded-2xl px-5 py-4 shadow-card animate-float [animation-delay:2s] flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Company</div>
                <div className="text-sm font-semibold">Edgebrook AI Solutions</div>
              </div>
            </div>
            <div className="glass border border-border/60 rounded-2xl px-5 py-4 shadow-card animate-float [animation-delay:3s] flex items-center gap-4 ml-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning shrink-0">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Nationality</div>
                <div className="text-sm font-semibold">🇳🇬 Nigeria</div>
              </div>
            </div>
            <div className="absolute inset-0 -z-10 bg-primary/5 blur-3xl rounded-full" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground animate-bounce">
        <span className="text-xs">Scroll</span>
        <ChevronDown className="h-4 w-4" />
      </div>
    </section>
  );
}

function WhatIDoSection() {
  const items = [
    { icon: Palette, title: "Website Design", desc: "Clean, modern designs that match your brand and guide visitors to take action." },
    { icon: Code2, title: "Software Development", desc: "Custom software solutions built to solve real problems — scalable, reliable and maintainable." },
    { icon: Cpu, title: "Tech Advisory", desc: "Not sure what tech stack or digital strategy fits your business? I'll guide you to the right decisions." },
  ];
  return (
    <section className="container mx-auto px-6 py-24 section-reveal">
      <div className="mb-12">
        <h2 className="text-4xl font-bold tracking-tight">What I Do</h2>
        <p className="mt-2 text-muted-foreground">Built for performance, not just looks.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((s, i) => (
          <div key={s.title} className="group rounded-2xl border border-border bg-card p-7 hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-all duration-300">
              <s.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IndustriesSection() {
  const items = ["Startups", "Small Businesses", "Personal Brands", "Large Companies", "Governments", "Schools"];
  return (
    <section className="container mx-auto px-6 py-12 section-reveal">
      <h2 className="text-4xl font-bold tracking-tight mb-2">Who I Work With</h2>
      <p className="text-muted-foreground mb-8">Doesn't matter the size — if you need a great website, let's talk.</p>
      <div className="flex flex-wrap gap-4">
        {items.map((ind, i) => (
          <div key={ind} className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 hover-lift card-glow transition-all duration-300 cursor-default" style={{ transitionDelay: `${i * 60}ms` }}>
            <span className="h-2 w-2 rounded-full bg-primary group-hover:scale-150 transition-transform" />
            <span className="font-medium">{ind}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BenefitsSection() {
  const items = [
    { icon: "📈", title: "More conversions", desc: "A site that actually turns visitors into paying clients — not just something that looks nice." },
    { icon: "🔍", title: "Better Google ranking", desc: "Show up when people search for what you offer. SEO built in from day one." },
    { icon: "🏆", title: "Credibility", desc: "A professional site makes people trust you before you even say a word." },
  ];
  return (
    <section className="container mx-auto px-6 py-12 section-reveal">
      <h2 className="text-4xl font-bold tracking-tight mb-2">What You Get</h2>
      <p className="text-muted-foreground mb-8">Real outcomes, not just a pretty website.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((b, i) => (
          <div key={b.title} className="rounded-2xl border border-border bg-card p-7 hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="text-4xl mb-4">{b.icon}</div>
            <h3 className="text-lg font-semibold">{b.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    { num: "01", title: "We talk", desc: "Tell me about your project. I'll ask the right questions." },
    { num: "02", title: "I design", desc: "You get mockups to review and approve before anything is built." },
    { num: "03", title: "I build", desc: "Clean code, tested on all devices, no surprises." },
    { num: "04", title: "We launch", desc: "I hand it over, walk you through it, and stay available." },
  ];
  return (
    <section className="container mx-auto px-6 py-12 section-reveal">
      <h2 className="text-4xl font-bold tracking-tight mb-2">How It Works</h2>
      <p className="text-muted-foreground mb-8">Simple process, no confusion.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {steps.map((s, i) => (
          <div key={s.num} className="relative rounded-2xl border border-border bg-card p-6 hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 80}ms` }}>
            {i < steps.length - 1 && <div className="hidden md:block absolute top-8 -right-2.5 w-5 h-px bg-border z-10" />}
            <div className="text-3xl font-bold text-gradient mb-3">{s.num}</div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyDifferentSection() {
  const items = [
    { icon: "🎯", title: "I think before I build", desc: "Every decision has a reason. I don't just copy templates and call it done." },
    { icon: "⚡", title: "I know my tools", desc: "React, WordPress, SEO, full stack — I pick what actually fits your project." },
    { icon: "🤝", title: "I stick around", desc: "After launch, I'm still here. Questions, updates, fixes — I've got you." },
  ];
  return (
    <section className="container mx-auto px-6 py-12 section-reveal">
      <h2 className="text-4xl font-bold tracking-tight mb-2">Why Work With Me</h2>
      <p className="text-muted-foreground mb-8">Honest answer — I care about the result, not just the invoice.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((d, i) => (
          <div key={d.title} className="rounded-2xl border border-border bg-card p-7 hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="text-4xl mb-4">{d.icon}</div>
            <h3 className="text-lg font-semibold">{d.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToolsSection() {
  const tools = [
    { icon: <Code2 className="h-4 w-4" />, name: "HTML / CSS / JS" },
    { icon: <Layers className="h-4 w-4" />, name: "WordPress" },
    { icon: <Search className="h-4 w-4" />, name: "SEO Tools" },
    { icon: <Cpu className="h-4 w-4" />, name: "React / Next.js" },
    { icon: <Globe className="h-4 w-4" />, name: "Supabase / Firebase" },
    { icon: <Palette className="h-4 w-4" />, name: "Figma" },
  ];
  return (
    <section className="container mx-auto px-6 py-12 section-reveal">
      <h2 className="text-4xl font-bold tracking-tight mb-2">Tools I Use</h2>
      <p className="text-muted-foreground mb-8">The stack behind the work.</p>
      <div className="flex flex-wrap gap-3">
        {tools.map((t, i) => (
          <div key={t.name} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium hover-lift card-glow transition-all duration-300" style={{ transitionDelay: `${i * 50}ms` }}>
            <span className="text-primary">{t.icon}</span>
            {t.name}
          </div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="container mx-auto px-6 py-20 section-reveal">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 md:p-16 text-center">
        <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Got a project? Let's talk.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            No long forms, no waiting. Just send me a message and we'll figure out the rest.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/contact">Get in Touch <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8">
              <Link to="/case-studies">View My Work</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatingChat() {
  return (
    <Link
      to="/auth"
      search={{ mode: "register" } as never}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90 transition-all hover:scale-105 animate-float"
      style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))", right: "calc(1.5rem + env(safe-area-inset-right, 0px))" }}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Message me</span>
    </Link>
  );
}
