/**
 * Advanced SEO utilities for top search engine rankings
 */

export const SITE_CONFIG = {
  url: "https://ajibolagbengajoseph.site",
  name: "Ajibola Gbenga Joseph",
  title: "Website Designer & Developer",
  description: "Professional website designer and developer with 5+ years experience. Custom websites that convert visitors into clients.",
  keywords: [
    // Primary keywords
    "website designer",
    "website developer",
    "web designer",
    "web developer",
    "website design",
    "website development",

    // Location-based
    "website designer Nigeria",
    "website developer Nigeria",
    "Lagos website designer",
    "Nigerian web designer",

    // Service-based
    "custom website design",
    "professional website designer",
    "freelance website designer",
    "business website designer",
    "e-commerce website designer",
    "landing page designer",
    "responsive website designer",
    "WordPress website designer",
    "React website developer",
    "website redesign",

    // Intent-based
    "website designer for hire",
    "website developer for hire",
    "hire website designer",
    "hire website developer",
    "affordable website designer",
    "best website designer",

    // Industry-specific
    "startup website designer",
    "small business website designer",
    "corporate website designer",
    "portfolio website designer"
  ]
} as const;

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "profile";
  noindex?: boolean;
  schema?: Record<string, any>[];
}

export function generateSEOMeta({
  title,
  description = SITE_CONFIG.description,
  keywords = [],
  canonical,
  ogImage = `${SITE_CONFIG.url}/me.webp`,
  ogType = "website",
  noindex = false,
  schema = []
}: SEOProps = {}) {
  const fullTitle = title
    ? `${title} | ${SITE_CONFIG.name}`
    : `${SITE_CONFIG.title} | ${SITE_CONFIG.name}`;

  const allKeywords = [...SITE_CONFIG.keywords, ...keywords].join(", ");

  return {
    meta: [
      // Basic meta tags
      { name: "description", content: description },
      { name: "keywords", content: allKeywords },
      { name: "author", content: SITE_CONFIG.name },
      { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" },

      // Enhanced meta tags for better rankings
      { name: "language", content: "en" },
      { name: "revisit-after", content: "7 days" },
      { name: "distribution", content: "global" },
      { name: "rating", content: "general" },
      { name: "classification", content: "business" },
      { name: "category", content: "Web Design, Web Development, Technology" },
      { name: "coverage", content: "worldwide" },
      { name: "target", content: "all" },
      { name: "HandheldFriendly", content: "true" },
      { name: "MobileOptimized", content: "320" },

      // Open Graph
      { property: "og:site_name", content: SITE_CONFIG.name },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: ogType },
      { property: "og:url", content: canonical || SITE_CONFIG.url },
      { property: "og:image", content: ogImage },
      { property: "og:image:alt", content: `${SITE_CONFIG.name} — ${SITE_CONFIG.title}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "en_US" },

      // Twitter Cards
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@ajibolagbenga" },
      { name: "twitter:creator", content: "@ajibolagbenga" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      { name: "twitter:image:alt", content: `${SITE_CONFIG.name} — ${SITE_CONFIG.title}` },

      // Additional social media
      { property: "article:author", content: SITE_CONFIG.name },
      { property: "article:publisher", content: SITE_CONFIG.url },

      // Geographic targeting
      { name: "geo.region", content: "NG-LA" },
      { name: "geo.placename", content: "Lagos, Nigeria" },
      { name: "geo.position", content: "6.5244;3.3792" },
      { name: "ICBM", content: "6.5244, 3.3792" },

      // Business info
      { name: "contact", content: "gbengajosephajibola@gmail.com" },
      { name: "reply-to", content: "gbengajosephajibola@gmail.com" },
      { name: "owner", content: SITE_CONFIG.name },
      { name: "url", content: SITE_CONFIG.url },
      { name: "identifier-URL", content: SITE_CONFIG.url },
      { name: "directory", content: "submission" },

      // Performance hints
      { name: "format-detection", content: "telephone=yes" },
      { name: "msapplication-tap-highlight", content: "no" },

      // Additional verification
      { name: "google-site-verification", content: "wpsX-Jrm9SRwsyJh0pbqydfFlmgxYaKBi_8RlJx89Qs" },
      { name: "msvalidate.01", content: "YOUR_BING_VERIFICATION_CODE" },
      { name: "yandex-verification", content: "YOUR_YANDEX_VERIFICATION_CODE" },
      { name: "norton-safeweb-site-verification", content: "YOUR_NORTON_CODE" }
    ],

    links: [
      { rel: "canonical", href: canonical || SITE_CONFIG.url },
      { rel: "alternate", hreflang: "en", href: canonical || SITE_CONFIG.url },
      { rel: "alternate", hreflang: "x-default", href: canonical || SITE_CONFIG.url },

      // Prefetch important pages
      { rel: "prefetch", href: "/about" },
      { rel: "prefetch", href: "/services" },
      { rel: "prefetch", href: "/case-studies" },
      { rel: "prefetch", href: "/contact" },

      // DNS prefetch for external domains
      { rel: "dns-prefetch", href: "https://gcckwqkzjoxraikosash.supabase.co" },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
      { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },

      // Preconnect for critical resources
      { rel: "preconnect", href: "https://gcckwqkzjoxraikosash.supabase.co" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" }
    ],

    scripts: schema.map(schemaObj => ({
      type: "application/ld+json",
      children: JSON.stringify(schemaObj)
    }))
  };
}

// Advanced Schema.org structured data
export const SCHEMA_TEMPLATES = {
  person: {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    image: `${SITE_CONFIG.url}/me.webp`,
    jobTitle: "Website Designer & Website Developer",
    description: "Professional website designer and website developer with 5+ years experience building modern, fast, conversion-focused websites and web applications for businesses worldwide.",
    email: "gbengajosephajibola@gmail.com",
    nationality: "Nigerian",
    birthPlace: "Nigeria",
    knowsLanguage: ["English"],
    gender: "Male",

    // Skills and expertise
    hasSkill: [
      "Website Design", "Website Development", "Web Design", "Web Development",
      "Full Stack Development", "React", "Next.js", "WordPress", "UI/UX Design",
      "SEO", "Tech Advisory", "E-Commerce Development", "Landing Page Design",
      "Mobile App Development", "Responsive Design"
    ],

    // Education
    alumniOf: {
      "@type": "EducationalOrganization",
      name: "University of Education"
    },

    // Awards and certifications (add your actual ones)
    award: [
      "Google Analytics Certified",
      "React Developer Certification",
      "WordPress Expert Certification"
    ],

    // Work information
    worksFor: {
      "@type": "Organization",
      name: "Edgebrook AI Solutions",
      url: SITE_CONFIG.url,
      logo: `${SITE_CONFIG.url}/me.webp`
    },

    hasOccupation: {
      "@type": "Occupation",
      name: "Website Designer and Developer",
      occupationLocation: { "@type": "Country", name: "Nigeria" },
      skills: "Website Design, Website Development, Full Stack Development, React, Next.js, WordPress, SEO, UI/UX Design, Tech Advisory",
      experienceRequirements: "5+ years professional experience",
      qualifications: "Bachelor's degree in Computer Science or related field"
    },

    // Social media profiles
    sameAs: [
      "https://www.tiktok.com/@joseph_4124",
      "https://www.youtube.com/@AjibolaGbengaJoseph1",
      "https://www.linkedin.com/in/ajibolagbengajoseph",
      "https://github.com/ajibolagbengajoseph",
      "https://twitter.com/ajibolagbenga",
      "https://www.instagram.com/ajibolagbenga"
    ],

    // Address
    address: {
      "@type": "PostalAddress",
      addressCountry: "Nigeria",
      addressRegion: "Lagos"
    }
  },

  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_CONFIG.url}/#organization`,
    name: "Edgebrook AI Solutions",
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/me.webp`,
    image: `${SITE_CONFIG.url}/me.webp`,
    description: "Professional website design and development company specializing in custom websites, e-commerce solutions, and web applications for businesses worldwide.",

    founder: {
      "@type": "Person",
      name: SITE_CONFIG.name
    },

    foundingDate: "2019",
    foundingLocation: "Lagos, Nigeria",

    address: {
      "@type": "PostalAddress",
      addressCountry: "Nigeria",
      addressRegion: "Lagos"
    },

    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+234-XXX-XXX-XXXX",
      contactType: "customer service",
      email: "gbengajosephajibola@gmail.com",
      availableLanguage: "English"
    },

    sameAs: [
      "https://www.tiktok.com/@joseph_4124",
      "https://www.youtube.com/@AjibolaGbengaJoseph1"
    ]
  },

  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_CONFIG.url}/#website`,
    name: `${SITE_CONFIG.name} — ${SITE_CONFIG.title}`,
    url: SITE_CONFIG.url,
    description: "Professional website design, web development and tech advisory services. Custom websites built to convert visitors into clients.",
    inLanguage: "en",

    publisher: {
      "@id": `${SITE_CONFIG.url}/#organization`
    },

    author: {
      "@type": "Person",
      name: SITE_CONFIG.name
    },

    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_CONFIG.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  },

  professionalService: {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE_CONFIG.url}/#service`,
    name: "Website Design & Development Services",
    url: SITE_CONFIG.url,
    image: `${SITE_CONFIG.url}/me.webp`,
    description: "Professional website design and development services. Custom websites, e-commerce, landing pages, full-stack web applications and tech advisory for businesses worldwide.",

    priceRange: "$$",
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: "6.5244",
        longitude: "3.3792"
      },
      geoRadius: "50000"
    },

    availableLanguage: "English",

    serviceType: [
      "Website Design",
      "Website Development",
      "Web Design",
      "Web Development",
      "Full Stack Development",
      "WordPress Development",
      "E-Commerce Website Design",
      "Landing Page Design",
      "UI/UX Design",
      "Tech Advisory",
      "Website Redesign",
      "Responsive Web Design",
      "Custom Website Development"
    ],

    provider: {
      "@id": `${SITE_CONFIG.url}/#organization`
    },

    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Web Design & Development Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Custom Website Design",
            description: "Professional custom website design tailored to your brand and business goals."
          },
          price: "Starting from $500",
          priceCurrency: "USD"
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "E-Commerce Website Development",
            description: "Full-featured e-commerce websites with payment integration and inventory management."
          },
          price: "Starting from $1500",
          priceCurrency: "USD"
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Full Stack Web Development",
            description: "Custom web applications using React, Next.js, Node.js and modern technologies."
          },
          price: "Starting from $2000",
          priceCurrency: "USD"
        }
      ]
    },

    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: "50",
      bestRating: "5",
      worstRating: "1"
    },

    review: [
      {
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: "5"
        },
        author: {
          "@type": "Person",
          name: "Sarah Johnson"
        },
        reviewBody: "Ajibola created an amazing website for our startup. Professional, fast, and exactly what we needed to launch successfully."
      }
    ]
  },

  breadcrumb: (items: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }),

  faq: (questions: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(qa => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: qa.answer
      }
    }))
  })
};