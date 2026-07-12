/**
 * Shared enumeration of prerenderable route pages, used by both
 * scripts/generate-route-pages.ts (HTML output) and
 * scripts/generate-sitemaps.ts (routes.xml) so the two never disagree.
 *
 * A route page maps 1:1 to a scraped route file that has enough departures on
 * its canonical day to be a useful, non-thin content page. Reverse directions
 * are NOT synthesized here — only real files become pages.
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import type { Country, TransitResult } from "../../src/types";

export const COUNTRY_PATHS: Record<string, string> = {
  japan: "/japan",
  korea: "/korea",
  china: "/china",
  singapore: "/singapore",
  malaysia: "/malaysia",
  thailand: "/thailand",
  hong_kong: "/hong-kong",
  united_kingdom: "/united-kingdom",
  united_states: "/united-states",
  germany: "/germany",
  france: "/france",
  belgium: "/belgium",
  norway: "/norway",
  switzerland: "/switzerland",
};

/** Pages with fewer canonical-day departures than this are skipped as thin. */
const MIN_DAILY_RESULTS = 3;

interface ScrapedRouteFile {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

export interface RoutePageData {
  country: Country;
  countryPath: string;
  origin: string;
  destination: string;
  slug: string;
  /** English page path, e.g. "/japan/tokyo-to-kyoto/" */
  urlPath: string;
  /** zh-TW page path, e.g. "/zh/japan/tokyo-to-kyoto/" */
  zhUrlPath: string;
  /** Japanese page path, e.g. "/ja/japan/tokyo-to-kyoto/" */
  jaUrlPath: string;
  /** Korean page path, e.g. "/ko/japan/tokyo-to-kyoto/" */
  koUrlPath: string;
  /** The date whose day slice the page renders (empty for dateless snapshots). */
  canonicalDate: string;
  scrapedAt: string;
  source: string;
  /** Canonical-day departures sorted by departure time. */
  dayResults: TransitResult[];
}

export function slugifyStation(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Route files accumulate one dated day slice per scrape date. The page renders
 * the latest stored date (the freshest scrape's "today"); dateless results
 * (curated snapshots collapsed to a canonical day) are all kept.
 */
function canonicalDaySlice(results: TransitResult[]): { date: string; slice: TransitResult[] } {
  const dates = [...new Set(results.map((r) => (r.date || "").trim()).filter(Boolean))].sort();
  if (dates.length === 0) {
    return { date: "", slice: results };
  }
  const date = dates[dates.length - 1];
  return { date, slice: results.filter((r) => (r.date || "").trim() === date) };
}

export function collectRoutePages(scrapedDir = resolve("src/data/scraped")): RoutePageData[] {
  const pages: RoutePageData[] = [];
  const seenPaths = new Set<string>();
  const countries = existsSync(scrapedDir)
    ? readdirSync(scrapedDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name in COUNTRY_PATHS)
        .map((entry) => entry.name)
        .sort()
    : [];

  for (const country of countries) {
    const countryPath = COUNTRY_PATHS[country];
    const dir = join(scrapedDir, country);
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      let route: ScrapedRouteFile;
      try {
        route = JSON.parse(readFileSync(join(dir, file), "utf8"));
      } catch {
        console.warn(`[route-pages] Skipping unparsable ${country}/${file}`);
        continue;
      }
      if (!route.origin || !route.destination || !Array.isArray(route.results)) continue;

      const { date, slice } = canonicalDaySlice(route.results);
      if (slice.length < MIN_DAILY_RESULTS) {
        console.warn(`[route-pages] Skipping thin route ${country}/${file} (${slice.length} departures)`);
        continue;
      }

      const originSlug = slugifyStation(route.origin);
      const destinationSlug = slugifyStation(route.destination);
      if (!originSlug || !destinationSlug) continue;
      const slug = `${originSlug}-to-${destinationSlug}`;
      const urlPath = `${countryPath}/${slug}/`;
      if (seenPaths.has(urlPath)) {
        console.warn(`[route-pages] Duplicate page path ${urlPath} from ${country}/${file}; keeping first`);
        continue;
      }
      seenPaths.add(urlPath);

      pages.push({
        country: country as Country,
        countryPath,
        origin: route.origin,
        destination: route.destination,
        slug,
        urlPath,
        zhUrlPath: `/zh${urlPath}`,
        jaUrlPath: `/ja${urlPath}`,
        koUrlPath: `/ko${urlPath}`,
        canonicalDate: date,
        scrapedAt: route.scrapedAt || "",
        source: route.source || "",
        dayResults: [...slice].sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || "")),
      });
    }
  }

  return pages;
}
