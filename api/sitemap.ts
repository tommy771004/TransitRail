/**
 * Canonical sitemap endpoint for Google Search Console.
 *
 * Served at /sitemap.xml and /Sitemap.xml via vercel.json rewrites so the
 * response never falls through the SPA shell. Builds a flat urlset from
 * scraped route files at request time.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { buildFlatSitemapXml } from "../src/server/sitemapXml";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const body = buildFlatSitemapXml();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Avoid filename= which some crawlers mis-handle on XML bodies.
    res.setHeader("Content-Disposition", "inline");
    res.end(body);
  } catch (error) {
    console.error("[api/sitemap] Failed to build sitemap:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Sitemap generation failed");
  }
}
