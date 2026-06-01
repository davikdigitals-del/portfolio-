import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// This app targets Cloudflare Workers (default preset)
// Deploy via: wrangler pages deploy dist/client
// Or connect GitHub to Cloudflare Pages dashboard
export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 500,
  },
  // NOTE: do NOT drop console — it hides critical runtime errors
  // esbuild: { drop: ['console', 'debugger'] },
  define: {
    // Explicitly embed VITE_ env vars into both client and SSR bundles at build time.
    // Render sets these as build environment variables from render.yaml.
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(process.env.VITE_SUPABASE_PROJECT_ID ?? ''),
    'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY ?? ''),
  },
});
