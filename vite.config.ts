import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Always disable Cloudflare plugin — we deploy to Render (Node.js)
// The wrangler.jsonc is kept for reference but not used in build
export default defineConfig({ cloudflare: false });
