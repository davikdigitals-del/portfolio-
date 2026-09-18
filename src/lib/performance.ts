/**
 * Performance optimization utilities for better Core Web Vitals and SEO
 */

// Image optimization and lazy loading
export const optimizeImages = () => {
  if (typeof window === 'undefined') return;

  // Native lazy loading for modern browsers
  const images = document.querySelectorAll('img[data-src]');
  
  if ('loading' in HTMLImageElement.prototype) {
    images.forEach((img: HTMLImageElement) => {
      img.src = img.dataset.src!;
      img.removeAttribute('data-src');
    });
  } else {
    // Intersection Observer fallback for older browsers
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }
};

// Preload critical resources
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return;

  // Preload critical fonts
  const fontLinks = [
    '/fonts/inter-var.woff2',
    '/fonts/inter-bold.woff2'
  ];

  fontLinks.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = font;
    document.head.appendChild(link);
  });

  // Preload critical images
  const criticalImages = [
    '/me.webp',
    '/portfolio1.png'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
};

// Critical CSS inlining
export const inlineCriticalCSS = () => {
  if (typeof window === 'undefined') return;

  const criticalCSS = `
    /* Critical above-the-fold styles */
    body { font-family: 'Inter', sans-serif; }
    .hero-section { min-height: 100vh; display: flex; align-items: center; }
    .text-gradient { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .animate-fade-in { animation: fadeIn 0.6s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `;

  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
};

// Resource hints for better loading
export const addResourceHints = () => {
  if (typeof window === 'undefined') return;

  const hints = [
    { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
    { rel: 'dns-prefetch', href: 'https://www.google-analytics.com' },
    { rel: 'dns-prefetch', href: 'https://gcckwqkzjoxraikosash.supabase.co' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' }
  ];

  hints.forEach(hint => {
    const existing = document.querySelector(`link[rel="${hint.rel}"][href="${hint.href}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = hint.rel;
      link.href = hint.href;
      if (hint.crossorigin) link.crossOrigin = hint.crossorigin;
      document.head.appendChild(link);
    }
  });
};

// Code splitting and dynamic imports
export const loadModuleWhenNeeded = async (modulePath: string) => {
  try {
    const module = await import(modulePath);
    return module;
  } catch (error) {
    console.error(`Failed to load module: ${modulePath}`, error);
    return null;
  }
};

// Service Worker for caching
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registration successful:', registration);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        console.log('[SW] New service worker available');
        // You can show a notification to users about the update
      });
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  }
};

// Intersection Observer for animations
export const observeElementsForAnimation = () => {
  if (typeof window === 'undefined') return;

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements with animation classes
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  animatedElements.forEach(el => observer.observe(el));
};

// Bundle analyzer helper for development
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV === 'development') {
    // Log bundle information
    console.group('Bundle Analysis');
    console.log('Main bundle loaded');
    console.log('Consider code splitting for:', {
      analytics: 'Load after user interaction',
      chatWidget: 'Load when chat is opened',
      animations: 'Load for interactive elements'
    });
    console.groupEnd();
  }
};

// Initialize all performance optimizations
export const initPerformanceOptimizations = () => {
  // Run immediately
  addResourceHints();
  inlineCriticalCSS();
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      optimizeImages();
      observeElementsForAnimation();
    });
  } else {
    optimizeImages();
    observeElementsForAnimation();
  }
  
  // Run when window is loaded
  window.addEventListener('load', () => {
    preloadCriticalResources();
    registerServiceWorker();
    analyzeBundleSize();
  });
};

// Web Vitals measurement
export const measureWebVitals = () => {
  if (typeof window === 'undefined') return;

  // Measure and report web vitals
  const reportWebVital = (name: string, value: number) => {
    console.log(`[Web Vital] ${name}: ${value}`);
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        event_label: 'Performance',
        value: Math.round(value)
      });
    }
  };

  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    reportWebVital('LCP', lastEntry.startTime);
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry: any) => {
      reportWebVital('FID', entry.processingStart - entry.startTime);
    });
  }).observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift
  let clsValue = 0;
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });

    // Report when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportWebVital('CLS', clsValue);
      }
    }, { once: true });
  }).observe({ entryTypes: ['layout-shift'] });
};

// Critical rendering path optimization
export const optimizeCriticalRenderingPath = () => {
  // Remove render-blocking resources
  const nonCriticalCSS = document.querySelectorAll('link[rel="stylesheet"]:not([data-critical])');
  nonCriticalCSS.forEach((link: HTMLLinkElement) => {
    link.media = 'print';
    link.onload = () => { link.media = 'all'; };
  });

  // Defer non-critical JavaScript
  const nonCriticalScripts = document.querySelectorAll('script[data-defer]');
  nonCriticalScripts.forEach((script: HTMLScriptElement) => {
    const newScript = document.createElement('script');
    newScript.src = script.src;
    newScript.defer = true;
    script.parentNode?.replaceChild(newScript, script);
  });
};