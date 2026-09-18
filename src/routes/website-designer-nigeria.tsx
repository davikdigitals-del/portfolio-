import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Star, Users, Trophy, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { generateSEOMeta, SCHEMA_TEMPLATES } from "@/lib/seo";

const SITE_URL = "https://ajibolagbengajoseph.site";

export const Route = createFileRoute("/website-designer-nigeria")({
  head: () => {
    const seoData = generateSEOMeta({
      title: "Professional Website Designer in Nigeria - Custom Website Design",
      description: "Looking for a professional website designer in Nigeria? Ajibola Gbenga Joseph creates custom, conversion-focused websites for Nigerian businesses. Based in Lagos, serving clients nationwide.",
      keywords: [
        "website designer Nigeria",
        "website designer Lagos",
        "Nigerian website designer",
        "professional website designer Nigeria",
        "website design Nigeria",
        "Lagos website designer",
        "website designer in Nigeria",
        "Nigeria web designer",
        "Nigerian web designer",
        "website design services Nigeria"
      ],
      canonical: `${SITE_URL}/website-designer-nigeria`,
      schema: [
        {
          ...SCHEMA_TEMPLATES.person,
          address: {
            "@type": "PostalAddress",
            addressCountry: "Nigeria",
            addressRegion: "Lagos State",
            addressLocality: "Lagos"
          },
          areaServed: [
            { "@type": "Country", name: "Nigeria" },
            { "@type": "State", name: "Lagos State" },
            { "@type": "City", name: "Lagos" },
            { "@type": "City", name: "Abuja" },
            { "@type": "City", name: "Port Harcourt" },
            { "@type": "City", name: "Kano" },
            { "@type": "City", name: "Ibadan" }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Ajibola Gbenga Joseph - Website Designer Nigeria",
          image: `${SITE_URL}/me.webp`,
          telephone: "+234-XXX-XXX-XXXX",
          email: "gbengajosephajibola@gmail.com",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Lagos",
            addressLocality: "Lagos",
            addressRegion: "Lagos State", 
            addressCountry: "Nigeria"
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: "6.5244",
            longitude: "3.3792"
          },
          url: `${SITE_URL}/website-designer-nigeria`,
          sameAs: [
            "https://www.tiktok.com/@joseph_4124",
            "https://www.youtube.com/@AjibolaGbengaJoseph1"
          ],
          openingHours: "Mo-Fr 09:00-18:00",
          priceRange: "$$",
          currenciesAccepted: "NGN, USD",
          paymentAccepted: "Bank Transfer, PayPal, Cryptocurrency"
        },
        SCHEMA_TEMPLATES.breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "Website Designer Nigeria", url: `${SITE_URL}/website-designer-nigeria` }
        ])
      ]
    });

    return seoData;
  },
  component: WebsiteDesignerNigeriaPage,
});

function WebsiteDesignerNigeriaPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-green-500/5" />
          <div className="container mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <MapPin className="h-4 w-4" />
                Based in Lagos, Nigeria 🇳🇬
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                Professional
                <span className="block text-gradient">Website Designer</span>
                in Nigeria
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                I'm Ajibola Gbenga Joseph, a professional website designer based in Lagos, Nigeria. 
                I create custom, conversion-focused websites for Nigerian businesses and entrepreneurs. 
                From Lagos to Abuja, Port Harcourt to Kano — I help Nigerian businesses succeed online.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
                  <Link to="/contact">Get Your Nigerian Business Online <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8">
                  <Link to="/case-studies">View Nigerian Client Projects</Link>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" />
                  <span>Lagos Based</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-500" />
                  <span>Nigeria Nationwide</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span>50+ Nigerian Clients</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose a Nigerian Website Designer */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Why Choose a Nigerian Website Designer?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Working with a local Nigerian website designer offers unique advantages for your business.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: "🇳🇬",
                  title: "Local Market Understanding",
                  description: "I understand Nigerian business culture, customer behavior, and market dynamics to create websites that resonate with your local audience."
                },
                {
                  icon: "💰", 
                  title: "Affordable Nigerian Rates",
                  description: "Get world-class website design at Nigerian-friendly prices. Payment in Naira accepted alongside USD and other currencies."
                },
                {
                  icon: "🕐",
                  title: "Same Time Zone",
                  description: "No communication delays. I work in WAT (West Africa Time), making collaboration smooth and efficient for Nigerian businesses."
                },
                {
                  icon: "🏪",
                  title: "Local Business Focus",
                  description: "Specialized experience with Nigerian businesses, from startups in Lagos to established companies across the country."
                },
                {
                  icon: "📱",
                  title: "Mobile-First for Nigeria",
                  description: "Understanding that most Nigerians access the internet via mobile, I design mobile-first websites that work on all devices."
                },
                {
                  icon: "🚀",
                  title: "Fast Loading in Nigeria",
                  description: "Optimized for Nigerian internet infrastructure to ensure your website loads quickly even with slower connections."
                }
              ].map((benefit, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border hover-lift">
                  <div className="text-4xl mb-4">{benefit.icon}</div>
                  <h3 className="text-lg font-semibold mb-3">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nigerian Cities Served */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Nigerian Cities I Serve</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Professional website design services available across Nigeria. Based in Lagos, serving businesses nationwide.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { city: "Lagos", state: "Lagos State", highlight: true },
                { city: "Abuja", state: "FCT" },
                { city: "Port Harcourt", state: "Rivers State" },
                { city: "Kano", state: "Kano State" },
                { city: "Ibadan", state: "Oyo State" },
                { city: "Jos", state: "Plateau State" },
                { city: "Kaduna", state: "Kaduna State" },
                { city: "Warri", state: "Delta State" }
              ].map((location, index) => (
                <div 
                  key={index} 
                  className={`text-center p-4 rounded-xl border transition-all hover-lift ${
                    location.highlight 
                      ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20' 
                      : 'bg-card border-border'
                  }`}
                >
                  <h3 className="font-semibold">{location.city}</h3>
                  <p className="text-sm text-muted-foreground">{location.state}</p>
                  {location.highlight && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
                        <MapPin className="h-3 w-3" />
                        Based Here
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services for Nigerian Businesses */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Website Design Services for Nigerian Businesses</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Tailored website design solutions that help Nigerian businesses compete locally and globally.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: "Small Business Websites",
                  description: "Perfect for Nigerian SMEs, startups, and entrepreneurs looking to establish their online presence.",
                  features: ["Mobile-responsive design", "Local SEO optimization", "Contact forms", "Social media integration", "Naira pricing available"]
                },
                {
                  title: "E-commerce Websites", 
                  description: "Online stores optimized for the Nigerian market with local payment gateway integration.",
                  features: ["Paystack integration", "Bank transfer options", "Inventory management", "Customer accounts", "Mobile checkout"]
                },
                {
                  title: "Corporate Websites",
                  description: "Professional corporate websites for established Nigerian companies and organizations.",
                  features: ["Professional design", "Multi-page structure", "Team profiles", "Service showcases", "Corporate branding"]
                },
                {
                  title: "Portfolio Websites",
                  description: "Showcase your work and attract Nigerian clients with a professional portfolio website.",
                  features: ["Project galleries", "Client testimonials", "Contact integration", "Mobile optimization", "Fast loading"]
                }
              ].map((service, index) => (
                <div key={index} className="bg-card rounded-2xl p-8 border border-border hover-lift">
                  <h3 className="text-xl font-semibold mb-4">{service.title}</h3>
                  <p className="text-muted-foreground mb-6">{service.description}</p>
                  <ul className="space-y-2">
                    {service.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Success Stories */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Nigerian Business Success Stories</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See how I've helped Nigerian businesses grow their online presence and increase revenue.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  business: "Lagos Fashion Brand",
                  result: "300% increase in online sales",
                  description: "E-commerce website with Paystack integration helped this Lagos fashion brand reach customers nationwide."
                },
                {
                  business: "Abuja Consulting Firm", 
                  result: "5x more client inquiries",
                  description: "Professional corporate website positioned this Abuja firm as a leader in their industry."
                },
                {
                  business: "Port Harcourt Restaurant",
                  result: "200% more reservations",
                  description: "Mobile-optimized website with online booking increased reservations for this popular restaurant."
                }
              ].map((story, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border hover-lift text-center">
                  <div className="text-2xl font-bold text-green-500 mb-2">{story.result}</div>
                  <h3 className="font-semibold mb-3">{story.business}</h3>
                  <p className="text-sm text-muted-foreground">{story.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 bg-gradient-to-r from-green-500/10 via-green-500/5 to-green-500/10">
          <div className="container mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Ready to Grow Your Nigerian Business Online?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join hundreds of Nigerian businesses that have transformed their online presence with professional website design. 
              Let's discuss your project today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-12 px-8 bg-gradient-primary hover:opacity-90">
                <Link to="/contact">Start Your Nigerian Business Website <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 border-green-500/20 hover:bg-green-500/10">
                <Link to="tel:+234XXXXXXXXX">Call Now: +234-XXX-XXX-XXXX</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <SiteFooter />
    </div>
  );
}