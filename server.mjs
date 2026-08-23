// Node.js server for serving a TanStack Router SPA
// Serves static files from dist/ and falls back to index.html for client-side routing

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// MIME types for static files
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
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
  // sitemap, robots.txt, manifest.json — short cache so Google picks up updates
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt" || pathname === "/manifest.json") {
    return "public, max-age=3600, must-revalidate";
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

const DIST_DIR = join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = join(DIST_DIR, url.pathname);

  // Try to serve the requested file
  if (existsSync(filePath) && !filePath.endsWith("/")) {
    try {
      const stat = await import('node:fs/promises').then(m => m.stat(filePath));
      if (!stat.isDirectory()) {
        const data = await readFile(filePath);
        const ext = extname(filePath);
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
      }
    } catch {
      // fall through to index.html
    }
  }

  // Check for index.html in directory
  const indexPath = join(DIST_DIR, url.pathname === "/" ? "index.html" : join(url.pathname, "index.html"));
  if (existsSync(indexPath)) {
    try {
      const data = await readFile(indexPath);
      const headers = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      };

      if (acceptsGzip(req) && data.length > 1024) {
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
      // fall through
    }
  }

  // Fallback to root index.html for SPA client-side routing
  try {
    const indexFilePath = join(DIST_DIR, "index.html");
    if (existsSync(indexFilePath)) {
      const data = await readFile(indexFilePath);
      const headers = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      };

      if (acceptsGzip(req) && data.length > 1024) {
        headers["Content-Encoding"] = "gzip";
        headers["Vary"] = "Accept-Encoding";
        res.writeHead(200, headers);
        await pipeline(Readable.from(data), createGzip(), res);
      } else {
        res.writeHead(200, headers);
        res.end(data);
      }
      return;
    }
  } catch {
    // fall through
  }

  // 404 Not Found
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
