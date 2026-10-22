/**
 * Optional sitemap endpoint at /api/sitemap.
 * Canonical public URL is still /sitemap.xml (static file from build).
 *
 * Serves that same file. This endpoint used to rebuild the sitemap from every
 * scraped route, which bundled the whole timetable corpus (~226 MB) into a
 * second function on every deploy, and answered with a hand-kept copy of the
 * builder that had already lost the de/fr locales and hreflang alternates.
 * `npm run build` writes public/sitemap.xml before the functions are bundled,
 * and vercel.json includes just that file here.
 *
 * Fully self-contained — no imports from scripts/ (Vercel @vercel/node
 * fails to resolve that graph → FUNCTION_INVOCATION_FAILED / HTTP 500).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname (Vercel runs this as native ESM → bare __dirname throws).
const moduleDir = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

function resolveSitemapPath(): string {
  const candidates = [
    resolve(process.cwd(), "public/sitemap.xml"),
    join(moduleDir, "..", "public", "sitemap.xml"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0];
}

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const body = readFileSync(resolveSitemapPath(), "utf8");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.end(body);
  } catch (error) {
    console.error("[api/sitemap]", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      `Sitemap unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
