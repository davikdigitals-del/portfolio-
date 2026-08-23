# Render Deployment Fix

## Problem
Your deployment on Render was failing with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/dist/server/index.js'
```

This happened because the vite config was using `@lovable.dev/vite-tanstack-config` which doesn't generate a Node.js server build, but your `server.mjs` was trying to import a non-existent server entry point.

## Solution

### 1. Updated `vite.config.ts`
Changed from the Lovable preset to a standard Vite config that properly compiles your TanStack Router SPA:
- Removed dependency on `@lovable.dev/vite-tanstack-config`
- Added direct Vite plugins: `TanStackRouterVite`, `tailwindvite`, `react`, `tsconfigPaths`
- This generates a proper client-side build in the `dist/` folder

### 2. Updated `server.mjs`
Simplified the server to work as a static file server for SPA (Single Page Application):
- Removed the invalid import of `./dist/server/index.js`
- Added proper static file serving with cache control
- Implemented fallback to `index.html` for client-side routing
- Added gzip compression support
- Serves from `dist/` instead of `dist/client` and `dist/server`

## Key Changes

**vite.config.ts:**
```typescript
// Before: Used lovable preset
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// After: Use standard Vite with proper plugins
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindvite from '@tailwindcss/vite'
```

**server.mjs:**
```javascript
// Before: Tried to import SSR server bundle that doesn't exist
const { default: app } = await import("./dist/server/index.js");

// After: Serve static files and fallback to index.html
const server = createServer(async (req, res) => {
  // Serve static files from dist/
  // Fallback to index.html for SPA routing
});
```

## Next Steps

1. Push these changes to your repository
2. Render will automatically rebuild and deploy
3. The build should now:
   - Successfully run `npm install && npm run build`
   - Generate the `dist/` folder with all static assets
   - Start successfully with `node server.mjs`

## Testing Locally

You can test the build locally:
```bash
npm run build
npm start
```

Then visit `http://localhost:3000` to verify the app works.

## Deployment Config

Your `render.yaml` remains unchanged:
- Build command: `npm install && npm run build`
- Start command: `node server.mjs`
- Environment variables: All properly set with Supabase and other keys
