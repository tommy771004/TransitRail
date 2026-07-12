/**
 * Generate the public sitemap files from the same scrape metadata used by the
 * app. Advertised pages: the home page, country landing pages, and the
 * prerendered route pages emitted by scripts/generate-route-pages.ts (all
 * four languages plus their /routes/ hubs). Search-result query strings are
 * intentionally excluded because the SPA does not execute those searches on
 * page load, so they are not durable canonical content pages.
 *
 * Run: npm run sitemap  (after npm run routes so both read the same data)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { COUNTRY_PATHS, collectRoutePages } from "./lib/routePages";

const SITE_URL = (process.env.SITE_URL || "https://rail-national.vercel.app").replace(/\/$/, "");
const SCRAPED_DIR = resolve("src/data/scraped");
const OUTPUT_DIR = resolve("public/sitemaps");

interface ScrapeMetadata {
  lastScraped?: string;
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function dateOnly(value: string | undefined) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function write(path: string, contents: string) {
  writeFileSync(path, `${contents.trim()}\n`, "utf8");
}

function countryLastModified(country: string) {
  try {
    const metadata = JSON.parse(readFileSync(resolve(SCRAPED_DIR, country, "metadata.json"), "utf8")) as ScrapeMetadata;
    return dateOnly(metadata.lastScraped);
  } catch {
    return dateOnly(undefined);
  }
}

function urlEntry(url: string, lastmod: string) {
  return `  <url>\n    <loc>${xml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const countries = readdirSync(SCRAPED_DIR).filter((country) => country in COUNTRY_PATHS).sort();
  const countryEntries = countries.map((country) => ({
    url: `${SITE_URL}${COUNTRY_PATHS[country]}`,
    lastmod: countryLastModified(country),
  }));
  const latest = countryEntries.map(({ lastmod }) => lastmod).sort().at(-1) ?? dateOnly(undefined);

  const routePages = collectRoutePages(SCRAPED_DIR);
  const routeEntries = routePages.flatMap((page) => {
    const lastmod = dateOnly(page.scrapedAt || undefined);
    return [
      { url: `${SITE_URL}${page.urlPath}`, lastmod },
      { url: `${SITE_URL}${page.zhUrlPath}`, lastmod },
      { url: `${SITE_URL}${page.jaUrlPath}`, lastmod },
      { url: `${SITE_URL}${page.koUrlPath}`, lastmod },
    ];
  });
  const routeLatest = routeEntries.map(({ lastmod }) => lastmod).sort().at(-1) ?? latest;
  routeEntries.unshift(
    { url: `${SITE_URL}/routes/`, lastmod: routeLatest },
    { url: `${SITE_URL}/zh/routes/`, lastmod: routeLatest },
    { url: `${SITE_URL}/ja/routes/`, lastmod: routeLatest },
    { url: `${SITE_URL}/ko/routes/`, lastmod: routeLatest },
  );

  const core = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(`${SITE_URL}/`, latest)}
</urlset>`;
  const countrySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${countryEntries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>`;
  const routeSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routeEntries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>`;
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>\n    <loc>${SITE_URL}/sitemaps/core.xml</loc>\n    <lastmod>${latest}</lastmod>\n  </sitemap>
  <sitemap>\n    <loc>${SITE_URL}/sitemaps/countries.xml</loc>\n    <lastmod>${latest}</lastmod>\n  </sitemap>
  <sitemap>\n    <loc>${SITE_URL}/sitemaps/routes.xml</loc>\n    <lastmod>${routeLatest}</lastmod>\n  </sitemap>
</sitemapindex>`;

  write(resolve(OUTPUT_DIR, "core.xml"), core);
  write(resolve(OUTPUT_DIR, "countries.xml"), countrySitemap);
  write(resolve(OUTPUT_DIR, "routes.xml"), routeSitemap);
  // sitemap.xml is the single canonical entry point; the historical
  // sitemap-index.xml / sitemap_index.xml aliases 301 to it via vercel.json.
  write(resolve("public/sitemap.xml"), index);
  console.log(`Generated sitemap index: ${countryEntries.length} country pages, ${routeEntries.length} route page URLs.`);
}

main();
