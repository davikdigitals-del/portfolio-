import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { generateSEOMeta, SCHEMA_TEMPLATES } from "@/lib/seo";

const SITE_URL = "https://ajibolagbengajoseph.site";

const faqs = [
  {
    category: "Website Design",
    questions: [
      {
        question: "How much does professional website design cost?",
        answer: "Website design costs vary depending on complexity and requirements. A basic business website starts from $500, while custom e-commerce sites begin at $1,500. I provide detailed quotes after understanding your specific needs during our initial consultation."
      },
      {
        question: "How long does it take to design a website?",
        answer: "Most website design projects take 2-4 weeks from start to finish. This includes initial consultation, design mockups, revisions, development, and launch. Complex projects with custom functionality may take 4-8 weeks."
      },
      {
        question: "Do you design websites for small businesses?",
        answer: "Absolutely! I specialize in creating professional websites for small businesses, startups, and entrepreneurs. My designs focus on converting visitors into customers while staying within your budget."
      },
      {
        question: "What's included in your website design service?",
        answer: "My website design service includes custom design mockups, mobile-responsive development, SEO optimization, contact forms, social media integration, basic training, and 30 days of support after launch."
      },
      {
        question: "Can you redesign my existing website?",
        answer: "Yes, I offer website redesign services to modernize outdated websites. This includes improving design, user experience, mobile responsiveness, loading speed, and search engine optimization."
      }
    ]
  },
  {
    category: "Website Development", 
    questions: [
      {
        question: "What technologies do you use for website development?",
        answer: "I specialize in modern web technologies including React, Next.js, WordPress, HTML5, CSS3, JavaScript, and various databases. I choose the best technology stack based on your project requirements and long-term goals."
      },
      {
        question: "Do you build e-commerce websites?",
        answer: "Yes, I develop full-featured e-commerce websites with shopping cart functionality, payment processing, inventory management, and admin panels. I work with platforms like WooCommerce, Shopify, and custom solutions."
      },
      {
        question: "Can you integrate third-party services into my website?",
        answer: "Absolutely! I can integrate various services including payment gateways, CRM systems, email marketing tools, social media platforms, analytics, and custom APIs to enhance your website's functionality."
      },
      {
        question: "Do you provide website hosting and domain services?",
        answer: "While I don't provide hosting directly, I can recommend reliable hosting providers and help set up your website. I also assist with domain registration and DNS configuration to ensure everything works seamlessly."
      },
      {
        question: "Is my website mobile-friendly and responsive?",
        answer: "Yes, all websites I develop are mobile-first and fully responsive. They automatically adapt to different screen sizes and devices, ensuring optimal user experience on phones, tablets, and desktops."
      }
    ]
  },
  {
    category: "SEO & Performance",
    questions: [
      {
        question: "Will my website be SEO-optimized?",
        answer: "Yes, I implement SEO best practices in every website including optimized meta tags, structured data, fast loading speeds, mobile optimization, clean URLs, and proper heading structure to help your site rank better in search engines."
      },
      {
        question: "How fast will my website load?",
        answer: "I prioritize website performance and aim for loading speeds under 3 seconds. This includes optimizing images, minifying code, using content delivery networks, and implementing caching strategies."
      },
      {
        question: "Do you provide Google Analytics setup?",
        answer: "Yes, I set up Google Analytics, Google Search Console, and other tracking tools to monitor your website's performance, user behavior, and search engine visibility."
      },
      {
        question: "Will my website work on all browsers?",
        answer: "Yes, I ensure cross-browser compatibility across all major browsers including Chrome, Firefox, Safari, and Edge. Your website will function consistently for all visitors."
      }
    ]
  },
  {
    category: "Process & Support",
    questions: [
      {
        question: "What's your website design and development process?",
        answer: "My process includes: 1) Initial consultation and requirements gathering, 2) Design mockups and wireframes, 3) Client review and revisions, 4) Development and coding, 5) Testing and optimization, 6) Launch and handover with training."
      },
      {
        question: "Do you provide ongoing website maintenance?",
        answer: "Yes, I offer ongoing maintenance packages including security updates, content updates, backups, performance monitoring, and technical support to keep your website running smoothly."
      },
      {
        question: "Can I update my website content myself?",
        answer: "Absolutely! I build user-friendly content management systems that allow you to easily update text, images, and pages without technical knowledge. I also provide training on how to manage your website."
      },
      {
        question: "Do you work with clients outside Nigeria?",
        answer: "Yes, I work with clients worldwide. All communication happens via email, video calls, and project management tools. I've successfully delivered projects for clients in the US, UK, Canada, and other countries."
      },
      {
        question: "What if I need changes after my website is launched?",
        answer: "I provide 30 days of free support after launch for minor adjustments. For major changes or ongoing updates, I offer affordable maintenance plans or project-based pricing for additional work."
      }
    ]
  }
];

export const Route = createFileRoute("/faq")({
  head: () => {
    const allQuestions = faqs.flatMap(category => 
      category.questions.map(q => ({
        question: q.question,
        answer: q.answer
      }))
    );

    const seoData = generateSEOMeta({
      title: "FAQ - Website Design & Development Questions Answered",
      description: "Get answers to common questions about professional website design and development services. Learn about costs, timelines, process, and more from experienced web developer Ajibola Gbenga Joseph.",
      keywords: [
        "website design FAQ",
        "web development questions",
        "website design cost",
        "how long website design takes",
        "website development process",
        "website designer Nigeria FAQ",
        "professional website design questions"
      ],
      canonical: `${SITE_URL}/faq`,
      schema: [
        SCHEMA_TEMPLATES.faq(allQuestions),
        SCHEMA_TEMPLATES.breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "FAQ", url: `${SITE_URL}/faq` }
        ])
      ]
    });

    return seoData;
  },
  component: FAQPage,
});

function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main>
        {/* Hero Section */}
        <section className="py-20 px-6">
          <div className="container mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
              <HelpCircle className="h-8 w-8" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Frequently Asked
              <span className="block text-gradient">Questions</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Get answers to common questions about website design and development services. 
              Can't find what you're looking for? Feel free to contact me directly.
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-4xl">
            {faqs.map((category, categoryIndex) => (
              <div key={category.category} className="mb-12">
                <h2 className="text-2xl font-bold mb-8 text-center">
                  {category.category}
                </h2>
                
                <div className="space-y-4">
                  {category.questions.map((item, itemIndex) => {
                    const itemId = `${categoryIndex}-${itemIndex}`;
                    const isOpen = openItems.has(itemId);
                    
                    return (
                      <div 
                        key={itemId} 
                        className="bg-card rounded-2xl border border-border overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(itemId)}
                          className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
                        >
                          <h3 className="font-semibold pr-4">{item.question}</h3>
                          {isOpen ? (
                            <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                        
                        {isOpen && (
                          <div className="px-6 pb-6">
                            <div className="pt-2 border-t border-border">
                              <p className="text-muted-foreground leading-relaxed">
                                {item.answer}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Still Have Questions CTA */}
        <section className="py-20 px-6 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Still Have Questions?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Don't see your question answered here? I'm happy to discuss your specific 
              website design or development needs. Get in touch for a free consultation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="inline-flex items-center justify-center rounded-lg bg-gradient-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                Contact Me Directly
              </button>
              <button className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-8 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                Schedule Free Consultation
              </button>
            </div>
          </div>
        </section>
      </main>
      
      <SiteFooter />
    </div>
  );
}