// Node.js server wrapper for TanStack Start Cloudflare Workers build
// This adapts the Web API fetch handler to run on Node.js for Render deployment

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Import the TanStack Start fetch handler
const { default: app } = await import("./dist/server/index.js");
// The app might be the fetch handler itself, or an object with a fetch method
const fetchHandler = typeof app === 'function' ? app : (app.fetch || app.default?.fetch);

// MIME types for static files
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

// Cache durations
const getCacheControl = (pathname) => {
  if (pathname.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.(jpg|jpeg|png|webp|svg|ico|woff|woff2|ttf)$/.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.(css|js|mjs)$/.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  if (pathname === "/" || pathname.endsWith(".html")) {
    return "public, max-age=0, must-revalidate";
  }
  return "public, max-age=3600, must-revalidate";
};

// Check if client accepts gzip
const acceptsGzip = (req) => {
  const encoding = req.headers['accept-encoding'];
  return encoding && encoding.includes('gzip');
};

// Should compress this file type?
const shouldCompress = (pathname) => {
  return /\.(html|css|js|mjs|json|svg|xml|txt)$/.test(pathname);
};

const CLIENT_DIR = join(__dirname, "dist/client");
const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Try to serve static files from dist/client first
  const staticPath = join(CLIENT_DIR, url.pathname);
  if (existsSync(staticPath) && !staticPath.endsWith("/")) {
    try {
      const data = await readFile(staticPath);
      const ext = extname(staticPath);
      const headers = {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": getCacheControl(url.pathname),
      };

      // Compress if supported and beneficial
      if (acceptsGzip(req) && shouldCompress(url.pathname) && data.length > 1024) {
        headers["Content-Encoding"] = "gzip";
        headers["Vary"] = "Accept-Encoding";
        res.writeHead(200, headers);
        await pipeline(Readable.from(data), createGzip(), res);
      } else {
        res.writeHead(200, headers);
        res.end(data);
      }
      return;
    } catch {
      // fall through to SSR
    }
  }

  // Build a Web API Request from the Node.js request
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // Read body for POST/PUT/PATCH
  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
  });

  try {
    const response = await fetchHandler(request);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("SSR error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
