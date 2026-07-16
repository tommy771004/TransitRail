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
    // Trailing slash matches static country hub pages (public/<country>/index.html).
    url: `${SITE_URL}${COUNTRY_PATHS[country]}/`,
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

  const allEntries = [
    { url: `${SITE_URL}/`, lastmod: latest },
    ...countryEntries,
    ...routeEntries,
  ];

  // Single flat urlset for /sitemap.xml — ~hundreds of URLs, under Google's
  // 50k limit. Prefer this over a sitemapindex: GSC sometimes reports
  // "無法讀取 Sitemap" / 0 discovered URLs against nested indexes even when
  // curl succeeds, and a flat file is simpler for crawlers to process.
  const flat = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>`;

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

  write(resolve(OUTPUT_DIR, "core.xml"), core);
  write(resolve(OUTPUT_DIR, "countries.xml"), countrySitemap);
  write(resolve(OUTPUT_DIR, "routes.xml"), routeSitemap);

  // Canonical entry for robots.txt + GSC (flat urlset).
  write(resolve("public/sitemap.xml"), flat);
  // Case-sensitive hosts (Vercel Linux): identical capital-S path for GSC typos.
  if (process.platform === "linux") {
    write(resolve("public/Sitemap.xml"), flat);
  }
  console.log(
    `Generated flat sitemap.xml: ${allEntries.length} URLs ` +
      `(1 home + ${countryEntries.length} countries + ${routeEntries.length} route pages).`,
  );
}

main();
