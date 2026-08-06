/**
 * Builds each country's daily snapshot metadata from the files a run left on
 * disk, and reports what the run actually achieved.
 *
 * The distinction that makes this worth its own module: a route file describes
 * one route, while `metadata.json` describes a *run*. It has to say what was
 * attempted and did not work, not only what is present — otherwise a country
 * whose provider was down for a week looks identical to one that is healthy,
 * because in both cases every file on disk parses fine.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { configuredCountryOptions } from "../../src/data/countries";
import { isValidSourceMeta, ARTIFACT_VERSION } from "../../src/data/sourceRegistry";
import type { ScrapedRouteData } from "./types";
import type { ScrapeRunReport } from "./base";

const DATA_DIR = resolve("src/data/scraped");

export interface CountryMetadata {
  country: string;
  provider: string;
  source: string;
  sourceUrl?: string;
  sourceTier?: string;
  fetchedAt?: string;
  builtAt: string;
  recordCount: number;
  routeCount: number;
  /** Share of this run's route attempts that produced data, 0–1; null if unmeasured. */
  successRate: number | null;
  failedRoutes: Array<{ origin: string; destination: string; error?: string }>;
  coverage: {
    /** Routes whose stored file carries a valid registered source block. */
    verifiedRoutes: number;
    /** Routes present but carrying no departures — known route, unknown times. */
    emptyRoutes: number;
    /** Routes stored without a usable source block; not searchable. */
    unverifiedRoutes: number;
    serviceDates: string[];
  };
  checksum: string;
  artifactVersion: number;
  routes: Array<{
    origin: string;
    destination: string;
    resultCount: number;
    date: string;
    sourceId?: string;
    completeness?: string;
    fetchedAt?: string;
    verified: boolean;
  }>;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function loadRouteData(country: string): ScrapedRouteData[] {
  const dir = resolve(DATA_DIR, country);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((file) => file.endsWith(".json") && file !== "metadata.json")
    .map((file) => readJson<ScrapedRouteData>(resolve(dir, file)))
    .filter((data): data is ScrapedRouteData => Boolean(data))
    .sort((a, b) => `${a.origin}-${a.destination}`.localeCompare(`${b.origin}-${b.destination}`));
}

/**
 * A fingerprint of the timetable content, not of the file bytes.
 *
 * Built from the fields a passenger would act on, so that a rerun which changes
 * only `scrapedAt` produces the same checksum. That is what makes the daily
 * difference report meaningful: a changed checksum means the schedule changed,
 * not that the job ran again.
 */
export function timetableChecksum(routes: readonly ScrapedRouteData[]): string {
  const hash = createHash("sha256");
  for (const route of [...routes].sort((a, b) => `${a.origin}${a.destination}`.localeCompare(`${b.origin}${b.destination}`))) {
    hash.update(`${route.origin}${route.destination}`);
    for (const result of [...route.results].sort((a, b) => (
      `${a.date || ""}${a.departureTime}${a.id}`.localeCompare(`${b.date || ""}${b.departureTime}${b.id}`)
    ))) {
      hash.update([
        result.date || "",
        result.departureTime,
        result.arrivalTime || "",
        result.service,
        result.origin,
        result.destination,
      ].join(""));
      hash.update("");
    }
  }
  return hash.digest("hex");
}

export interface BuildMetadataOptions {
  /** Run reports keyed by country, when a scrape just ran. */
  reports?: Record<string, ScrapeRunReport | undefined>;
  scraperNames?: Record<string, string>;
  now?: Date;
}

/** Return a measured run rate, or null when no run report was supplied. */
export function scrapeSuccessRate(report?: ScrapeRunReport): number | null {
  if (!report || report.outcomes.length === 0) return null;
  const succeeded = report.outcomes.filter((outcome) => outcome.status === "ok").length;
  return Number((succeeded / report.outcomes.length).toFixed(4));
}

/**
 * Recompute every configured country's `metadata.json` from the files on disk.
 *
 * Safe to run without a scrape (that is what `npm run scrape:metadata` does);
 * without a run report a country simply reports no attempts rather than
 * inventing a success rate.
 */
export function buildCountryMetadata(options: BuildMetadataOptions = {}): CountryMetadata[] {
  const builtAt = (options.now ?? new Date()).toISOString();

  return configuredCountryOptions.map((country) => {
    const dir = resolve(DATA_DIR, country);
    mkdirSync(dir, { recursive: true });

    const routes = loadRouteData(country);
    const report = options.reports?.[country];

    const verifiedRoutes = routes.filter((route) => isValidSourceMeta(route.sourceMeta));
    const withRows = verifiedRoutes.filter((route) => route.results.length > 0);
    const sourceMeta = withRows[0]?.sourceMeta ?? verifiedRoutes[0]?.sourceMeta;
    const serviceDates = [...new Set(
      routes.flatMap((route) => route.results.map((result) => result.date).filter((date): date is string => Boolean(date))),
    )].sort();
    const latestFetch = verifiedRoutes
      .map((route) => route.sourceMeta?.fetchedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    const metadata: CountryMetadata = {
      country,
      provider: sourceMeta?.provider ?? options.scraperNames?.[country] ?? "none",
      source: sourceMeta?.sourceName ?? "No registered official source",
      sourceUrl: sourceMeta?.sourceUrl,
      sourceTier: sourceMeta?.sourceTier,
      fetchedAt: latestFetch,
      builtAt,
      recordCount: routes.reduce((total, route) => total + route.results.length, 0),
      routeCount: routes.length,
      // A metadata-only rebuild has no run report; null means "not measured"
      // instead of making a healthy committed snapshot look like a failed run.
      successRate: scrapeSuccessRate(report),
      failedRoutes: (report?.outcomes ?? [])
        .filter((outcome) => outcome.status === "failed")
        .map((outcome) => ({ origin: outcome.origin, destination: outcome.destination, error: outcome.error })),
      coverage: {
        verifiedRoutes: withRows.length,
        emptyRoutes: verifiedRoutes.length - withRows.length,
        unverifiedRoutes: routes.length - verifiedRoutes.length,
        serviceDates,
      },
      checksum: timetableChecksum(routes),
      artifactVersion: ARTIFACT_VERSION,
      routes: routes.map((route) => ({
        origin: route.origin,
        destination: route.destination,
        resultCount: route.results.length,
        date: route.date,
        sourceId: route.sourceMeta?.sourceId,
        completeness: route.sourceMeta?.completeness,
        fetchedAt: route.sourceMeta?.fetchedAt,
        verified: isValidSourceMeta(route.sourceMeta),
      })),
    };

    writeFileSync(resolve(dir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
    return metadata;
  });
}
