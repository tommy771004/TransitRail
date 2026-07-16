import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { TransitResult, Country } from "../../types";
import { findInRoutes, normalizeResults, type ScrapedRouteData } from "./timetableDay";

export type { ScrapedRouteData } from "./timetableDay";
export {
  canonicalDay,
  findInRoutes,
  normalizeHeadsigns,
  normalizeResults,
  normalizeTransferLegTimes,
} from "./timetableDay";

// Resolve the data directory relative to this file, regardless of CJS or ESM.
function resolveDataDir(): string {
  let dir = "";
  if (typeof import.meta !== "undefined" && import.meta.url) {
    dir = dirname(fileURLToPath(import.meta.url));
  } else {
    try {
      // @ts-ignore – __dirname exists in CJS
      dir = __dirname as string;
    } catch {
      dir = "";
    }
  }

  // If we are in development, the directory is already /src/data/scraped or similar
  if (dir && (dir.endsWith("scraped") || dir.endsWith("scraped/"))) {
    return dir;
  }

  // Otherwise, we are likely bundled (e.g. in 'dist', 'api', or some Vercel build folder)
  // We can use process.cwd() as it is extremely stable across dev and Vercel!
  return join(process.cwd(), "src/data/scraped");
}

const ACTUAL_DATA_DIR = resolveDataDir();

const ALL_COUNTRIES: Country[] = [
  "japan", "korea", "singapore", "thailand",
  "hong_kong", "united_kingdom", "united_states",
  "germany", "france", "belgium", "norway", "china", "switzerland",
];

let cache: Record<string, ScrapedRouteData[]> = {};
let loaded = false;

function loadDir(country: string): ScrapedRouteData[] {
  const data: ScrapedRouteData[] = [];
  try {
    const dirPath = join(ACTUAL_DATA_DIR, country);
    if (!existsSync(dirPath)) {
      return data;
    }
    const files = readdirSync(dirPath);
    for (const file of files) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      try {
        const content = readFileSync(join(dirPath, file), "utf-8");
        data.push(JSON.parse(content));
      } catch (e) {
        console.warn(`[scraped] Failed to parse ${country}/${file}:`, e);
      }
    }
  } catch (error) {
    console.warn(`[scraped] Directory check failed for ${country}:`, error);
  }
  return data;
}

export function loadScrapedData(): void {
  let totalRoutes = 0;
  for (const country of ALL_COUNTRIES) {
    cache[country] = loadDir(country);
    totalRoutes += cache[country].length;
  }
  loaded = true;
  console.log(`[scraped] Loaded ${totalRoutes} routes across ${ALL_COUNTRIES.length} countries`);
}

/** Returns the newest route-snapshot timestamp loaded for a country, if known. */
export function getScrapedCountryFreshness(country: Country): string | undefined {
  if (!loaded) loadScrapedData();

  const newest = (cache[country] || []).reduce<number | undefined>((latest, route) => {
    const timestamp = Date.parse(route.scrapedAt);
    if (!Number.isFinite(timestamp)) return latest;
    return latest === undefined || timestamp > latest ? timestamp : latest;
  }, undefined);

  return newest === undefined ? undefined : new Date(newest).toISOString();
}

/**
 * Load country snapshots and find timetable results.
 * Matching/chaining lives in {@link findInRoutes}; this adapter owns I/O + display normalize.
 */
export function findScrapedResults(
  country: Country,
  origin: string,
  destination: string,
  date?: string,
): TransitResult[] | null {
  if (!loaded) loadScrapedData();

  const countryData = cache[country];
  if (!countryData || countryData.length === 0) return null;

  const found = findInRoutes(countryData, origin, destination, date, country);
  if (!found) return null;

  return normalizeResults(found);
}
