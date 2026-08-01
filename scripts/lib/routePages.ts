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
import { countryOptions } from "../../src/data/countries";
import {
  parseClockMinutes,
} from "../../src/data/timetableAuthenticity";
import {
  permitsIndicativeRoutePublication,
  routeSearchability,
} from "../../src/data/searchabilityPolicy";

export { isIndicativeTimetable, parseClockMinutes } from "../../src/data/timetableAuthenticity";

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

/**
 * This spec removes only the eight representative Singapore/Thailand metro
 * pages. Intercity and high-speed route pages remain on their existing SEO
 * contract; their data-quality review is explicitly out of scope here.
 */
interface ScrapedRouteFile {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  provenance?: "official" | "curated" | "llm-advisory";
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
  truthMode: "verified" | "indicative";
  provenance: "official" | "curated" | "llm-advisory" | "unknown";
  /** Canonical-day departures sorted by departure time. */
  dayResults: TransitResult[];
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
function canonicalDaySlice(
  route: ScrapedRouteFile,
  country: Country,
): { date: string; slice: TransitResult[]; decision: ReturnType<typeof routeSearchability> } | null {
  const results = route.results;
  const dates = [...new Set(results.map((r) => (r.date || "").trim()).filter(Boolean))].sort();
  const candidates = dates.length > 0
    ? [...dates].reverse().map((date) => ({ date, slice: results.filter((r) => (r.date || "").trim() === date) }))
    : [{ date: "", slice: results }];

  for (const candidate of candidates) {
    const decision = routeSearchability(
      { ...route, results: candidate.slice },
      country,
      candidate.date || undefined,
      // Publication may expose general indicative information. It must still
      // carry the indicative truth mode and avoid date-specific schema claims.
      undefined,
      true,
    );
    if (!decision.searchable) continue;
    if (decision.truthMode !== "verified" && decision.truthMode !== "indicative") continue;
    if (decision.truthMode === "indicative" && !permitsIndicativeRoutePublication(country)) return null;
    return {
      date: decision.truthMode === "verified" ? candidate.date : "",
      slice: candidate.slice,
      decision,
    };
  }
  return null;
}

export function collectRoutePages(scrapedDir = resolve("src/data/scraped")): RoutePageData[] {
  const pages: RoutePageData[] = [];
  const seenPaths = new Set<string>();
  const countries = existsSync(scrapedDir)
    ? readdirSync(scrapedDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            entry.name in COUNTRY_PATHS &&
            countryOptions.includes(entry.name as Country),
        )
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

      const canonical = canonicalDaySlice(route, country as Country);
      if (!canonical) {
        console.warn(`[route-pages] Skipping unverifiable route ${country}/${file}`);
        continue;
      }
      const { date, slice, decision } = canonical;
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
      const publicationTruthMode = decision.truthMode === "verified" ? "verified" : "indicative";
      const publicationResults = publicationTruthMode === "indicative"
        ? dayResults.map(({ date: _serviceDay, ...result }) => result)
        : dayResults;
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
        indicative: publicationTruthMode === "indicative",
        truthMode: publicationTruthMode,
        provenance: decision.provenance,
        dayResults: publicationResults,
      });
    }
  }

  return pages;
}
