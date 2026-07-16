/**
 * Generate public sitemap partials under public/sitemaps/ for backup/static use.
 * The **canonical** GSC entry is /sitemap.xml → api/sitemap.ts (dynamic).
 *
 * Run: npm run sitemap  (after npm run routes so both read the same data)
 */
import { mkdirSync, unlinkSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  buildFlatSitemapXml,
  buildPartialUrlset,
  collectSitemapEntries,
  SITE_URL,
} from "../src/server/sitemapXml";

const OUTPUT_DIR = resolve("public/sitemaps");

function write(path: string, contents: string) {
  writeFileSync(path, `${contents.trim()}\n`, "utf8");
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const { allEntries, countryEntries, routeEntries, latest } = collectSitemapEntries();

  write(resolve(OUTPUT_DIR, "core.xml"), buildPartialUrlset([{ url: `${SITE_URL}/`, lastmod: latest }]));
  write(resolve(OUTPUT_DIR, "countries.xml"), buildPartialUrlset(countryEntries));
  write(resolve(OUTPUT_DIR, "routes.xml"), buildPartialUrlset(routeEntries));

  // Do NOT leave public/sitemap.xml as a static file: on Vercel, static files
  // beat rewrites, and GSC was still failing against static delivery for some
  // crawls. The canonical path is rewritten to /api/sitemap.
  for (const name of ["sitemap.xml", "Sitemap.xml"]) {
    const path = resolve("public", name);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  }

  // Keep a build artifact for local inspection / smoke tests (not in public/).
  mkdirSync(resolve("dist"), { recursive: true });
  write(resolve("dist/sitemap.generated.xml"), buildFlatSitemapXml());

  console.log(
    `Generated sitemap partials + dist/sitemap.generated.xml: ${allEntries.length} URLs. ` +
      `Canonical serve path: /sitemap.xml → /api/sitemap`,
  );
}

main();
