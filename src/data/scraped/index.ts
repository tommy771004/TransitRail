import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { TransitResult, Country } from "../../types";
import { findInRoutes, normalizeResults, type ScrapedRouteData } from "./timetableDay";
import {
  decodeKoreanSubwayArtifact,
  searchKoreanSubwayArtifact,
  koreanArtifactCoverageNames,
  koreanServiceDayType,
  koreanArtifactReachableNames,
  precomputeKoreanReachability,
  KOREAN_ARTIFACT_SOURCE_IDS,
  type KoreanSubwayArtifact,
} from "../koreanSubwayArtifact";
import { buildSourceMeta } from "../sourceRegistry";
import { stationSearchKey } from "../stationKey";
import {
  coveredEndpointNames,
} from "../stationCoverage";
import {
  applySourceFact,
  authenticityOptionsFor,
  isCompleteTimetableSnapshot,
  normalizeTimetableSource,
} from "../timetableAuthenticity";
import {
  decideCoverageSearchability,
  decideSearchability,
  tagResultsWithDecision,
  searchableRoutesForContext,
  summarizeSearchability,
  type SearchabilityDecision,
} from "../searchabilityPolicy";

export type { ScrapedRouteData } from "./timetableDay";
export {
  canonicalDay,
  findInRoutes,
  normalizeHeadsigns,
  normalizeResults,
  normalizeTransferLegTimes,
} from "./timetableDay";

export interface ScrapedSearchabilityResult {
  results: TransitResult[];
  decision: SearchabilityDecision;
}

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
  "japan", "korea", "singapore", "malaysia", "thailand",
  "hong_kong", "united_kingdom", "united_states",
  "germany", "france", "belgium", "norway", "china", "switzerland",
];

let cache: Record<string, ScrapedRouteData[]> = {};
/**
 * Compact Korean subway artifacts, in load order.
 *
 * Seoul and Incheon are separate networks published by separate operators, but
 * they share the artifact shape and both file under `korea`. Holding them as a
 * list rather than one Seoul variable is what lets a second network land
 * without every call site growing a special case — and a network whose file is
 * missing or unreadable simply does not join the list.
 */
const KOREAN_ARTIFACT_FILES = [
  "seoul-subway-timetable.json.gz",
  "incheon-subway-timetable.json.gz",
] as const;

let koreanArtifacts: KoreanSubwayArtifact[] = [];
let loaded = false;

function loadKoreanArtifacts(): KoreanSubwayArtifact[] {
  const artifacts: KoreanSubwayArtifact[] = [];
  for (const file of KOREAN_ARTIFACT_FILES) {
    const path = join(ACTUAL_DATA_DIR, "korea", file);
    if (!existsSync(path)) continue;
    try {
      const artifact = decodeKoreanSubwayArtifact(readFileSync(path));
      precomputeKoreanReachability(artifact);
      artifacts.push(artifact);
    } catch (error) {
      console.warn(`[scraped] Failed to parse Korea artifact ${file}:`, error);
    }
  }
  return artifacts;
}

function koreanArtifactDecision(date?: string): SearchabilityDecision | undefined {
  if (koreanArtifacts.length === 0) return undefined;
  return decideCoverageSearchability({
    country: "korea",
    serviceDay: date,
    provenance: "official",
    sourceServiceDay: date,
    hasCoverage: koreanArtifacts.some((artifact) =>
      koreanArtifactCoverageNames(artifact, date).length > 0),
  });
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
        // Classify with the country's own policy, not just its identity. Passing
        // only `expectedCountry` let a handful of live rows for today stamp the
        // whole file `realtime`/`verified`, even when every other date in it was
        // a curated slice that per-date classification calls `indicative`.
        const fact = normalizeTimetableSource(
          JSON.parse(content) as unknown,
          undefined,
          authenticityOptionsFor(country as Country),
        );
        if (!fact.snapshot || fact.truthMode === "unusable" || !isCompleteTimetableSnapshot(fact.snapshot)) {
          console.warn(`[scraped] Skipping unusable ${country}/${file}: ${fact.issue || "unknown"}`);
          continue;
        }
        data.push(applySourceFact(fact.snapshot, fact));
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
  koreanArtifacts = loadKoreanArtifacts();
  loaded = true;
  console.log(`[scraped] Loaded ${totalRoutes} routes across ${ALL_COUNTRIES.length} countries`);
}

/** All names backed by committed timetable data, including compact artifacts. */
export function getScrapedCoverageNames(country: Country, date?: string): string[] {
  if (!loaded) loadScrapedData();
  const names = coveredEndpointNames(cache[country] || [], country, date);
  if (country === "korea" && koreanArtifacts.length > 0) {
    const byKey = new Map(names.map((name) => [stationSearchKey(name), name]));
    for (const station of koreanArtifacts.flatMap((artifact) =>
      koreanArtifactCoverageNames(artifact, date))) {
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
  const artifactDecision = country === "korea" ? koreanArtifactDecision(date) : undefined;
  const selection = searchableRoutesForContext(cache[country] || [], {
    country,
    serviceDay: date,
    origin,
    additionalReachableDestinations: artifactDecision?.searchable
      ? koreanArtifacts.flatMap((artifact) => koreanArtifactReachableNames(artifact, origin, date))
      : undefined,
  });
  return selection.reachableDestinations;
}

/**
 * Line names the committed artifacts run trains on for a service day.
 *
 * The artifacts sit outside `getScrapedRoutes`, so a catalog asking "does this
 * line have data" cannot see them through route rows. Each run already records
 * its line; reading that is O(runs) once, where inferring it from station
 * reachability was O(lines x stations x destinations) per request.
 */
export function getArtifactLineNames(country: Country, date?: string): Set<string> {
  if (!loaded) loadScrapedData();
  const names = new Set<string>();
  if (country !== "korea") return names;
  for (const artifact of koreanArtifacts) {
    const dayType = date ? koreanServiceDayType(date) : undefined;
    for (const [line, , runDayType] of artifact.runs) {
      if (dayType && runDayType !== dayType) continue;
      if (line) names.add(line);
    }
  }
  return names;
}

/** Returns the newest route-snapshot timestamp loaded for a country, if known. */
export function getScrapedCountryFreshness(country: Country): string | undefined {
  if (!loaded) loadScrapedData();

  const newest = (cache[country] || []).reduce<number | undefined>((latest, route) => {
    const timestamp = Date.parse(route.scrapedAt);
    if (!Number.isFinite(timestamp)) return latest;
    return latest === undefined || timestamp > latest ? timestamp : latest;
  }, undefined);

  const artifactTimestamp = country === "korea" && koreanArtifacts.length > 0
    ? Math.max(...koreanArtifacts.map((artifact) => Date.parse(artifact.retrievedAt)))
    : Number.NaN;
  const combined = Number.isFinite(artifactTimestamp)
    ? newest === undefined ? artifactTimestamp : Math.max(newest, artifactTimestamp)
    : newest;
  return combined === undefined ? undefined : new Date(combined).toISOString();
}

/** Shared provenance/truth summary for station and line discovery. */
export function getScrapedSearchabilitySummary(country: Country, date?: string) {
  if (!loaded) loadScrapedData();
  const selection = searchableRoutesForContext(cache[country] || [], {
    country,
    serviceDay: date,
  });
  const decisions = [...selection.decisions];
  const artifactDecision = country === "korea" ? koreanArtifactDecision(date) : undefined;
  if (artifactDecision) decisions.push(artifactDecision);
  return summarizeSearchability(decisions);
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
  return findScrapedSearchability(country, origin, destination, date)?.results || null;
}

function decisionForFoundResults(
  decisions: SearchabilityDecision[],
  found: TransitResult[],
): SearchabilityDecision | undefined {
  const matching = decisions.filter((decision) => decision.sourceFact?.snapshot?.results.some((row) => (
    found.some((result) => result.id === row.id)
  )));
  const fallback = matching.length > 0 ? matching : decisions.filter((decision) => decision.searchable);
  if (fallback.length === 0) return undefined;
  const indicative = fallback.some((decision) => decision.truthMode === "indicative");
  const provenance = new Set(fallback.map((decision) => decision.provenance));
  return {
    ...fallback[0],
    truthMode: indicative ? "indicative" : fallback[0].truthMode,
    provenance: provenance.size === 1 ? fallback[0].provenance : "unknown",
  };
}

/** Search the committed route graph and retain the policy decision for output. */
export function findScrapedSearchability(
  country: Country,
  origin: string,
  destination: string,
  date?: string,
): ScrapedSearchabilityResult | null {
  if (!loaded) loadScrapedData();

  // Ask each network in turn and take the first that can answer. A pair that
  // spans two networks is not answerable from either artifact alone — there is
  // no shared timetable to join them on, so no result is the honest outcome
  // rather than a journey stitched from two feeds that never quote a transfer.
  if (country === "korea" && date) {
    for (const artifact of koreanArtifacts) {
      const metro = searchKoreanSubwayArtifact(artifact, { origin, destination, date });
      if (metro.length === 0) continue;
      const fact = normalizeTimetableSource({
        origin,
        destination,
        date,
        scrapedAt: artifact.retrievedAt,
        source: artifact.source,
        // The artifact format stores the operator's label; the register entry
        // behind it supplies the URL, tier, and fetch time search reports.
        sourceMeta: buildSourceMeta({
          sourceId: KOREAN_ARTIFACT_SOURCE_IDS[artifact.source],
          fetchedAt: artifact.retrievedAt,
        }),
        provenance: "official",
        results: metro,
      }, date, { expectedCountry: "korea" });
      const decision = decideSearchability({
        country,
        serviceDay: date,
        origin,
        destination,
        sourceFact: fact,
      });
      if (decision.searchable && fact.snapshot) {
        return {
          decision,
          results: tagResultsWithDecision(normalizeResults(fact.snapshot.results), decision),
        };
      }
    }
  }

  const selection = searchableRoutesForContext(cache[country] || [], {
    country,
    serviceDay: date,
  });
  if (selection.routes.length === 0) return null;

  const found = findInRoutes(selection.routes, origin, destination, date, country)
    || findInRoutes(selection.routes, origin, destination, undefined, country);
  if (!found) return null;

  const decision = decisionForFoundResults(selection.decisions, found);
  if (!decision?.searchable) return null;
  return {
    decision,
    results: tagResultsWithDecision(normalizeResults(found), decision),
  };
}
