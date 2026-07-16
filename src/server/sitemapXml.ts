/**
 * Flat sitemap XML builder. Used by:
 * - scripts/generate-sitemaps.ts (optional static children + public mirror)
 * - api/sitemap.ts (canonical GSC endpoint — always HTTP 200 application/xml)
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { COUNTRY_PATHS, collectRoutePages } from "../../scripts/lib/routePages";

export const SITE_URL = (process.env.SITE_URL || "https://rail-national.vercel.app").replace(/\/$/, "");

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateOnly(value: string | undefined) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function countryLastModified(scrapedDir: string, country: string) {
  try {
    const metadata = JSON.parse(
      readFileSync(resolve(scrapedDir, country, "metadata.json"), "utf8"),
    ) as { lastScraped?: string };
    return dateOnly(metadata.lastScraped);
  } catch {
    return dateOnly(undefined);
  }
}

function urlEntry(url: string, lastmod: string) {
  return `  <url>\n    <loc>${xml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

export type SitemapEntries = {
  allEntries: Array<{ url: string; lastmod: string }>;
  countryEntries: Array<{ url: string; lastmod: string }>;
  routeEntries: Array<{ url: string; lastmod: string }>;
  latest: string;
  routeLatest: string;
};

export function collectSitemapEntries(
  scrapedDir = resolve(process.cwd(), "src/data/scraped"),
): SitemapEntries {
  const countries = existsSync(scrapedDir)
    ? readdirSync(scrapedDir).filter((country) => country in COUNTRY_PATHS).sort()
    : [];
  const countryEntries = countries.map((country) => ({
    url: `${SITE_URL}${COUNTRY_PATHS[country]}/`,
    lastmod: countryLastModified(scrapedDir, country),
  }));
  const latest = countryEntries.map(({ lastmod }) => lastmod).sort().at(-1) ?? dateOnly(undefined);

  const routePages = collectRoutePages(scrapedDir);
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

  return { allEntries, countryEntries, routeEntries, latest, routeLatest };
}

/** Canonical flat urlset for GSC (single file, no nested index). */
export function buildFlatSitemapXml(scrapedDir?: string): string {
  const { allEntries } = collectSitemapEntries(scrapedDir);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>
`;
}

export function buildPartialUrlset(
  entries: Array<{ url: string; lastmod: string }>,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(({ url, lastmod }) => urlEntry(url, lastmod)).join("\n")}
</urlset>
`;
}
