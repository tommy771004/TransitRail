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
import { configuredCountryOptions, countryConfig, countryFlags } from "../src/data/countries";
import {
  findOfficialSource,
  isValidSourceMeta,
  officialSourcesForCountry,
  tierForSourceType,
  type SourceTier,
} from "../src/data/sourceRegistry";
import type { ScrapedRouteData } from "../src/data/scraped/timetableDay";
import {
  decodeKoreanSubwayArtifact,
  KOREAN_ARTIFACT_SOURCE_IDS,
} from "../src/data/koreanSubwayArtifact";

const DATA_DIR = resolve("src/data/scraped");
const SERVICE_DAY_DIR = resolve("src/data/service-day");
const OUTPUT = resolve("SOURCE_COVERAGE.md");

interface CountryAudit {
  country: Country;
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
}

interface ArtifactSummary {
  runs: number;
  sourceIds: string[];
  retrievedAt: string[];
}

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

export function auditCountry(country: Country): CountryAudit {
  const routes = loadRoutes(country);
  const artifacts = loadArtifacts(country);
  const verified = routes.filter((route) => isValidSourceMeta(route.sourceMeta));
  const fetches = [
    ...verified.map((route) => route.sourceMeta!.fetchedAt),
    ...artifacts.retrievedAt,
  ]
    .filter(Boolean)
    .sort();

  return {
    country,
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
  lines.push("| Market | Answers | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |");
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const audit of audits) {
    lines.push([
      `${countryFlags[audit.country] || ""} ${audit.country}`,
      verdict(audit),
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

  lines.push("## Known gaps", "");
  lines.push(
    "These are markets or operators with no source wired up. They are listed so the",
    "absence is a tracked fact rather than something a reader has to infer from an",
    "empty table row.",
    "",
  );
  lines.push("| Operator | Market | Why there is no data |");
  lines.push("| --- | --- | --- |");
  lines.push("| Korail | korea | Blocks automated access to its journey search (`CODE : -8003`); no open feed. |");
  lines.push("| 12306 | china | No open feed, and no permitted automated access to the official search. |");
  lines.push("| JR East / West / Kyushu / Hokkaido / Shikoku | japan | No adapter written; only JR Central and ODPT are wired up. |");
  lines.push("| National Rail | united_kingdom | Only TfL is wired up; Network Rail / National Rail feeds are not. |");
  lines.push("| SNCF TER / RER / Metro | france | Only the long-distance GTFS extract is wired up. |");
  lines.push("| KTMB / Prasarana | malaysia | Publishes station catalogues, no timetable. |");
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

function main() {
  const audits = configuredCountryOptions.map(auditCountry);
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

if (process.argv[1] && process.argv[1].endsWith("audit-source-coverage.ts")) main();
