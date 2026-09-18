import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Code2, Database, Zap, Shield, CheckCircle, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { generateSEOMeta, SCHEMA_TEMPLATES } from "@/lib/seo";

const SITE_URL = "https://ajibolagbengajoseph.site";

export const Route = createFileRoute("/website-development")({
  head: () => {
    const seoData = generateSEOMeta({
      title: "Website Development Services - Professional Web Developer",
      description: "Professional website development services by Ajibola Gbenga Joseph. Custom web development using React, Next.js, WordPress. Full-stack development that scales with your business.",
      keywords: [
        "website development",
        "web development services",
        "professional web developer",
        "custom web development",
        "full stack development",
        "React development",
        "Next.js development", 
        "WordPress development",
        "website developer Nigeria",
        "web application development"
      ],
      canonical: `${SITE_URL}/website-development`,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Professional Website Development Services",
          description: "Custom website development services using modern technologies. Full-stack web development that scales with your business.",
          provider: SCHEMA_TEMPLATES.person,
          areaServed: "Worldwide",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Website Development Services",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Custom Web Development",
                  description: "Scalable web applications built with modern technologies and best practices."
                }
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "E-commerce Development",
                  description: "Full-featured online stores with payment processing and inventory management."
                }
              }
            ]
          }
        },
        SCHEMA_TEMPLATES.breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "Website Development Services", url: `${SITE_URL}/website-development` }
        ])
      ]
    });

    return seoData;
  },
  component: WebsiteDevelopmentPage,
});

function WebsiteDevelopmentPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="container mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                Professional
                <span className="block text-gradient">Website Development</span>
                Services
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Custom website development that scales with your business. I'm Ajibola Gbenga Joseph, 
                a professional web developer specializing in React, Next.js, WordPress, and full-stack solutions 
                that perform under pressure.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
                  <Link to="/contact">Get Development Quote <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8">
                  <Link to="/case-studies">View Development Projects</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Technologies Section */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Development Technologies</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                I use modern, proven technologies to build websites that are fast, secure, and scalable.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Code2, title: "React & Next.js", desc: "Modern JavaScript frameworks for fast, interactive websites" },
                { icon: Database, title: "Full-Stack", desc: "Complete backend solutions with databases and APIs" },
                { icon: Zap, title: "Performance", desc: "Lightning-fast websites optimized for speed and SEO" },
                { icon: Shield, title: "Security", desc: "Built-in security measures to protect your website and data" }
              ].map((tech, index) => (
                <div key={index} className="text-center bg-card rounded-2xl p-6 border border-border hover-lift">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                    <tech.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-2">{tech.title}</h3>
                  <p className="text-sm text-muted-foreground">{tech.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Website Development Services</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From simple websites to complex web applications, I develop solutions that grow with your business.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: "Custom Web Development",
                  description: "Tailored web applications built to your exact specifications using modern technologies.",
                  features: ["React/Next.js development", "Custom functionality", "API integrations", "Database design", "Performance optimization"]
                },
                {
                  title: "E-commerce Development",
                  description: "Complete online store solutions with payment processing, inventory management, and more.",
                  features: ["Shopping cart functionality", "Payment gateway integration", "Inventory management", "Order processing", "Customer accounts"]
                },
                {
                  title: "WordPress Development",
                  description: "Custom WordPress websites and themes that are easy to manage and update.",
                  features: ["Custom theme development", "Plugin integration", "Content management", "SEO optimization", "Mobile responsiveness"]
                },
                {
                  title: "Web Application Development",
                  description: "Complex web applications with advanced functionality and user interactions.",
                  features: ["User authentication", "Real-time features", "Data visualization", "API development", "Cloud deployment"]
                }
              ].map((service, index) => (
                <div key={index} className="bg-card rounded-2xl p-8 border border-border hover-lift">
                  <h3 className="text-xl font-semibold mb-4">{service.title}</h3>
                  <p className="text-muted-foreground mb-6">{service.description}</p>
                  <ul className="space-y-2">
                    {service.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Development Process */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Development Process</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A systematic approach to web development that ensures quality, performance, and reliability.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
              {[
                { step: "01", title: "Planning", desc: "Technical requirements and architecture planning" },
                { step: "02", title: "Setup", desc: "Development environment and project structure" },
                { step: "03", title: "Build", desc: "Code development with best practices and testing" },
                { step: "04", title: "Test", desc: "Quality assurance and performance optimization" },
                { step: "05", title: "Deploy", desc: "Launch and ongoing support and maintenance" }
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
          <div className="container mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Need Professional Web Development?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Let's build a website that performs as well as it looks. Get in touch for a free consultation 
              and project quote.
            </p>
            <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
              <Link to="/contact">Start Your Development Project <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
      
      <SiteFooter />
    </div>
  );
}