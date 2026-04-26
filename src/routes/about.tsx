import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, GraduationCap, Briefcase, Heart, Target, Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About â€” Ajibola Gbenga Joseph" },
      { name: "description", content: "Website Designer & Software Developer | Co-Founder, Edgebrook AI Solutions. 5+ years creating scalable digital experiences." },
    ],
  }),
  component: AboutPage,
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

function AboutPage() {
  useReveal();
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteHeader />
      <AboutHero />
      <StatsSection />
      <BioSection />
      <MVVSection />
      <EducationSection />
      <CTABanner />
      <SiteFooter />
    </div>
  );
}

function AboutHero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-blob [animation-delay:4s]" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="space-y-6 animate-reveal-left opacity-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              About Me
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Ajibola Gbenga
              <br />
              <span className="shimmer-text">Joseph</span>
            </h1>
            <p className="text-lg text-primary font-semibold">
              Website Designer &amp; Software Developer
              <br />
              Co-Founder, Edgebrook AI Solutions
            </p>
            <p className="text-muted-foreground leading-relaxed">
              I create digital experiences that are visually stunning, responsive, and performance-driven,
              delivering measurable results for clients worldwide. With over 5 years of hands-on experience,
              I combine strategic thinking with technical excellence to build products that truly perform.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                { icon: Briefcase, label: "5+ Years Experience" },
                { icon: GraduationCap, label: "ND Computer Science" },
                { icon: Star, label: "Nigeria" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                  <b.icon className="h-4 w-4 text-primary" />
                  {b.label}
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                <Briefcase className="h-4 w-4 text-primary" />
                Edgebrook AI Solutions
              </div>
            </div>
          </div>

          {/* Photo card */}
          <div className="relative flex justify-center animate-reveal-right opacity-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-primary opacity-15 blur-2xl scale-110" />
              <div className="relative w-72 h-80 md:w-80 md:h-96 rounded-3xl overflow-hidden border border-border/60 shadow-elevated">
              <img
                src="/me.webp"
                alt="Ajibola Gbenga Joseph"
                className="w-full h-full object-cover object-top"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/60 to-transparent" />
            </div>
              {/* Decorative ring */}
              <div className="absolute -inset-4 rounded-3xl border border-primary/10 animate-spin-slow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "5+", label: "Years of Experience", desc: "Building digital products" },
    { value: "50+", label: "Projects Completed", desc: "Across multiple industries" },
    { value: "100%", label: "Client Satisfaction", desc: "Repeat clients & referrals" },
    { value: "3+", label: "Countries Served", desc: "Global client base" },
  ];
  return (
    <section className="container mx-auto px-6 py-16 section-reveal">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-6 text-center hover-lift card-glow transition-all duration-300"
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="text-4xl font-bold text-gradient">{s.value}</div>
            <div className="mt-2 font-semibold text-sm">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BioSection() {
  return (
    <section className="container mx-auto px-6 py-16 section-reveal">
      <div className="max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">My Story</h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            I'm Ajibola Gbenga Joseph â€” a passionate Website Designer and Software Developer based in Nigeria,
            with a National Diploma in Computer Science and over 5 years of professional experience building digital solutions
            that drive real business results.
          </p>
          <p>
            As Co-Founder of <span className="text-foreground font-medium">Edgebrook AI Solutions</span>, I lead
            the design and development of innovative digital products, combining cutting-edge AI capabilities with
            beautiful, user-centered design. My work spans startups, established businesses, and personal brands
            across multiple industries.
          </p>
          <p>
            I believe great design is invisible â€” it just works. Every project I take on is approached with a
            strategy-first mindset: understanding the business goals, the target audience, and the competitive
            landscape before writing a single line of code or placing a single pixel.
          </p>
          <p>
            When I'm not building, I'm learning â€” staying ahead of the curve in web technologies, AI integration,
            and digital marketing so my clients always get the most modern, effective solutions available.
          </p>
        </div>
      </div>
    </section>
  );
}

const mvv = [
  {
    icon: Target,
    color: "text-red-400",
    bg: "bg-red-400/10",
    title: "Mission",
    desc: "To deliver high-quality, scalable websites and software solutions that help businesses grow and succeed online.",
  },
  {
    icon: Eye,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Vision",
    desc: "To become a leading digital creator, known for innovative solutions and exceptional user experiences worldwide.",
  },
  {
    icon: Heart,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Values",
    desc: "Innovation, Integrity, Excellence, and Client Success are the core values guiding every project I undertake.",
  },
];

function MVVSection() {
  return (
    <section className="container mx-auto px-6 py-16 section-reveal">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">Mission, Vision &amp; Values</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {mvv.map((item, i) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border bg-card p-7 hover-lift card-glow transition-all duration-300"
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.bg} ${item.color} mb-5`}>
              <item.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection() {
  const items = [
    {
      year: "2019 â€“ 2023",
      title: "National Diploma in Computer Science",
      org: "Polytechnic (Nigeria)",
      desc: "Graduated with a strong foundation in software engineering, algorithms, and systems design.",
    },
    {
      year: "2023 â€“ Present",
      title: "Co-Founder & Lead Developer",
      org: "Edgebrook AI Solutions",
      desc: "Building AI-powered digital products and leading a team of designers and developers.",
    },
    {
      year: "2019 â€“ Present",
      title: "Freelance Web Designer & Developer",
      org: "Independent",
      desc: "Delivered 50+ projects for clients across startups, businesses, and personal brands worldwide.",
    },
  ];

  return (
    <section className="container mx-auto px-6 py-16 section-reveal">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">Education &amp; Experience</h2>
      <div className="relative space-y-6 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border">
        {items.map((item, i) => (
          <div
            key={item.title}
            className="relative pl-12"
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className="absolute left-0 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-primary">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 hover-lift card-glow transition-all duration-300">
              <div className="text-xs text-primary font-medium mb-1">{item.year}</div>
              <h3 className="font-semibold">{item.title}</h3>
              <div className="text-sm text-muted-foreground">{item.org}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTABanner() {
  return (
    <section className="container mx-auto px-6 py-20 section-reveal">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 text-center">
        <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Let's Build Something <span className="shimmer-text">Exceptional Together</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            Ready to take your digital presence to the next level? Let's talk.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow">
            <Link to="/contact">Start a Project <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
