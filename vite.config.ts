import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Disable Cloudflare plugin when building for Render (Node.js environment)
// The RENDER env var is automatically set by Render's build environment
const isRender = !!process.env.RENDER;

export default defineConfig(
  isRender
    ? { cloudflare: false }
    : {}
);
