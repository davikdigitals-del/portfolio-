import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle, Star, Users, Trophy, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { generateSEOMeta, SCHEMA_TEMPLATES } from "@/lib/seo";

const SITE_URL = "https://ajibolagbengajoseph.site";

export const Route = createFileRoute("/website-design")({
  head: () => {
    const seoData = generateSEOMeta({
      title: "Professional Website Design Services - Custom Website Designer",
      description: "Professional website design services by Ajibola Gbenga Joseph. Custom website design that converts visitors into clients. Mobile-first, SEO-optimized, and built to perform. Get a quote today.",
      keywords: [
        "website design",
        "website design services",
        "professional website design",
        "custom website design", 
        "business website design",
        "website designer Nigeria",
        "website design company",
        "responsive website design",
        "modern website design",
        "website redesign services"
      ],
      canonical: `${SITE_URL}/website-design`,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Professional Website Design Services",
          description: "Custom website design services that convert visitors into clients. Mobile-first, SEO-optimized designs built for performance.",
          provider: SCHEMA_TEMPLATES.person,
          areaServed: "Worldwide",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Website Design Services",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Custom Website Design",
                  description: "Unique website designs tailored to your brand and business goals."
                }
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service", 
                  name: "Responsive Website Design",
                  description: "Mobile-first website designs that work perfectly on all devices."
                }
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Website Redesign",
                  description: "Modernize your existing website with fresh design and better performance."
                }
              }
            ]
          }
        },
        SCHEMA_TEMPLATES.breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "Website Design Services", url: `${SITE_URL}/website-design` }
        ])
      ]
    });

    return seoData;
  },
  component: WebsiteDesignPage,
});

function WebsiteDesignPage() {
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
                <span className="block text-gradient">Website Design</span>
                Services
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Get a custom website design that doesn't just look great — it converts visitors into paying clients. 
                I'm Ajibola Gbenga Joseph, a professional website designer with 5+ years of experience creating 
                websites that perform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
                  <Link to="/contact">Get Your Website Design Quote <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8">
                  <Link to="/case-studies">View Design Portfolio</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Website Design Services</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From concept to launch, I provide comprehensive website design services that deliver results.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Custom Website Design",
                  description: "Unique designs tailored to your brand identity and business goals. No templates, no shortcuts.",
                  features: ["Brand-focused design", "Custom layouts", "Unique graphics", "Mobile-first approach"]
                },
                {
                  title: "Responsive Design",
                  description: "Websites that work perfectly on desktop, tablet, and mobile. Your audience can access you anywhere.",
                  features: ["Mobile optimization", "Cross-browser compatibility", "Fast loading times", "Touch-friendly interface"]
                },
                {
                  title: "Website Redesign",
                  description: "Modernize your existing website with fresh design and improved user experience.",
                  features: ["Modern aesthetics", "Better navigation", "Improved performance", "SEO optimization"]
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

        {/* Why Choose Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Why Choose My Website Design Services</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                I don't just create websites — I create digital experiences that drive business growth.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Star, title: "5+ Years Experience", desc: "Proven track record designing websites that convert" },
                { icon: Users, title: "50+ Happy Clients", desc: "Businesses worldwide trust my website design expertise" },
                { icon: Trophy, title: "100% Satisfaction", desc: "Every client gets exactly what they need to succeed" },
                { icon: Globe, title: "Worldwide Service", desc: "Professional website design services available globally" }
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                    <item.icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">My Website Design Process</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A proven process that ensures your website design project runs smoothly from start to finish.
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: "01", title: "Discovery", desc: "I learn about your business, goals, and target audience" },
                { step: "02", title: "Design", desc: "Create mockups and wireframes for your review and approval" },
                { step: "03", title: "Develop", desc: "Build your website with clean code and best practices" },
                { step: "04", title: "Launch", desc: "Go live with full support and documentation" }
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary text-primary-foreground font-bold text-lg mb-4">
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
            <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Let's create a website design that represents your brand and converts visitors into customers. 
              Get your free consultation today.
            </p>
            <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
              <Link to="/contact">Start Your Website Design Project <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
      
      <SiteFooter />
    </div>
  );
}