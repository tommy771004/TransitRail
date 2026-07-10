/**
 * Generate the public sitemap files from the same scrape metadata used by the
 * app. Only stable, useful GET pages are advertised: the home page and country
 * landing pages. Search-result query strings are intentionally excluded because
 * the SPA does not execute those searches on page load, so they are not durable
 * canonical content pages.
 *
 * Run: npm run sitemap
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const SITE_URL = (process.env.SITE_URL || "https://rail-national.vercel.app").replace(/\/$/, "");
const SCRAPED_DIR = resolve("src/data/scraped");
const OUTPUT_DIR = resolve("public/sitemaps");

const COUNTRY_PATHS: Record<string, string> = {
  japan: "/japan",
  korea: "/korea",
  china: "/china",
  singapore: "/singapore",
  thailand: "/thailand",
  hong_kong: "/hong-kong",
  united_kingdom: "/united-kingdom",
  united_states: "/united-states",
  germany: "/germany",
  france: "/france",
  switzerland: "/switzerland",
};

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

  const core = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(`${SITE_URL}/`, latest)}
</urlset>`;
  const countrySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${countryEntries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>`;
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>\n    <loc>${SITE_URL}/sitemaps/core.xml</loc>\n    <lastmod>${latest}</lastmod>\n  </sitemap>
  <sitemap>\n    <loc>${SITE_URL}/sitemaps/countries.xml</loc>\n    <lastmod>${latest}</lastmod>\n  </sitemap>
</sitemapindex>`;

  write(resolve(OUTPUT_DIR, "core.xml"), core);
  write(resolve(OUTPUT_DIR, "countries.xml"), countrySitemap);
  // Keep historical aliases valid, but establish sitemap.xml as the single
  // canonical submitted entry point.
  write(resolve("public/sitemap.xml"), index);
  write(resolve("public/sitemap-index.xml"), index);
  write(resolve("public/sitemap_index.xml"), index);
  console.log(`Generated sitemap index for ${countryEntries.length} country landing pages.`);
}

main();
