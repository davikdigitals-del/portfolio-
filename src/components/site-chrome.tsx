import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function SiteHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { to: "/", label: "Home", exact: true },
    { to: "/about", label: "About" },
    { to: "/services", label: "Services" },
    { to: "/case-studies", label: "Portfolio" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "glass border-b border-border/40 shadow-card" : "bg-transparent"}`}>
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-border/60 shadow-glow transition-transform group-hover:scale-110">
            <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
          </div>
          <span className="text-lg font-bold tracking-tight">Ajibola.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: !!l.exact }}
              className="text-muted-foreground hover:text-foreground transition-colors relative group"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-primary group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90 shadow-glow">
                <Link to="/contact">Hire Me</Link>
              </Button>
            </>
          )}
          <button className="md:hidden p-2 text-muted-foreground hover:text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-border/40 px-6 py-4 space-y-3 animate-fade-up">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5"
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border/40">
            <Button asChild size="sm" className="w-full bg-gradient-primary hover:opacity-90 shadow-glow">
              <Link to="/contact" onClick={() => setOpen(false)}>Hire Me</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 mt-20">
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden border border-border/60 shadow-glow">
                <img src="/me.webp" alt="Ajibola" className="w-full h-full object-cover object-top" />
              </div>
              <span className="font-bold">Ajibola.</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Website Designer &amp; Software Developer creating scalable, high-performance digital solutions worldwide.
            </p>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="space-y-3">
              <div className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Pages</div>
              {[
                { to: "/", label: "Home" },
                { to: "/about", label: "About" },
                { to: "/services", label: "Services" },
                { to: "/case-studies", label: "Portfolio" },
              ].map((l) => (
                <Link key={l.to} to={l.to} className="block text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
              ))}
            </div>
            <div className="space-y-3">
              <div className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Connect</div>
              <Link to="/contact" className="block text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
              <Link to="/contact" className="block text-muted-foreground hover:text-foreground transition-colors">Start a Project</Link>
              <a href="mailto:ajibolagbengajoseph@gmail.com" className="block text-muted-foreground hover:text-foreground transition-colors">Email</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Ajibola Gbenga Joseph · Co-Founder, Edgebrook AI Solutions</span>
          <span>All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
