import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Use Node.js preset when deploying to Render (non-Cloudflare environments)
const isRender = process.env.RENDER === "true";

export default defineConfig(
  isRender
    ? {
        vite: {
          plugins: [
            tanstackStart({
              target: "node",
            }),
          ],
        },
      }
    : {}
);
