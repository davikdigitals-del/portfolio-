import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindvite from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      experimental: {
        enableCodeSplitting: true,
      },
    }),
    tailwindvite(),
    tsconfigPaths(),
    react({
      babel: {
        babelrc: false,
        configFile: false,
      },
    }),
  ],
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
