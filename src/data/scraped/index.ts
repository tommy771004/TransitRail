import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { TransitResult, Country } from "../../types";
import { findInRoutes, normalizeResults, type ScrapedRouteData } from "./timetableDay";
import {
  decodeSeoulSubwayArtifact,
  searchSeoulSubwayArtifact,
  seoulArtifactCoverageNames,
  seoulArtifactReachableNames,
  precomputeSeoulReachability,
  type SeoulSubwayArtifact,
} from "../seoulSubwayArtifact";
import { stationSearchKey } from "../stationKey";
import {
  coveredEndpointNames,
  reachableDestinations,
  searchableRoutesForDate,
} from "../stationCoverage";
import { normalizeTimetableSource } from "../timetableAuthenticity";

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
let seoulSubwayArtifact: SeoulSubwayArtifact | null = null;
let loaded = false;

function loadSeoulArtifact(): SeoulSubwayArtifact | null {
  const path = join(ACTUAL_DATA_DIR, "korea", "seoul-subway-timetable.json.gz");
  if (!existsSync(path)) return null;
  try {
    const artifact = decodeSeoulSubwayArtifact(readFileSync(path));
    precomputeSeoulReachability(artifact);
    return artifact;
  } catch (error) {
    console.warn("[scraped] Failed to parse Korea Seoul subway artifact:", error);
    return null;
  }
}

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
        const fact = normalizeTimetableSource(JSON.parse(content) as unknown);
        if (!fact.snapshot || fact.issue === "malformed" || fact.issue === "empty") {
          console.warn(`[scraped] Skipping unusable ${country}/${file}: ${fact.issue || "unknown"}`);
          continue;
        }
        data.push({
          ...fact.snapshot,
          provenance: fact.provenance === "unknown" ? undefined : fact.provenance,
        } as ScrapedRouteData);
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
  seoulSubwayArtifact = loadSeoulArtifact();
  loaded = true;
  console.log(`[scraped] Loaded ${totalRoutes} routes across ${ALL_COUNTRIES.length} countries`);
}

/** All names backed by committed timetable data, including compact artifacts. */
export function getScrapedCoverageNames(country: Country, date?: string): string[] {
  if (!loaded) loadScrapedData();
  const names = coveredEndpointNames(cache[country] || [], country, date);
  if (country === "korea" && seoulSubwayArtifact) {
    const byKey = new Map(names.map((name) => [stationSearchKey(name), name]));
    for (const station of seoulArtifactCoverageNames(seoulSubwayArtifact, date)) {
      if (!byKey.has(stationSearchKey(station))) byKey.set(stationSearchKey(station), station);
      if (stationSearchKey(station) === "seoul station") {
        byKey.set("seoul (snc)", "Seoul (SNC)");
      }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }
  return names;
}

/**
 * Route snapshots loaded for a country (empty when none are committed).
 * Read-only view of the boot cache — used to derive station coverage.
 */
export function getScrapedRoutes(country: Country): readonly ScrapedRouteData[] {
  if (!loaded) loadScrapedData();
  return cache[country] || [];
}

/** Date-conditioned destinations exposed by the same search implementation. */
export function getScrapedReachableStations(
  country: Country,
  origin: string,
  date: string,
): string[] {
  if (!loaded) loadScrapedData();
  const reachable = new Map<string, string>();
  for (const station of reachableDestinations(cache[country] || [], origin, country, date)) {
    reachable.set(stationSearchKey(station), station);
  }
  if (country === "korea" && seoulSubwayArtifact) {
    for (const station of seoulArtifactReachableNames(seoulSubwayArtifact, origin, date)) {
      reachable.set(stationSearchKey(station), station);
    }
  }
  return [...reachable.values()].sort((a, b) => a.localeCompare(b));
}

/** Returns the newest route-snapshot timestamp loaded for a country, if known. */
export function getScrapedCountryFreshness(country: Country): string | undefined {
  if (!loaded) loadScrapedData();

  const newest = (cache[country] || []).reduce<number | undefined>((latest, route) => {
    const timestamp = Date.parse(route.scrapedAt);
    if (!Number.isFinite(timestamp)) return latest;
    return latest === undefined || timestamp > latest ? timestamp : latest;
  }, undefined);

  const artifactTimestamp = country === "korea" && seoulSubwayArtifact
    ? Date.parse(seoulSubwayArtifact.retrievedAt)
    : Number.NaN;
  const combined = Number.isFinite(artifactTimestamp)
    ? newest === undefined ? artifactTimestamp : Math.max(newest, artifactTimestamp)
    : newest;
  return combined === undefined ? undefined : new Date(combined).toISOString();
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

  if (country === "korea" && seoulSubwayArtifact && date) {
    const metro = searchSeoulSubwayArtifact(seoulSubwayArtifact, { origin, destination, date });
    if (metro.length > 0) return normalizeResults(metro);
  }

  const countryData = searchableRoutesForDate(cache[country] || [], country, date);
  if (countryData.length === 0) return null;

  const found = findInRoutes(countryData, origin, destination, date, country);
  if (!found) return null;

  return normalizeResults(found);
}
