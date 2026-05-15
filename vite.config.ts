import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { compression } from 'vite-plugin-compression';

// This app targets Cloudflare Workers (default preset)
// Deploy via: wrangler pages deploy dist/client
// Or connect GitHub to Cloudflare Pages dashboard
export default defineConfig({
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    // Code splitting
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
    chunkSizeWarningLimit: 1000
  },
  // Image optimization
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});
