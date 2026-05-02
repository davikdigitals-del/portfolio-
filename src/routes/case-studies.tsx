import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, ExternalLink, Plus, Folder, MousePointer2 } from "lucide-react";
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

// Custom cursor effect
function useCustomCursor() {
  useEffect(() => {
    const cursor = document.createElement("div");
    cursor.className = "custom-cursor";
    document.body.appendChild(cursor);

    const cursorDot = document.createElement("div");
    cursorDot.className = "custom-cursor-dot";
    document.body.appendChild(cursorDot);

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let dotX = 0, dotY = 0;

    const moveCursor = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      const speed = 0.15;
      cursorX += (mouseX - cursorX) * speed;
      cursorY += (mouseY - cursorY) * speed;
      
      const dotSpeed = 0.5;
      dotX += (mouseX - dotX) * dotSpeed;
      dotY += (mouseY - dotY) * dotSpeed;

      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
      cursorDot.style.transform = `translate(${dotX}px, ${dotY}px)`;
      
      requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", moveCursor);
    animate();

    // Add hover effects
    const hoverElements = document.querySelectorAll("a, button, .portfolio-card");
    hoverElements.forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("cursor-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("cursor-hover"));
    });

    return () => {
      document.removeEventListener("mousemove", moveCursor);
      cursor.remove();
      cursorDot.remove();
    };
  }, []);
}

const projects = [
  {
    id: 1,
    title: "Hair Soda",
    category: "Website Design",
    tags: ["UI/UX", "Responsive", "E-Commerce"],
    desc: "Modern, vibrant hair salon website with booking system and product showcase. Clean design with smooth animations and mobile-first approach.",
    result: "Premium Design",
    color: "from-pink-500 to-rose-600",
    link: "https://hairsoda.ca/",
    image: "/portfolio1.png",
    featured: true,
  },
  {
    id: 2,
    title: "One Medical",
    category: "Web Development",
    tags: ["Healthcare", "Booking", "Responsive"],
    desc: "Healthcare platform with appointment scheduling, patient portal, and seamless user experience. Built for accessibility and performance.",
    result: "Live Platform",
    color: "from-blue-500 to-cyan-600",
    link: "https://www.onemedical.com/",
    image: "/portfolio2.png",
    featured: true,
  },
  {
    id: 3,
    title: "Hoffman Car Wash",
    category: "Website Design",
    tags: ["Business", "SEO", "Conversion"],
    desc: "High-converting car wash business website with location finder, service packages, and membership options. Optimized for local SEO.",
    result: "+40% conversions",
    color: "from-emerald-500 to-teal-600",
    link: "https://www.hoffmancarwash.com/",
    image: "/portfolio3.png",
    featured: true,
  },
  {
    id: 4,
    title: "Interiors NZ",
    category: "Web Development",
    tags: ["Portfolio", "Gallery", "Luxury"],
    desc: "Elegant interior design portfolio showcasing luxury projects with immersive gallery and smooth transitions. Premium feel throughout.",
    result: "Brand Authority",
    color: "from-purple-500 to-indigo-500",
    link: "https://interiors.co.nz/",
    image: "/portfolio4.png",
    featured: false,
  },
  {
    id: 5,
    title: "John Farhat Homes",
    category: "Website Design",
    tags: ["Real Estate", "Luxury", "CMS"],
    desc: "Luxury real estate website featuring property listings, virtual tours, and lead generation. Built for high-end market positioning.",
    result: "Premium Listings",
    color: "from-amber-500 to-orange-500",
    link: "https://www.johnfarhathomes.com/",
    image: "/portfolio5.png",
    featured: false,
  },
  {
    id: 6,
    title: "Shereen Hoban",
    category: "Web Development",
    tags: ["Personal Brand", "Portfolio", "Animations"],
    desc: "Personal brand website with smooth animations, custom CMS, and engaging storytelling. Designed to showcase expertise and personality.",
    result: "Brand Presence",
    color: "from-violet-500 to-purple-500",
    link: "https://shereenhoban.com/",
    image: "/portfolio6.png",
    featured: false,
  },
  {
    id: 7,
    title: "Matt Construction",
    category: "Website Design",
    tags: ["Construction", "Portfolio", "Business"],
    desc: "Professional construction company website with project gallery, services showcase, and contact forms. Built for credibility and lead generation.",
    result: "Industry Leader",
    color: "from-slate-500 to-gray-600",
    link: "https://www.mattconstruction.com/",
    image: "/portfolio7.png",
    featured: false,
  },
  {
    id: 8,
    title: "CourseVia",
    category: "Web Development",
    tags: ["Education", "Platform", "E-Learning"],
    desc: "Modern e-learning platform with course management, student dashboard, and interactive learning tools. Built for scalability and user engagement.",
    result: "Learning Hub",
    color: "from-green-500 to-emerald-600",
    link: "https://coursevia.site/",
    image: "/portfolio8.png",
    featured: false,
  },
  {
    id: 9,
    title: "Classic 57 Auto Detailing",
    category: "Website Design",
    tags: ["Automotive", "Business", "Local SEO"],
    desc: "Professional auto detailing website showcasing premium services, pricing packages, and online booking. Designed to attract local customers and build trust.",
    result: "Local Authority",
    color: "from-red-500 to-orange-600",
    link: "http://classic57autodetailing.ca/",
    image: "/portfolio 9.png",
    featured: false,
  },
];

const categories = ["All", "Website Design", "Web Development"];

function PortfolioPage() {
  useReveal();
  useCustomCursor();
  const [active, setActive] = useState("All");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const filtered = active === "All" ? projects : projects.filter((p) => p.category === active);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden portfolio-page">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-blob" />
          <div className="absolute bottom-1/3 left-1/4 w-96 h-96 rounded-full bg-purple-500/8 blur-3xl animate-blob animation-delay-2000" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6 hover:scale-105 transition-transform">
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
        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                active === cat
                  ? "bg-gradient-primary text-primary-foreground shadow-glow scale-105"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-md"
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
              className="portfolio-card group rounded-3xl border border-border bg-card overflow-hidden hover-lift card-glow transition-all duration-500"
              style={{ 
                transitionDelay: `${i * 80}ms`,
                transform: hoveredId === p.id ? 'scale(1.02)' : 'scale(1)'
              }}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Image preview */}
              <div className="relative h-56 overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800">
                <img 
                  src={p.image} 
                  alt={p.title}
                  className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />
                
                {p.featured && (
                  <div className="absolute top-3 left-3 rounded-full bg-gradient-primary backdrop-blur px-3 py-1 text-xs font-medium text-white shadow-lg animate-pulse-slow">
                    Featured
                  </div>
                )}
                
                <div className="absolute bottom-4 left-5 right-5 transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                  <div className="text-xs text-white/70 mb-1 font-medium">{p.category}</div>
                  <div className="text-xl font-bold text-white drop-shadow-lg">{p.title}</div>
                </div>
                
                <a
                  href={p.link}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur text-gray-900 hover:bg-white hover:scale-110 transition-all shadow-lg">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </a>
              </div>

              <div className="p-6">
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.tags.map((t, idx) => (
                    <span 
                      key={t} 
                      className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-default"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">{p.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {p.result}
                  </div>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors group/link"
                  >
                    View <ExternalLink className="h-3 w-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20 section-reveal">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-12 text-center hover:border-primary/40 transition-all duration-500 group">
          <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none group-hover:opacity-80 transition-opacity" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-blob" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight group-hover:scale-105 transition-transform duration-300">
              Want Results Like These?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Let's work together on your next project.
            </p>
            <Button asChild size="lg" className="mt-8 h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow hover:shadow-xl hover:scale-105 transition-all duration-300">
              <Link to="/contact">Start a Project <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
      
      <style>{`
        .custom-cursor {
          position: fixed;
          width: 40px;
          height: 40px;
          border: 2px solid hsl(var(--primary));
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          transition: width 0.3s, height 0.3s, border-color 0.3s;
          mix-blend-mode: difference;
        }
        
        .custom-cursor-dot {
          position: fixed;
          width: 8px;
          height: 8px;
          background: hsl(var(--primary));
          border-radius: 50%;
          pointer-events: none;
          z-index: 10000;
          box-shadow: 0 0 10px hsl(var(--primary));
        }
        
        .custom-cursor.cursor-hover {
          width: 60px;
          height: 60px;
          border-color: hsl(var(--primary) / 0.5);
          background: hsl(var(--primary) / 0.1);
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        .portfolio-card {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
