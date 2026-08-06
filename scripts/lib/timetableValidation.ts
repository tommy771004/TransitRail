/**
 * The daily integrity checks a scrape has to pass before its output is
 * committed.
 *
 * These exist because the failure this refactor was about is not loud. Invented
 * departures parse, validate structurally, and render perfectly — the only
 * thing wrong with them is that no operator ever published them. So the checks
 * here look for the shapes that data takes when it did not come from a
 * timetable: an unvarying headway, a departure repeated under two ids, an
 * arrival before its departure, a station nothing else has heard of.
 *
 * Severity is the whole design. A `blocking` finding means the run must not be
 * committed, because publishing it would state something false. A `warning`
 * means something is worth a human's attention but is not a lie — an empty day
 * during engineering works, a route whose provider was down. Conflating the two
 * would either commit bad data or block on a quiet Sunday.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { Country, TransitResult } from "../../src/types";
import type { ScrapedRouteData } from "../../src/data/scraped/timetableDay";
import {
  ARTIFACT_VERSION,
  findOfficialSource,
  isValidSourceMeta,
} from "../../src/data/sourceRegistry";
import { parseClockMinutes } from "../../src/data/timetableAuthenticity";

export type ValidationSeverity = "blocking" | "warning";

export interface ValidationFinding {
  check: ValidationCheckId;
  severity: ValidationSeverity;
  country: string;
  route?: string;
  message: string;
}

export type ValidationCheckId =
  | "empty-data"
  | "duplicate-departures"
  | "reversed-times"
  | "over-24-hours"
  | "unknown-stations"
  | "synthetic-headway"
  | "source-mismatch"
  | "missing-source-url"
  | "missing-fetch-time"
  | "missing-artifact-version";

/** Every check, in the order they are reported. */
export const VALIDATION_CHECKS: ValidationCheckId[] = [
  "empty-data",
  "duplicate-departures",
  "reversed-times",
  "over-24-hours",
  "unknown-stations",
  "synthetic-headway",
  "source-mismatch",
  "missing-source-url",
  "missing-fetch-time",
  "missing-artifact-version",
];

export interface ValidationInput {
  country: Country | string;
  route: ScrapedRouteData;
  /** Station names this country's catalog knows about, lower-cased. */
  knownStations?: Set<string>;
}

function routeLabel(route: ScrapedRouteData): string {
  return `${route.origin} → ${route.destination}`;
}

function byServiceDay(results: readonly TransitResult[]): Map<string, TransitResult[]> {
  const days = new Map<string, TransitResult[]>();
  for (const result of results) {
    const day = (result.date || "").trim() || "(undated)";
    days.set(day, [...(days.get(day) || []), result]);
  }
  return days;
}

/**
 * How many departures a day needs before an unvarying gap between them means
 * anything.
 *
 * Four would flag a genuine next-train feed that happens to return four trains
 * at an even spacing. Eight consecutive departures at one exact interval, with
 * no variation anywhere in the day, is not something a real operating day does:
 * the peak differs from the shoulder, and the last hour differs from both.
 */
const SYNTHETIC_MIN_DEPARTURES = 8;

/**
 * A journey longer than this is treated as a parsing error rather than a very
 * long train. The longest scheduled passenger rail journeys in the covered
 * markets are well under a day; a duration above it means a date rolled over
 * without the arrival following it.
 */
const MAX_JOURNEY_MINUTES = 24 * 60;

/** Run every check against one route. */
export function validateRoute(input: ValidationInput): ValidationFinding[] {
  const { country, route, knownStations } = input;
  const findings: ValidationFinding[] = [];
  const label = routeLabel(route);
  const add = (check: ValidationCheckId, severity: ValidationSeverity, message: string) => {
    findings.push({ check, severity, country: String(country), route: label, message });
  };

  // 1. Empty data. A route with no departures is a legitimate state for a
  // frequency-only source, and a real possibility on a closed line, so this
  // warns rather than blocks — but it must not pass silently either.
  if (route.results.length === 0) {
    const completeness = route.sourceMeta?.completeness;
    if (completeness === "full-timetable" || completeness === undefined) {
      add("empty-data", "warning", "No departures stored for any service day.");
    }
  }

  for (const [day, rows] of byServiceDay(route.results)) {
    // 2. Duplicate departures: the same train under two ids inflates a day.
    const seen = new Map<string, number>();
    for (const row of rows) {
      const key = [row.departureTime, row.arrivalTime || "", row.service, row.origin, row.destination].join("");
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const duplicated = [...seen].filter(([, count]) => count > 1);
    if (duplicated.length > 0) {
      add(
        "duplicate-departures",
        "blocking",
        `${day}: ${duplicated.length} departure(s) stored more than once, e.g. ${duplicated[0][0].split("").slice(0, 3).join(" ")}.`,
      );
    }

    for (const row of rows) {
      const departure = parseClockMinutes(row.departureTime);
      const arrival = parseClockMinutes(row.arrivalTime);
      if (departure === undefined || arrival === undefined) continue;
      // A timetable may quote 25:10 for a train that runs past midnight, so an
      // arrival that reads as earlier is only reversed once normalised.
      const journeyMinutes = arrival >= departure ? arrival - departure : arrival + 24 * 60 - departure;

      // 3. Reversed times: an arrival that cannot follow its departure even
      // after allowing for a midnight rollover.
      if (row.durationMinutes !== undefined && Math.abs(journeyMinutes - row.durationMinutes) > 1
        && Math.abs(journeyMinutes - 24 * 60 - row.durationMinutes) > 1) {
        add(
          "reversed-times",
          "blocking",
          `${day}: ${row.id} departs ${row.departureTime}, arrives ${row.arrivalTime}, but claims ${row.durationMinutes} minutes.`,
        );
      }

      // 4. Over 24 hours: a rollover that lost its date.
      if (journeyMinutes > MAX_JOURNEY_MINUTES) {
        add("over-24-hours", "blocking", `${day}: ${row.id} spans ${journeyMinutes} minutes.`);
      }
    }

    // 6. Synthetic headway: a full day at one exact interval.
    const minutes = rows
      .map((row) => parseClockMinutes(row.departureTime))
      .filter((value): value is number => value !== undefined)
      .sort((left, right) => left - right);
    if (minutes.length >= SYNTHETIC_MIN_DEPARTURES) {
      const gaps = new Set<number>();
      for (let index = 1; index < minutes.length; index += 1) gaps.add(minutes[index] - minutes[index - 1]);
      if (gaps.size === 1) {
        add(
          "synthetic-headway",
          "blocking",
          `${day}: all ${minutes.length} departures are exactly ${[...gaps][0]} minutes apart, which is a generated pattern rather than a published timetable.`,
        );
      }
    }
  }

  // 5. Unknown stations: an endpoint the country's catalog has never heard of
  // is unreachable from the picker, so it is data nobody can find.
  if (knownStations && knownStations.size > 0) {
    const endpoints = new Set<string>([route.origin, route.destination]);
    for (const row of route.results) {
      endpoints.add(row.origin);
      endpoints.add(row.destination);
    }
    const unknown = [...endpoints].filter((name) => name && !knownStations.has(name.trim().toLowerCase()));
    if (unknown.length > 0) {
      add("unknown-stations", "warning", `Endpoints not in the station catalog: ${unknown.join(", ")}.`);
    }
  }

  // 7–10. Source provenance. These are blocking because their absence is
  // exactly the state the register exists to make impossible: rows on disk that
  // nobody can trace back to a published source.
  const meta = route.sourceMeta;
  if (!isValidSourceMeta(meta)) {
    add("source-mismatch", "blocking", "No valid registered source block; these rows are not traceable to an official source.");
  } else {
    const source = findOfficialSource(meta.sourceId)!;
    if (meta.country !== country) {
      add("source-mismatch", "blocking", `Source "${meta.sourceId}" belongs to ${meta.country}, not ${country}.`);
    }
    if (!meta.sourceUrl || meta.sourceUrl !== source.sourceUrl) {
      add("missing-source-url", "blocking", `Source URL does not match the register entry for "${meta.sourceId}".`);
    }
    if (!meta.fetchedAt || !Number.isFinite(Date.parse(meta.fetchedAt))) {
      add("missing-fetch-time", "blocking", "Source block has no usable fetch time.");
    }
    if (meta.artifactVersion !== ARTIFACT_VERSION) {
      add(
        "missing-artifact-version",
        "warning",
        `Written under artifact version ${meta.artifactVersion}; current is ${ARTIFACT_VERSION}.`,
      );
    }
  }

  return findings;
}

export interface ValidationReport {
  findings: ValidationFinding[];
  routesChecked: number;
  countriesChecked: number;
}

export function hasBlockingFindings(report: ValidationReport): boolean {
  return report.findings.some((finding) => finding.severity === "blocking");
}

export interface ValidateCommittedOptions {
  dataDir?: string;
  countries?: readonly string[];
  /** Station names per country, lower-cased, for the unknown-station check. */
  knownStations?: Record<string, Set<string>>;
}

/** Validate every committed route file under `dataDir`. */
export function validateCommittedTimetables(options: ValidateCommittedOptions = {}): ValidationReport {
  const dataDir = options.dataDir ?? join(process.cwd(), "src/data/scraped");
  const findings: ValidationFinding[] = [];
  let routesChecked = 0;
  const countries = options.countries
    ?? (existsSync(dataDir)
      ? readdirSync(dataDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      : []);

  for (const country of countries) {
    const dir = join(dataDir, country);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      let route: ScrapedRouteData;
      try {
        route = JSON.parse(readFileSync(join(dir, file), "utf-8")) as ScrapedRouteData;
      } catch (error) {
        findings.push({
          check: "source-mismatch",
          severity: "blocking",
          country,
          route: file,
          message: `Unparsable: ${error instanceof Error ? error.message : error}`,
        });
        continue;
      }
      routesChecked += 1;
      findings.push(...validateRoute({
        country,
        route,
        knownStations: options.knownStations?.[country],
      }));
    }
  }

  return { findings, routesChecked, countriesChecked: countries.length };
}

/**
 * The share of a country's stored departures a single run may remove before it
 * is treated as data loss rather than a schedule change.
 *
 * A timetable change never halves a country overnight. A parser that silently
 * stopped matching, or a feed that started returning an empty envelope with a
 * 200, does exactly that — and the result looks like a successful run, because
 * every file it wrote is well-formed.
 */
const MAX_ROW_LOSS_RATIO = 0.5;

export interface CountryRowCounts {
  [country: string]: number;
}

/**
 * Compare a run's output against the last committed version.
 *
 * Deliberately one-directional: gaining departures is never suspicious, and a
 * country that had nothing cannot lose anything. Only a large drop against a
 * non-empty baseline blocks, because only that indicates the run is about to
 * replace real data with less of it.
 */
export function detectRowLossRegressions(
  baseline: CountryRowCounts,
  current: CountryRowCounts,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const [country, before] of Object.entries(baseline)) {
    if (before === 0) continue;
    const after = current[country] ?? 0;
    if (after >= before * (1 - MAX_ROW_LOSS_RATIO)) continue;
    findings.push({
      check: "empty-data",
      severity: "blocking",
      country,
      message: `Row count fell from ${before} to ${after}`
        + ` (${Math.round((1 - after / before) * 100)}% lost); keeping the previously committed data.`,
    });
  }
  return findings;
}

/** Total stored departures per country, for the regression guard. */
export function countRowsByCountry(options: ValidateCommittedOptions = {}): CountryRowCounts {
  const dataDir = options.dataDir ?? join(process.cwd(), "src/data/scraped");
  const counts: CountryRowCounts = {};
  if (!existsSync(dataDir)) return counts;
  for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let total = 0;
    for (const file of readdirSync(join(dataDir, entry.name))) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      try {
        const route = JSON.parse(readFileSync(join(dataDir, entry.name, file), "utf-8")) as ScrapedRouteData;
        total += route.results?.length || 0;
      } catch {
        // An unparsable file is reported by validateCommittedTimetables; here
        // it simply contributes nothing to the count.
      }
    }
    counts[entry.name] = total;
  }
  return counts;
}

/** Group findings for a readable console report. */
export function summarizeFindings(findings: readonly ValidationFinding[]): Map<ValidationCheckId, ValidationFinding[]> {
  const grouped = new Map<ValidationCheckId, ValidationFinding[]>();
  for (const check of VALIDATION_CHECKS) {
    const matching = findings.filter((finding) => finding.check === check);
    if (matching.length > 0) grouped.set(check, matching);
  }
  return grouped;
}
