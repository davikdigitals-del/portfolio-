import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// This app targets Cloudflare Workers (default preset)
// Deploy via: wrangler pages deploy dist/client
// Or connect GitHub to Cloudflare Pages dashboard
export default defineConfig({
  build: {
    // Enable minification with esbuild (faster and built-in, no extra dependencies)
    minify: 'esbuild',
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['@tanstack/react-router'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for smaller bundles
    target: 'es2020'
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router']
  },
  // Drop console logs and debugger in production
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none'
  }
});
