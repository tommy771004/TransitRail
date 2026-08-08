/**
 * The standing answer to "where does each country's data come from, and what
 * can it actually answer?"
 *
 * Run: `npm run audit:sources` (writes SOURCE_COVERAGE.md and prints a summary)
 *
 * Written as a generated file rather than prose because the interesting column
 * is the one nobody maintains by hand: which markets have **no** source. A
 * hand-written table records the day someone last thought about it; this one
 * records the day the pipeline last ran, including the gaps.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { Country } from "../src/types";
import {
  configuredCountryOptions,
  countryConfig,
  countryFlags,
  providerDateValue,
} from "../src/data/countries";
import {
  findOfficialSource,
  isValidSourceMeta,
  officialSourcesForCountry,
  tierForSourceType,
  type SourceTier,
  type SourceTemporalCoverage,
} from "../src/data/sourceRegistry";
import { buildServiceRegionCatalog } from "../src/server/catalog";
import type { ScrapedRouteData } from "../src/data/scraped/timetableDay";
import {
  decodeKoreanSubwayArtifact,
  KOREAN_ARTIFACT_SOURCE_IDS,
} from "../src/data/koreanSubwayArtifact";

const DATA_DIR = resolve("src/data/scraped");
const SERVICE_DAY_DIR = resolve("src/data/service-day");
const OUTPUT = resolve("SOURCE_COVERAGE.md");

export interface CountryAudit {
  country: Country;
  serviceDate: string;
  scrape: string;
  routeFiles: number;
  verifiedRoutes: number;
  departureRows: number;
  /**
   * Train runs held in a compressed timetable artifact rather than in route
   * files. Korea's whole timetable is one of these, so a report that counted
   * only route files said Korea had no data while search was answering from it.
   */
  artifactRuns: number;
  serviceDates: string[];
  oldestFetch?: string;
  newestFetch?: string;
  sourceIds: string[];
  tiers: SourceTier[];
  completeness: string[];
  hasServiceDayArtifact: boolean;
  network: {
    state: "searchable" | "no-searchable-network";
    declaredRegions: string[];
    declaredLines: number;
    declaredStations: number;
    regions: string[];
    lines: number;
    stations: number;
    message?: string;
  };
  temporal: {
    state: TemporalState;
    fetchedAt?: string;
    observedSpan?: string;
  };
}

interface ArtifactSummary {
  runs: number;
  sourceIds: string[];
  retrievedAt: string[];
}

export type TemporalState = "full-timetable" | "sampled-service-day" | "bounded-upcoming" | "frequency-or-service-hours" | "catalog-only" | "stale" | "unavailable";

export interface TemporalAuditInput {
  country: Country;
  serviceDate: string;
  departureRows: number;
  artifactRuns: number;
  hasServiceDayArtifact: boolean;
  newestFetch?: string;
  sourceIds: string[];
  completeness: string[];
  observedSpan?: string;
  observedSpanMinutes?: number;
}

/** A full-day source observed for less than eight hours is a sample, not proof of a whole operating day. */
export const MIN_FULL_TIMETABLE_SPAN_MINUTES = 8 * 60;

/** Read whatever compressed timetable artifacts this country stores. */
function loadArtifacts(country: Country): ArtifactSummary {
  const dir = join(DATA_DIR, country);
  const summary: ArtifactSummary = { runs: 0, sourceIds: [], retrievedAt: [] };
  if (!existsSync(dir)) return summary;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json.gz")) continue;
    try {
      const artifact = decodeKoreanSubwayArtifact(readFileSync(join(dir, file)));
      summary.runs += artifact.runs.length;
      summary.sourceIds.push(KOREAN_ARTIFACT_SOURCE_IDS[artifact.source]);
      summary.retrievedAt.push(artifact.retrievedAt);
    } catch {
      // An artifact this build cannot decode contributes nothing; the
      // validation run reports it separately.
    }
  }
  return summary;
}

function loadRoutes(country: Country): ScrapedRouteData[] {
  const dir = join(DATA_DIR, country);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json") && file !== "metadata.json")
    .flatMap((file) => {
      try {
        return [JSON.parse(readFileSync(join(dir, file), "utf-8")) as ScrapedRouteData];
      } catch {
        return [];
      }
    });
}

function observedDepartureSpan(routes: readonly ScrapedRouteData[], serviceDate: string): string | undefined {
  const times = routes.flatMap((route) => route.results)
    .filter((result) => result.date === serviceDate)
    .map((result) => result.departureTime)
    .filter((time): time is string => /^\d{2}:\d{2}$/.test(time))
    .sort();
  return times.length > 0 ? `${times[0]}–${times.at(-1)}` : undefined;
}

function observedSpanMinutes(observedSpan: string | undefined): number | undefined {
  if (!observedSpan) return undefined;
  const [start, end] = observedSpan.split("–").map((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  });
  return Number.isFinite(start) && Number.isFinite(end) ? end - start : undefined;
}

export function classifyTemporalState(input: TemporalAuditInput): CountryAudit["temporal"] {
  const fetchedAt = input.newestFetch;
  if (countryConfig[input.country].search.kind === "catalog_only") return { state: "catalog-only", fetchedAt };
  if (input.departureRows === 0 && input.artifactRuns === 0) {
    return { state: input.hasServiceDayArtifact || input.completeness.some((value) => value !== "full-timetable")
      ? "frequency-or-service-hours"
      : "unavailable", fetchedAt };
  }
  // A fetch from another market-local day cannot describe today's service,
  // regardless of its official provenance or source grade.
  if (!fetchedAt || providerDateValue(input.country, new Date(fetchedAt)) !== input.serviceDate) {
    return { state: "stale", fetchedAt, observedSpan: input.observedSpan };
  }
  // Route rows are the only evidence that a non-artifact market actually has
  // departures for this requested day. A current fetch timestamp alone is not
  // enough: it may be a provider response with no usable service slice.
  if (!input.observedSpan && input.artifactRuns === 0) {
    return { state: "stale", fetchedAt };
  }
  const temporalShapes = input.sourceIds
    .map((id) => findOfficialSource(id)?.temporalCoverage)
    .filter((value): value is SourceTemporalCoverage => Boolean(value));
  if (temporalShapes.includes("bounded-upcoming")) return { state: "bounded-upcoming", fetchedAt, observedSpan: input.observedSpan };
  if (temporalShapes.includes("sampled-service-day")
    || (input.artifactRuns === 0 && (input.observedSpanMinutes ?? 0) < MIN_FULL_TIMETABLE_SPAN_MINUTES)) {
    return { state: "sampled-service-day", fetchedAt, observedSpan: input.observedSpan };
  }
  return { state: "full-timetable", fetchedAt, observedSpan: input.observedSpan };
}

export async function auditCountry(country: Country, now = new Date()): Promise<CountryAudit> {
  const routes = loadRoutes(country);
  const artifacts = loadArtifacts(country);
  const verified = routes.filter((route) => isValidSourceMeta(route.sourceMeta));
  const fetches = [
    ...verified.map((route) => route.sourceMeta!.fetchedAt),
    ...artifacts.retrievedAt,
  ]
    .filter(Boolean)
    .sort();

  const serviceDate = providerDateValue(country, now);
  const base = {
    country,
    serviceDate,
    scrape: countryConfig[country].scrape,
    routeFiles: routes.length,
    verifiedRoutes: verified.length,
    artifactRuns: artifacts.runs,
    departureRows: routes.reduce((total, route) => total + route.results.length, 0),
    serviceDates: [...new Set(routes.flatMap((route) =>
      route.results.map((result) => result.date).filter((date): date is string => Boolean(date))))].sort(),
    oldestFetch: fetches[0],
    newestFetch: fetches.at(-1),
    sourceIds: [...new Set([
      ...verified.map((route) => route.sourceMeta!.sourceId),
      ...artifacts.sourceIds,
    ])].sort(),
    tiers: [...new Set([
      ...verified.map((route) => route.sourceMeta!.sourceTier),
      ...artifacts.sourceIds.map((id) => tierForSourceType(findOfficialSource(id)!.sourceType)),
    ])].sort(),
    completeness: [...new Set([
      ...verified.map((route) => route.sourceMeta!.completeness),
      ...artifacts.sourceIds.map(() => "full-timetable"),
    ])].sort(),
    hasServiceDayArtifact: existsSync(join(SERVICE_DAY_DIR, `${country}.json`)),
  };
  // `includeProvider: false` makes this report reproducible from committed
  // routes/artifacts. The same hierarchy powers the passenger browser.
  const catalog = await buildServiceRegionCatalog({ country, date: serviceDate, includeProvider: false });
  const topology = countryConfig[country].marketTopology.regions;
  const declaredRegions = topology.map((region) => region.id);
  const observedSpan = observedDepartureSpan(routes, serviceDate);
  return {
    ...base,
    network: catalog.regions.length > 0
      ? {
        state: "searchable",
        declaredRegions,
        declaredLines: topology.reduce((total, region) => total + region.declaredLines, 0),
        declaredStations: topology.reduce((total, region) => total + region.declaredStations, 0),
        regions: catalog.regions.map((region) => region.id),
        lines: catalog.lines.length,
        stations: catalog.stations.length,
      }
      : {
        state: "no-searchable-network",
        declaredRegions,
        declaredLines: topology.reduce((total, region) => total + region.declaredLines, 0),
        declaredStations: topology.reduce((total, region) => total + region.declaredStations, 0),
        regions: [],
        lines: 0,
        stations: 0,
        message: catalog.message,
      },
    temporal: classifyTemporalState({
      ...base,
      serviceDate,
      country,
      observedSpan,
      observedSpanMinutes: observedSpanMinutes(observedSpan),
    }),
  };
}

/**
 * What a passenger can be told about this country today.
 *
 * Kept as one deliberately blunt phrase per state, because the whole point of
 * the report is that "we have 4 route files" and "we can answer a question" are
 * different facts and the table has to distinguish them.
 */
function verdict(audit: CountryAudit): string {
  if (audit.scrape === "none") return "**No data** — no registered source";
  if (audit.scrape === "catalog_sync") return "Station names only";
  if (audit.departureRows > 0 || audit.artifactRuns > 0) return "Departure times";
  if (audit.hasServiceDayArtifact) return "Service hours / frequency only";
  return "**No data** — source registered, nothing stored";
}

function dateRange(dates: string[]): string {
  if (dates.length === 0) return "—";
  return dates.length === 1 ? dates[0] : `${dates[0]} … ${dates.at(-1)} (${dates.length})`;
}

export function buildReport(audits: CountryAudit[], now = new Date()): string {
  const lines: string[] = [];
  const withDepartures = audits.filter((audit) => audit.departureRows > 0 || audit.artifactRuns > 0);
  const withoutAny = audits.filter((audit) => audit.departureRows === 0 && audit.artifactRuns === 0
    && !audit.hasServiceDayArtifact
    && countryConfig[audit.country].scrape !== "catalog_sync");

  lines.push("# Source coverage and audit", "");
  lines.push(`Generated ${now.toISOString()} by \`npm run audit:sources\`. Do not edit by hand.`, "");
  lines.push(
    "Every departure TransitRail serves comes from a source in",
    "[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source",
    "carries no departures and search answers *No verified timetable available.*",
    "",
  );

  lines.push("## Summary", "");
  lines.push(`- ${withDepartures.length} of ${audits.length} configured markets serve departure times.`);
  lines.push(`- ${audits.reduce((total, audit) => total + audit.departureRows, 0).toLocaleString("en-US")} stored departures across ${audits.reduce((total, audit) => total + audit.verifiedRoutes, 0)} verified routes.`);
  lines.push(`- ${withoutAny.length} market(s) can answer nothing: ${withoutAny.map((audit) => audit.country).join(", ") || "none"}.`);
  lines.push("");

  lines.push("## What each market can answer", "");
  lines.push("| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const audit of audits) {
    const regionCoverage = `${audit.network.regions.length}/${audit.network.declaredRegions.length} declared regions`;
    const lineCoverage = `${audit.network.lines}/${audit.network.declaredLines} declared lines`;
    const stationCoverage = `${audit.network.stations}/${audit.network.declaredStations} declared stations`;
    const network = audit.network.state === "searchable"
      ? `${regionCoverage}; ${lineCoverage}; ${stationCoverage}: ${audit.network.regions.join(", ")}`
      : `No searchable network (${regionCoverage}; ${lineCoverage}; ${stationCoverage})${audit.network.message ? ` — ${audit.network.message}` : ""}`;
    const temporal = `${audit.temporal.state} (${audit.serviceDate})`
      + `${audit.temporal.observedSpan ? `; observed ${audit.temporal.observedSpan}` : ""}`
      + `${audit.temporal.fetchedAt ? `; ${audit.temporal.fetchedAt}` : ""}`;
    lines.push([
      `${countryFlags[audit.country] || ""} ${audit.country}`,
      verdict(audit),
      network,
      temporal,
      audit.sourceIds.join("<br>") || "—",
      audit.tiers.join(", ") || "—",
      audit.completeness.join(", ") || "—",
      String(audit.verifiedRoutes),
      audit.departureRows.toLocaleString("en-US"),
      audit.artifactRuns ? audit.artifactRuns.toLocaleString("en-US") : "—",
      dateRange(audit.serviceDates),
    ].join(" | ").replace(/^/, "| ").concat(" |"));
  }
  lines.push("");

  lines.push("## Registered sources", "");
  lines.push("| Source | Market | Provider | Type | Tier | Max completeness | URL |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const country of configuredCountryOptions) {
    for (const source of officialSourcesForCountry(country)) {
      lines.push(
        `| \`${source.id}\` | ${country} | ${source.provider} | ${source.sourceType}`
        + ` | ${tierForSourceType(source.sourceType)} | ${source.maxCompleteness} | <${source.sourceUrl}> |`,
      );
    }
  }
  lines.push("");

  lines.push("## Expansion gaps outside the declared product market", "");
  lines.push("These gaps come from the same `countryConfig` market boundary that the catalog and coverage ratio use.", "");
  lines.push("| Operator | Market | Why there is no data |");
  lines.push("| --- | --- | --- |");
  const expansionGaps = audits.flatMap((audit) => (countryConfig[audit.country].marketTopology.expansionGaps || [])
    .map((gap) => ({ ...gap, country: audit.country })));
  if (expansionGaps.length === 0) lines.push("| — | — | No declared out-of-market expansion gaps. |");
  for (const gap of expansionGaps) {
    lines.push(`| ${gap.operator} | ${gap.country} | ${gap.reason} |`);
  }
  lines.push("");

  lines.push("## Freshness", "");
  lines.push("| Market | Oldest fetch | Newest fetch |");
  lines.push("| --- | --- | --- |");
  for (const audit of audits.filter((entry) => entry.verifiedRoutes > 0 || entry.artifactRuns > 0)) {
    lines.push(`| ${audit.country} | ${audit.oldestFetch || "—"} | ${audit.newestFetch || "—"} |`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const audits = await Promise.all(configuredCountryOptions.map((country) => auditCountry(country)));
  writeFileSync(OUTPUT, buildReport(audits), "utf-8");

  console.log(`Wrote ${OUTPUT}\n`);
  for (const audit of audits) {
    console.log(
      `  ${audit.country.padEnd(16)} ${verdict(audit).replace(/\*\*/g, "").padEnd(38)}`
      + ` ${String(audit.departureRows).padStart(7)} departures`
      + `${audit.artifactRuns ? ` + ${audit.artifactRuns} artifact runs` : ""}  ${audit.sourceIds.join(", ") || "no source"}`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith("audit-source-coverage.ts")) {
  void main().catch((error) => { console.error(error); process.exit(1); });
}
