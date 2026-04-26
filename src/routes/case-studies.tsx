import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Plus, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/case-studies")({
  head: () => ({
    meta: [
      { title: "Portfolio — Ajibola Gbenga Joseph" },
      { name: "description", content: "Projects and case studies by Ajibola Gbenga Joseph — Website Designer & Software Developer." },
    ],
  }),
  component: PortfolioPage,
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

// ── Add your real projects here ──────────────────────────────────────────────
const projects = [
  {
    id: 1,
    title: "Edgebrook AI Solutions",
    category: "Web App",
    tags: ["React", "AI", "Supabase"],
    desc: "Co-founded and built the flagship platform for Edgebrook AI Solutions — an AI-powered digital agency platform serving clients across Africa and beyond.",
    result: "Live product",
    color: "from-blue-500 to-indigo-600",
    link: "#",
    featured: true,
  },
  {
    id: 2,
    title: "Business Landing Page",
    category: "Website Design",
    tags: ["HTML/CSS", "SEO", "Responsive"],
    desc: "High-converting landing page for a Nigerian business, optimized for Google ranking and mobile performance.",
    result: "+40% conversions",
    color: "from-emerald-500 to-teal-600",
    link: "#",
    featured: true,
  },
  {
    id: 3,
    title: "E-Commerce Store",
    category: "Web Development",
    tags: ["WordPress", "WooCommerce", "SEO"],
    desc: "Full e-commerce solution with product management, payment integration, and SEO optimization.",
    result: "3x organic traffic",
    color: "from-orange-500 to-red-500",
    link: "#",
    featured: false,
  },
  {
    id: 4,
    title: "Personal Brand Website",
    category: "Website Design",
    tags: ["React", "Animations", "CMS"],
    desc: "Premium personal portfolio for a professional, featuring smooth animations and a custom CMS for easy content updates.",
    result: "Brand authority",
    color: "from-purple-500 to-pink-500",
    link: "#",
    featured: false,
  },
  {
    id: 5,
    title: "Startup MVP",
    category: "Web App",
    tags: ["Next.js", "Supabase", "AI"],
    desc: "Built a full-stack MVP for a tech startup from zero to launch in 6 weeks, including auth, dashboard, and AI features.",
    result: "Launched in 6 weeks",
    color: "from-cyan-500 to-blue-500",
    link: "#",
    featured: false,
  },
  {
    id: 6,
    title: "SEO Campaign",
    category: "SEO",
    tags: ["Technical SEO", "Content", "Analytics"],
    desc: "Comprehensive SEO overhaul for a service business — technical fixes, content strategy, and link building.",
    result: "Page 1 Google",
    color: "from-green-500 to-emerald-500",
    link: "#",
    featured: false,
  },
];

const categories = ["All", "Website Design", "Web Development", "Web App", "SEO"];

function PortfolioPage() {
  useReveal();
  const [active, setActive] = useState("All");

  const filtered = active === "All" ? projects : projects.filter((p) => p.category === active);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-blob" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <Folder className="h-3.5 w-3.5" />
            My Work
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Projects &amp;
            <br />
            <span className="shimmer-text">Case Studies</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A selection of projects I've designed and built — each one a story of strategy, craft, and results.
          </p>
        </div>
      </section>

      {/* Filter tabs */}
      <section className="container mx-auto px-6 pb-8 section-reveal">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
                active === cat
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Projects grid */}
      <section className="container mx-auto px-6 pb-24 section-reveal">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p, i) => (
            <article
              key={p.id}
              className="group rounded-3xl border border-border bg-card overflow-hidden hover-lift card-glow transition-all duration-300"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {/* Color header */}
              <div className={`h-44 bg-gradient-to-br ${p.color} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {p.featured && (
                  <div className="absolute top-3 left-3 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-medium text-white">
                    Featured
                  </div>
                )}
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="text-xs text-white/70 mb-1">{p.category}</div>
                  <div className="text-xl font-bold text-white">{p.title}</div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur text-white">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {p.result}
                  </div>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </article>
          ))}

          {/* Add project placeholder */}
          <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 flex flex-col items-center justify-center text-center min-h-[300px] hover:border-primary/40 transition-colors group">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-all">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="font-semibold mb-2">More Coming Soon</h3>
            <p className="text-sm text-muted-foreground">New projects are added regularly. Check back soon.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20 section-reveal">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 text-center">
          <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Want Results Like These?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Let's work together on your next project.
            </p>
            <Button asChild size="lg" className="mt-8 h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/contact">Start a Project <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
