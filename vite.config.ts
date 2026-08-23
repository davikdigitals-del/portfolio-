import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// This app uses TanStack Start for full-stack development
export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 500,
  },
  define: {
    // Explicitly embed VITE_ env vars into both client and SSR bundles at build time.
    // Render sets these as build environment variables from render.yaml.
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(process.env.VITE_SUPABASE_PROJECT_ID ?? ''),
    'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY ?? ''),
  },
});
