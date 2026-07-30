/**
 * Flat sitemap XML builder. Used by:
 * - scripts/generate-sitemaps.ts (optional static children + public mirror)
 * - api/sitemap.ts (canonical GSC endpoint — always HTTP 200 application/xml)
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  COUNTRY_PATHS,
  HREFLANG,
  PRERENDER_LOCALES,
  collectRoutePages,
  localeUrlPath,
} from "../../scripts/lib/routePages";

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

/**
 * Every localized variant of a page carries the full alternate set (including
 * itself) plus x-default, so Google can tie the six locales together from the
 * sitemap alone rather than having to crawl each page's <link rel="alternate">.
 */
function alternatesFor(urlPath: string): SitemapAlternate[] {
  return [
    ...PRERENDER_LOCALES.map((locale) => ({
      hreflang: HREFLANG[locale],
      href: `${SITE_URL}${localeUrlPath(urlPath, locale)}`,
    })),
    { hreflang: "x-default", href: `${SITE_URL}${urlPath}` },
  ];
}

function urlEntry(url: string, lastmod: string, alternates?: SitemapAlternate[]) {
  const links = (alternates || [])
    .map(
      ({ hreflang, href }) =>
        `\n    <xhtml:link rel="alternate" hreflang="${xml(hreflang)}" href="${xml(href)}"/>`,
    )
    .join("");
  return `  <url>\n    <loc>${xml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>${links}\n  </url>`;
}

const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
  'xmlns:xhtml="http://www.w3.org/1999/xhtml">';

export type SitemapAlternate = { hreflang: string; href: string };
export type SitemapEntry = { url: string; lastmod: string; alternates?: SitemapAlternate[] };

export type SitemapEntries = {
  allEntries: SitemapEntry[];
  countryEntries: SitemapEntry[];
  routeEntries: SitemapEntry[];
  latest: string;
  routeLatest: string;
};

export function collectSitemapEntries(
  scrapedDir = resolve(process.cwd(), "src/data/scraped"),
): SitemapEntries {
  const routePages = collectRoutePages(scrapedDir);
  // Country hubs come from the routes that actually produced a page, not from
  // the directory listing. A country can have a scraped/ directory holding only
  // metadata.json (Malaysia ships a station catalogue, no timetables); the page
  // generator skips it, so listing its hub would advertise a soft 404 — the SPA
  // catch-all answers 200 with the wrong page.
  const countries = [...new Set(routePages.map((page) => String(page.country)))].sort();
  const countryEntries = countries.flatMap((country) => {
    const lastmod = countryLastModified(scrapedDir, country);
    const hubPath = `${COUNTRY_PATHS[country]}/`;
    const alternates = alternatesFor(hubPath);
    return PRERENDER_LOCALES.map((locale) => ({
      url: `${SITE_URL}${localeUrlPath(hubPath, locale)}`,
      lastmod,
      alternates,
    }));
  });
  const latest = countryEntries.map(({ lastmod }) => lastmod).sort().at(-1) ?? dateOnly(undefined);

  const routeEntries = routePages.flatMap((page) => {
    const lastmod = dateOnly(page.scrapedAt || undefined);
    const alternates = alternatesFor(page.urlPath);
    return PRERENDER_LOCALES.map((locale) => ({
      url: `${SITE_URL}${localeUrlPath(page.urlPath, locale)}`,
      lastmod,
      alternates,
    }));
  });
  const routeLatest = routeEntries.map(({ lastmod }) => lastmod).sort().at(-1) ?? latest;
  const hubAlternates = alternatesFor("/routes/");
  routeEntries.unshift(
    ...PRERENDER_LOCALES.map((locale) => ({
      url: `${SITE_URL}${localeUrlPath("/routes/", locale)}`,
      lastmod: routeLatest,
      alternates: hubAlternates,
    })),
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
${URLSET_OPEN}
${allEntries.map(({ url, lastmod, alternates }) => urlEntry(url, lastmod, alternates)).join("\n")}
</urlset>
`;
}

export function buildPartialUrlset(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
${URLSET_OPEN}
${entries.map(({ url, lastmod, alternates }) => urlEntry(url, lastmod, alternates)).join("\n")}
</urlset>
`;
}
