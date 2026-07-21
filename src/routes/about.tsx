import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, GraduationCap, Briefcase, Heart, Target, Eye, Star, Globe, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

const SITE_URL = "https://ajibola-gbenga-joseph.onrender.com";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Ajibola Gbenga Joseph | Professional Website Designer & Website Developer" },
      { name: "description", content: "Meet Ajibola Gbenga Joseph — professional website designer and website developer with 5+ years experience. Co-Founder of Edgebrook AI Solutions. Building custom websites that convert worldwide." },
      { name: "keywords", content: "Ajibola Gbenga Joseph, professional website designer, professional website developer, website designer Nigeria, website developer Nigeria, freelance website designer, freelance website developer, full stack developer Nigeria, Edgebrook AI Solutions, hire website designer, hire website developer" },
      { property: "og:title", content: "About Ajibola Gbenga Joseph | Professional Website Designer & Website Developer" },
      { property: "og:description", content: "Professional website designer and website developer with 5+ years experience. Co-Founder of Edgebrook AI Solutions." },
      { property: "og:url", content: `${SITE_URL}/about` },
      { property: "og:image", content: `${SITE_URL}/me.webp` },
      { property: "og:image:alt", content: "Ajibola Gbenga Joseph — Website Designer & Developer" },
      { name: "twitter:title", content: "About Ajibola Gbenga Joseph | Professional Website Designer & Developer" },
      { name: "twitter:description", content: "Professional website designer, full-stack developer & tech advisor with 5+ years experience. Co-Founder of Edgebrook AI Solutions." },
      { name: "twitter:image", content: `${SITE_URL}/me.webp` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/about` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "About Ajibola Gbenga Joseph | Professional Website Designer & Developer",
          url: `${SITE_URL}/about`,
          description: "Professional website designer, full-stack developer and tech advisor with 5+ years experience building custom websites and web applications worldwide.",
          inLanguage: "en",
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` },
            ],
          },
          mainEntity: {
            "@type": "Person",
            name: "Ajibola Gbenga Joseph",
            url: `${SITE_URL}/`,
            image: `${SITE_URL}/me.webp`,
            jobTitle: "Website Designer & Full-Stack Developer",
            description: "Professional website designer and full-stack developer with 5+ years of experience building modern, responsive, conversion-focused websites for businesses worldwide.",
            email: "gbengajosephajibola@gmail.com",
            nationality: "Nigerian",
            alumniOf: {
              "@type": "EducationalOrganization",
              name: "Polytechnic Nigeria",
              description: "National Diploma in Computer Science",
            },
            worksFor: {
              "@type": "Organization",
              name: "Edgebrook AI Solutions",
            },
            hasCredential: {
              "@type": "EducationalOccupationalCredential",
              name: "National Diploma in Computer Science",
            },
            knowsAbout: [
              "Website Design",
              "Website Development",
              "Web Design",
              "Web Development",
              "Full-Stack Development",
              "React",
              "Next.js",
              "WordPress",
              "UI/UX Design",
              "SEO",
              "E-Commerce Website Design",
              "Landing Page Design",
              "Mobile App Development",
              "Responsive Web Design",
            ],
            sameAs: [
              "https://www.tiktok.com/@joseph_4124",
              "https://www.youtube.com/@AjibolaGbengaJoseph1",
              "https://share.google/aXjcfG6DMAOnPqXk4",
            ],
          },
        }),
      },
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
      <GlobalExpansionSection />
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
              Professional Website Designer &amp; Website Developer
              <br />
              Co-Founder, Edgebrook AI Solutions
            </p>
          <p className="text-muted-foreground leading-relaxed">
            Meet Ajibola Gbenga Joseph — a dedicated <strong className="text-foreground">website designer</strong> and <strong className="text-foreground">website developer</strong> who began his journey in 2019. As a full-stack website developer and co-founder of Edgebrook AI Solutions, he brings a unique blend of creative design and technical expertise to every project. Whether you're a startup or an enterprise, Ajibola designs and develops dynamic, engaging websites tailored to your needs.
          </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                { icon: Briefcase, label: "5+ Years Experience" },
                { icon: GraduationCap, label: "ND Computer Science" },
                { icon: Star, label: "Age: 21" },
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
    { value: "5+", label: "Years Experience", desc: "Building digital products" },
    { value: "50+", label: "Projects Completed", desc: "Across multiple industries" },
    { value: "100%", label: "Client Satisfaction", desc: "Repeat clients & referrals" },
    { value: "3+", label: "Countries Served", desc: "Growing global client base" },
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
            My name is Ajibola Gbenga Joseph, and my journey into technology started with curiosity, passion, and 
            the desire to create something meaningful. From a young age, I was always interested in how websites, 
            apps, and digital platforms worked. What started as simple curiosity slowly turned into a dream I became 
            determined to achieve.
          </p>
          <p>
            I began learning website design and development with limited resources but a strong mindset to grow. 
            Along the way, I faced challenges, moments of doubt, and times when things didn't go as planned, but I 
            never allowed those moments to stop me. Instead, they pushed me to learn more, improve my skills, and 
            stay focused on my goals.
          </p>
          <p>
            Today, I am a professional website designer and website developer with a National Diploma 
            certification. I specialize in building modern, responsive, and conversion-focused websites that help 
            businesses and individuals establish a strong online presence. As a website designer, I create visually 
            stunning interfaces. As a website developer, I build them with clean, scalable code. Every project I work 
            on represents my creativity, dedication, and passion for technology.
          </p>
          <p>
            My vision is bigger than where I am today. I want to become a globally recognized tech professional, work 
            with international clients and companies, and build innovative solutions that create real impact. I am 
            constantly learning, improving my skills, and exploring new areas in technology including advanced web 
            development, cybersecurity, AI-powered solutions, and scalable applications.
          </p>
          <p className="text-foreground font-semibold">
            My story is still being written, and I believe the future holds greater opportunities, success, and 
            achievements. No matter how difficult the journey becomes, I remain committed to growth, excellence, and 
            becoming the best version of myself in the tech industry.
          </p>
        </div>
      </div>
    </section>
  );
}

function GlobalExpansionSection() {
  return (
    <section className="container mx-auto px-6 py-16 section-reveal">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-surface p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-hero opacity-40 pointer-events-none" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-8 w-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Global Expansion & Sponsorship Opportunities (UK / US) 🌍
            </h2>
          </div>
          
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              As part of my next phase of growth, I am actively seeking genuine sponsorship or relocation opportunities 
              specifically to the <span className="text-foreground font-semibold">United Kingdom</span> or the{" "}
              <span className="text-foreground font-semibold">United States</span>.
            </p>
            <p className="text-foreground font-medium">
              This is a serious and intentional step—not a casual request.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="rounded-xl border border-border bg-card/50 p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                I'm looking to connect with:
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Companies seeking a skilled Website Designer / Developer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Organizations open to international talent sponsorship</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Individuals or partners interested in supporting global tech growth</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card/50 p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                In return, I bring:
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Proven hands-on experience (5+ years)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Real project delivery across industries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Strong technical and problem-solving skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>A mindset focused on results, growth, and long-term value</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground leading-relaxed">
              My goal is not just to relocate, but to contribute meaningfully, collaborate at a higher level, and build 
              impactful digital solutions within a more advanced ecosystem.
            </p>
            <p className="text-sm text-foreground font-semibold mt-3">
              If you are in a position to support, sponsor, or connect me to the right opportunity in the UK or US, 
              I am open to serious discussions.
            </p>
          </div>
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
    desc: "To become a globally recognized digital creator known for innovative solutions and exceptional user experiences.",
  },
  {
    icon: Heart,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Core Values",
    desc: "Innovation • Integrity • Excellence • Client Success",
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
      year: "2022 — 2025",
      title: "National Diploma in Computer Science",
      org: "Polytechnic (Nigeria)",
      desc: "Graduated with a strong foundation in software engineering, algorithms, and system design.",
    },
    {
      year: "2025 — Present",
      title: "Co-Founder & Lead Developer",
      org: "Edgebrook AI Solutions",
      desc: "Building AI-powered digital products and leading full-cycle development from concept to deployment.",
    },
    {
      year: "2019 — Present",
      title: "Freelance Website Designer & Website Developer",
      org: "Independent",
      desc: "Delivered 50+ projects for startups, businesses, and personal brands as a freelance website designer and website developer. Creating systems that perform, convert, and scale.",
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
            Hire a Website Designer &amp; <span className="shimmer-text">Website Developer</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Looking for a website designer or website developer? Let's connect and build something impactful together.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-8 bg-gradient-primary hover:opacity-90 shadow-glow">
            <Link to="/contact">Start a Conversation <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
