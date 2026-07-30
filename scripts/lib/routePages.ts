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

/**
 * Locales the SEO pages are prerendered in. English is served unprefixed at the
 * site root; every other locale lives under its own prefix. This list is the
 * single source of truth — the page generator and the sitemap builder both
 * iterate it, so a locale can never appear in one and be missing from the other.
 */
export const PRERENDER_LOCALES = ["en", "zh", "ja", "ko", "fr", "de"] as const;
export type PrerenderLocale = (typeof PRERENDER_LOCALES)[number];

const LOCALE_PREFIX: Record<PrerenderLocale, string> = {
  en: "",
  zh: "/zh",
  ja: "/ja",
  ko: "/ko",
  fr: "/fr",
  de: "/de",
};

/** hreflang value emitted for each prerender locale (page <link> + sitemap). */
export const HREFLANG: Record<PrerenderLocale, string> = {
  en: "en",
  zh: "zh-Hant",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
};

/** "/japan/tokyo-to-kyoto/" + "ja" → "/ja/japan/tokyo-to-kyoto/" */
export function localeUrlPath(urlPath: string, locale: PrerenderLocale): string {
  return `${LOCALE_PREFIX[locale]}${urlPath}`;
}

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
  /** Locale-neutral page path, e.g. "/japan/tokyo-to-kyoto/". Prefix with
   *  localeUrlPath() for the other locales. */
  urlPath: string;
  /** The date whose day slice the page renders (empty for dateless snapshots). */
  canonicalDate: string;
  scrapedAt: string;
  source: string;
  /** True when dayResults is a representative service pattern rather than a real
   *  timetable — see isIndicativeTimetable(). */
  indicative: boolean;
  /** Canonical-day departures sorted by departure time. */
  dayResults: TransitResult[];
}

/** "06:05" → 365. Undefined for anything that is not a HH:MM clock time. */
export function parseClockMinutes(time: string | undefined): number | undefined {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Sources that serve a curated service pattern rather than a scraped timetable. */
const CURATED_SOURCE = /curated|snapshot/i;

/**
 * A curated snapshot is a *representative service pattern*, not a real
 * timetable: its departures sit on one fixed headway and every train shares a
 * duration and fare. Presenting those as exact first/last-train facts is wrong
 * in the one place users check most, so pages render them as a service window
 * and must not emit them as TrainTrip structured data.
 *
 * Detected from the source label, with a uniform-headway check as a backstop in
 * case a snapshot ships under an unfamiliar source string.
 */
export function isIndicativeTimetable(source: string, results: TransitResult[]): boolean {
  if (CURATED_SOURCE.test(source)) return true;
  const minutes = results
    .map((r) => parseClockMinutes(r.departureTime))
    .filter((m): m is number => m !== undefined)
    .sort((a, b) => a - b);
  if (minutes.length < 4) return false;
  const gaps = new Set<number>();
  for (let i = 1; i < minutes.length; i += 1) gaps.add(minutes[i] - minutes[i - 1]);
  return gaps.size === 1;
}

/**
 * Strips operator baggage that reads as machine output in a URL and in a SERP
 * breadcrumb: internal codes ("Seoul (SNC)") and the network suffix TfL appends
 * to every stop ("Oxford Circus Underground Station").
 *
 * Applied to slugs and to display names. The raw name is still what search
 * matching and the station menu key on, so tidying here cannot make a station
 * unreachable — see scripts/audit-station-mapping.ts.
 */
export function tidyStationName(name: string): string {
  return name
    .replace(/\s*\([A-Z]{2,4}\)\s*$/, "")
    .replace(/\s+(?:Underground|Rail|DLR)\s+Station$/i, "")
    .trim();
}

/**
 * Letters NFKD cannot decompose, because the stroke or ligature is part of the
 * base glyph rather than a combining mark. Without these, `Bod\u00f8` slugged to
 * `bod` \u2014 the character was silently dropped rather than romanised, which is
 * both unreadable and wrong for anyone searching "bodo".
 */
const UNDECOMPOSABLE: Record<string, string> = {
  \u00f8: "o", \u00e6: "ae", \u0153: "oe", \u00df: "ss", \u00f0: "d", \u00fe: "th", \u0111: "d", \u0142: "l", \u0127: "h", \u0131: "i",
};

export function slugifyStation(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u00f8\u00e6\u0153\u00df\u00f0\u00fe\u0111\u0142\u0127\u0131]/g, (char) => UNDECOMPOSABLE[char])
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
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

      const originSlug = slugifyStation(tidyStationName(route.origin));
      const destinationSlug = slugifyStation(tidyStationName(route.destination));
      if (!originSlug || !destinationSlug) continue;
      const slug = `${originSlug}-to-${destinationSlug}`;
      const urlPath = `${countryPath}/${slug}/`;
      if (seenPaths.has(urlPath)) {
        console.warn(`[route-pages] Duplicate page path ${urlPath} from ${country}/${file}; keeping first`);
        continue;
      }
      seenPaths.add(urlPath);

      const dayResults = [...slice].sort((a, b) =>
        (a.departureTime || "").localeCompare(b.departureTime || ""),
      );
      pages.push({
        country: country as Country,
        countryPath,
        origin: route.origin,
        destination: route.destination,
        slug,
        urlPath,
        canonicalDate: date,
        scrapedAt: route.scrapedAt || "",
        source: route.source || "",
        indicative: isIndicativeTimetable(route.source || "", dayResults),
        dayResults,
      });
    }
  }

  return pages;
}
