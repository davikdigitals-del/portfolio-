import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Clock, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { generateSEOMeta, SCHEMA_TEMPLATES } from "@/lib/seo";

const SITE_URL = "https://ajibolagbengajoseph.site";

// Sample blog posts for SEO content
const blogPosts = [
  {
    id: 1,
    title: "10 Website Design Trends That Will Dominate 2026",
    excerpt: "Discover the latest website design trends that professional designers are using to create stunning, conversion-focused websites.",
    author: "Ajibola Gbenga Joseph",
    date: "2026-09-15",
    readTime: "8 min read",
    category: "Website Design",
    tags: ["Design Trends", "UI/UX", "Website Design"],
    slug: "website-design-trends-2026"
  },
  {
    id: 2,
    title: "How to Choose the Right Website Developer for Your Business",
    excerpt: "A comprehensive guide to hiring a professional website developer who can bring your vision to life.",
    author: "Ajibola Gbenga Joseph", 
    date: "2026-09-10",
    readTime: "12 min read",
    category: "Website Development",
    tags: ["Web Development", "Business Tips", "Hiring Guide"],
    slug: "choose-website-developer-business"
  },
  {
    id: 3,
    title: "Website Design vs Website Development: What's the Difference?",
    excerpt: "Understanding the key differences between website design and development to make informed decisions for your project.",
    author: "Ajibola Gbenga Joseph",
    date: "2026-09-05",
    readTime: "6 min read", 
    category: "Education",
    tags: ["Website Design", "Web Development", "Education"],
    slug: "website-design-vs-development"
  },
  {
    id: 4,
    title: "5 Essential Features Every Business Website Must Have",
    excerpt: "Learn about the must-have features that every professional business website needs to convert visitors into customers.",
    author: "Ajibola Gbenga Joseph",
    date: "2026-09-01",
    readTime: "10 min read",
    category: "Business",
    tags: ["Business Website", "Website Features", "Conversion"],
    slug: "essential-business-website-features"
  },
  {
    id: 5,
    title: "The Complete Guide to WordPress Website Development",
    excerpt: "Everything you need to know about WordPress development, from basic setup to advanced customization.",
    author: "Ajibola Gbenga Joseph",
    date: "2026-08-28",
    readTime: "15 min read",
    category: "WordPress",
    tags: ["WordPress", "Web Development", "CMS"],
    slug: "complete-wordpress-development-guide"
  },
  {
    id: 6,
    title: "How Website Design Impacts Your Business Growth",
    excerpt: "Discover how professional website design directly affects your business revenue and customer acquisition.",
    author: "Ajibola Gbenga Joseph",
    date: "2026-08-25",
    readTime: "7 min read",
    category: "Business Growth",
    tags: ["Website Design", "Business Growth", "ROI"],
    slug: "website-design-business-growth"
  }
];

export const Route = createFileRoute("/blog")({
  head: () => {
    const seoData = generateSEOMeta({
      title: "Website Design & Development Blog - Expert Tips & Insights",
      description: "Expert insights on website design, web development, and digital strategy from professional website designer Ajibola Gbenga Joseph. Learn best practices, trends, and tips.",
      keywords: [
        "website design blog",
        "web development blog",
        "website design tips",
        "web development tutorials",
        "digital marketing blog",
        "website design trends",
        "business website tips",
        "professional web design"
      ],
      canonical: `${SITE_URL}/blog`,
      schema: [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${SITE_URL}/blog`,
          name: "Website Design & Development Blog",
          description: "Expert insights on website design, web development, and digital strategy",
          url: `${SITE_URL}/blog`,
          publisher: SCHEMA_TEMPLATES.person,
          inLanguage: "en-US",
          blogPost: blogPosts.map(post => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            author: SCHEMA_TEMPLATES.person,
            datePublished: post.date,
            dateModified: post.date,
            url: `${SITE_URL}/blog/${post.slug}`,
            image: `${SITE_URL}/me.webp`,
            keywords: post.tags.join(", "),
            articleSection: post.category,
            wordCount: 1500 // Estimate
          }))
        },
        SCHEMA_TEMPLATES.breadcrumb([
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` }
        ])
      ]
    });

    return seoData;
  },
  component: BlogPage,
});

function BlogPage() {
  const categories = [...new Set(blogPosts.map(post => post.category))];
  
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main>
        {/* Hero Section */}
        <section className="py-20 px-6">
          <div className="container mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              Website Design &
              <span className="block text-gradient">Development Blog</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Expert insights, tips, and tutorials on website design, web development, and digital strategy. 
              Learn from a professional with 5+ years of experience building successful websites.
            </p>
          </div>
        </section>

        {/* Categories */}
        <section className="py-12 px-6 border-b border-border">
          <div className="container mx-auto">
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" size="sm" className="rounded-full">
                All Posts
              </Button>
              {categories.map(category => (
                <Button key={category} variant="ghost" size="sm" className="rounded-full">
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Post */}
        <section className="py-20 px-6">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-sm text-primary font-medium mb-4">
                  <Tag className="h-4 w-4" />
                  Featured Post
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {blogPosts[0].title}
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {blogPosts[0].excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(blogPosts[0].date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {blogPosts[0].readTime}
                  </div>
                </div>
                <Button asChild className="bg-gradient-primary hover:opacity-90">
                  <Link to={`/blog/${blogPosts[0].slug}`}>
                    Read Full Article <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 aspect-square flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4">📝</div>
                  <div className="text-lg font-semibold">Latest Insights</div>
                  <div className="text-sm text-muted-foreground">Fresh content weekly</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Latest Articles</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.slice(1).map(post => (
                <article key={post.id} className="bg-card rounded-2xl p-6 border border-border hover-lift">
                  <div className="flex items-center gap-2 text-xs text-primary font-medium mb-3">
                    <Tag className="h-3 w-3" />
                    {post.category}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-3 line-clamp-2">
                    <Link 
                      to={`/blog/${post.slug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readTime}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-4">
                    {post.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs bg-muted px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter Signup */}
        <section className="py-20 px-6">
          <div className="container mx-auto text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
              <p className="text-muted-foreground mb-8">
                Get the latest website design and development tips delivered to your inbox. 
                No spam, just valuable insights to help your business grow.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-lg border border-border bg-background"
                />
                <Button className="bg-gradient-primary hover:opacity-90 px-6">
                  Subscribe
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Join 500+ professionals getting weekly insights
              </p>
            </div>
          </div>
        </section>
      </main>
      
      <SiteFooter />
    </div>
  );
}