import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// This app targets Cloudflare Workers (default preset)
// Deploy via: wrangler pages deploy dist/client
// Or connect GitHub to Cloudflare Pages dashboard
export default defineConfig({
  build: {
    // Enable minification with esbuild (faster and built-in, no extra dependencies)
    minify: 'esbuild',
    // Code splitting for better caching and smaller initial bundles
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@tanstack/react-router')) {
              return 'router';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-radix';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'icons';
            }
            // All other node_modules
            return 'vendor';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // CSS code splitting
    cssCodeSplit: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router'],
    exclude: ['@capacitor/core', '@capacitor/splash-screen']
  },
  // Drop console logs and debugger in production
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
    treeShaking: true
  }
});
