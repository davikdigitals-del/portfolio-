/**
 * Google Analytics 4 and Search Console integration for SEO tracking
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Replace with your actual Google Analytics measurement ID
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

export const initGoogleAnalytics = () => {
  if (typeof window === 'undefined') return;
  
  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Load Google Analytics script
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);
  
  // Initialize gtag
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer.push(args);
  };
  
  // Configure Google Analytics
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_location: window.location.href,
    // Enhanced ecommerce and user engagement
    send_page_view: true,
    // Cookie settings for GDPR compliance
    anonymize_ip: true,
    cookie_expires: 63072000, // 2 years
    // Custom dimensions for SEO tracking
    custom_map: {
      custom_dimension_1: 'user_type',
      custom_dimension_2: 'page_category'
    }
  });
  
  // Track core web vitals for SEO
  trackWebVitals();
};

// Track page views for SPA navigation
export const trackPageView = (url: string, title: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: title,
      page_location: url,
      custom_map: {
        page_category: getPageCategory(url)
      }
    });
  }
};

// Track custom events for SEO insights
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      // Custom parameters for better SEO tracking
      engagement_time_msec: Date.now(),
      page_title: document.title,
      page_location: window.location.href
    });
  }
};

// Track form submissions (important for conversion tracking)
export const trackFormSubmission = (formName: string, formLocation: string) => {
  trackEvent('form_submit', 'engagement', `${formName}_${formLocation}`);
  
  // Track as conversion
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: GA_MEASUREMENT_ID,
      event_category: 'lead_generation',
      event_label: formName,
      value: 1
    });
  }
};

// Track scroll depth for engagement metrics
export const trackScrollDepth = () => {
  if (typeof window === 'undefined') return;
  
  let maxScroll = 0;
  const milestones = [25, 50, 75, 90, 100];
  const tracked = new Set<number>();
  
  const handleScroll = () => {
    const scrollPercent = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    
    maxScroll = Math.max(maxScroll, scrollPercent);
    
    milestones.forEach(milestone => {
      if (maxScroll >= milestone && !tracked.has(milestone)) {
        tracked.add(milestone);
        trackEvent('scroll_depth', 'engagement', `${milestone}%`, milestone);
      }
    });
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  return () => window.removeEventListener('scroll', handleScroll);
};

// Track core web vitals for SEO performance
const trackWebVitals = () => {
  if (typeof window === 'undefined') return;
  
  // Track Largest Contentful Paint (LCP)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    
    trackEvent('web_vitals', 'performance', 'LCP', Math.round(lastEntry.startTime));
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // Track First Input Delay (FID)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      trackEvent('web_vitals', 'performance', 'FID', Math.round(entry.processingStart - entry.startTime));
    });
  }).observe({ entryTypes: ['first-input'] });
  
  // Track Cumulative Layout Shift (CLS)
  let clsScore = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsScore += entry.value;
      }
    });
    
    // Track CLS when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        trackEvent('web_vitals', 'performance', 'CLS', Math.round(clsScore * 1000));
      }
    }, { once: true });
  }).observe({ entryTypes: ['layout-shift'] });
};

// Get page category for analytics segmentation
const getPageCategory = (url: string): string => {
  if (url.includes('/about')) return 'about';
  if (url.includes('/services') || url.includes('/website-design') || url.includes('/website-development')) return 'services';
  if (url.includes('/case-studies') || url.includes('/portfolio')) return 'portfolio';
  if (url.includes('/contact')) return 'contact';
  if (url.includes('/blog')) return 'blog';
  return 'home';
};

// Track external link clicks for SEO insights
export const trackExternalLinks = () => {
  if (typeof window === 'undefined') return;
  
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');
    
    if (link && link.hostname !== window.location.hostname) {
      trackEvent('click', 'external_link', link.href);
    }
  });
};

// Track file downloads
export const trackDownloads = () => {
  if (typeof window === 'undefined') return;
  
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');
    
    if (link && link.href) {
      const downloadExtensions = ['.pdf', '.doc', '.docx', '.zip', '.mp4', '.mp3', '.jpg', '.png'];
      const hasDownloadExtension = downloadExtensions.some(ext => 
        link.href.toLowerCase().includes(ext)
      );
      
      if (hasDownloadExtension || link.hasAttribute('download')) {
        const fileName = link.href.split('/').pop() || 'unknown';
        trackEvent('download', 'engagement', fileName);
      }
    }
  });
};

// Initialize all tracking
export const initAnalytics = () => {
  initGoogleAnalytics();
  trackScrollDepth();
  trackExternalLinks();
  trackDownloads();
};

// SEO-specific event tracking
export const seoEvents = {
  // Track when users view contact information
  contactInfoView: () => trackEvent('contact_info_view', 'seo', 'contact_visibility'),
  
  // Track service page engagement
  servicePageView: (service: string) => trackEvent('service_view', 'seo', service),
  
  // Track portfolio item views
  portfolioView: (project: string) => trackEvent('portfolio_view', 'seo', project),
  
  // Track search intent (if you add search functionality)
  siteSearch: (query: string) => trackEvent('site_search', 'seo', query),
  
  // Track call-to-action clicks
  ctaClick: (location: string, action: string) => trackEvent('cta_click', 'conversion', `${location}_${action}`),
  
  // Track social media clicks
  socialClick: (platform: string) => trackEvent('social_click', 'engagement', platform)
};