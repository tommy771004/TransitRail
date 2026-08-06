import type { Country, TimetableProvenance, TimetableTruthMode, TransitResult } from "../types";
import { providerDateValue } from "./countries";
import { getCountryCapability } from "./countryCapability";
import { isValidSourceMeta, type TimetableSourceMeta } from "./sourceRegistry";

export type { TimetableTruthMode } from "../types";

export type TimetableAuthenticity =
  | "scraped"
  | "realtime"
  | "indicative"
  | "stale_realtime"
  | "none";

/** Minimal route shape accepted by the authenticity oracle. */
export interface TimetableSnapshot {
  origin: string;
  destination: string;
  date?: string;
  scrapedAt?: string;
  source?: string;
  /** The registered source that produced these rows. Required to be verified. */
  sourceMeta?: TimetableSourceMeta;
  provenance?: TimetableProvenance;
  results: TransitResult[];
}

export interface TimetableAuthenticityOptions {
  /** Local provider date used when a realtime source is today-only. */
  today?: string;
  realtimeTodayOnly?: boolean;
  /** Adapter-owned route country used to reject cross-country provider rows. */
  expectedCountry?: Country;
}

/**
 * Options for classifying a **live provider response**, which is always about
 * now whatever the market: a response read today cannot describe another date.
 * Adapters use this rather than {@link authenticityOptionsFor}, because that one
 * relaxes the today-only rule for markets whose committed data is scheduled.
 */
export function providerResponseAuthenticityOptions(
  country: Country,
  now?: Date,
): TimetableAuthenticityOptions {
  return {
    realtimeTodayOnly: true,
    today: providerDateValue(country, now),
    expectedCountry: country,
  };
}

/**
 * Options implied by a country's own policy, for classifying **committed data**.
 * A live-only market's rows are valid for the provider's today and no other
 * date; elsewhere the only constraint is that the rows belong to this country.
 */
export function authenticityOptionsFor(
  country: Country,
  now?: Date,
): TimetableAuthenticityOptions {
  if (!getCountryCapability(country).liveOnly) return { expectedCountry: country };
  return providerResponseAuthenticityOptions(country, now);
}

export type NormalizedTimetableProvenance = TimetableProvenance | "unknown";
export type TimetableSourceIssue =
  | "malformed"
  | "empty"
  | "service_day_mismatch"
  | "stale_realtime"
  | "unknown_provenance"
  /** Rows exist but no registered official source vouches for them. */
  | "unverified_source";

/** Source facts consumed by the Searchability policy without re-reading raw metadata. */
export interface TimetableSourceFact {
  snapshot?: TimetableSnapshot;
  provenance: NormalizedTimetableProvenance;
  /** Passenger-requested service day, when one was supplied. */
  serviceDay?: string;
  /** Exact service day represented by the selected rows; absent for a canonical snapshot. */
  sourceServiceDay?: string;
  authenticity: TimetableAuthenticity;
  truthMode: TimetableTruthMode;
  issue?: TimetableSourceIssue;
}

export interface CompleteTimetableSnapshot extends TimetableSnapshot {
  date: string;
  scrapedAt: string;
  source: string;
  sourceMeta: TimetableSourceMeta;
}

/** "06:05" → 365. Undefined for anything that is not a HH:MM clock time. */
export function parseClockMinutes(time: string | undefined): number | undefined {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [hours, minutes] = time.split(":").map(Number);
  if (minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * Markers left by the retired curated/LLM pipeline.
 *
 * Nothing in TransitRail produces either any more, so these exist only to
 * recognise a legacy file still sitting on disk (or restored from history) and
 * refuse it. Recognising a marker is a rejection, never a classification: a row
 * carrying one is unusable, not a weaker kind of timetable.
 */
const CURATED_SOURCE = /curated|snapshot/i;
const LLM_ADVISORY_SOURCE = /\b(?:llm|openrouter|ai)[-_ ]?(?:advisory|generated|gap(?:-| )?fill)?\b/i;
const COUNTRY_VALUES = new Set<Country>([
  "japan", "korea", "hong_kong", "united_kingdom", "united_states", "singapore",
  "malaysia", "thailand", "germany", "france", "china", "switzerland", "belgium", "norway",
]);

/**
 * Does this look like a timetable someone generated from a headway rather than
 * read from a source?
 *
 * Two independent tells: an explicit curated/LLM marker, or a departure list
 * whose every gap is identical. The second is the one that catches a synthetic
 * timetable nobody labelled — a real operator varies its interval across the
 * peak, the shoulder, and the last hour of service, so a run of four or more
 * departures at one exact spacing is a generator's signature.
 *
 * This is a detector for validation and publication gates, not a
 * classification: nothing it flags is publishable at any confidence.
 */
export function isSyntheticTimetable(source: string, results: TransitResult[]): boolean {
  if (
    CURATED_SOURCE.test(source)
    || LLM_ADVISORY_SOURCE.test(source)
    || results.some((result) => result.provenance === "llm-advisory" || result.provenance === "curated")
  ) return true;
  const minutes = results
    .map((result) => parseClockMinutes(result.departureTime))
    .filter((minutes): minutes is number => minutes !== undefined)
    .sort((a, b) => a - b);
  if (minutes.length < 4) return false;
  const gaps = new Set<number>();
  for (let index = 1; index < minutes.length; index += 1) {
    gaps.add(minutes[index] - minutes[index - 1]);
  }
  return gaps.size === 1;
}

/** Return the rows belonging to one service date without mutating the route. */
export function timetableSliceForDate(
  snapshot: Pick<TimetableSnapshot, "results">,
  date?: string,
): TransitResult[] {
  if (!date) return snapshot.results;
  const target = date.trim();
  return snapshot.results.filter((result) => (result.date || "").trim() === target);
}

function embeddedTimestampDate(id: string): string | undefined {
  // TfL uses ISO timestamps in its journey IDs; MTR uses the same timestamp
  // with a space separator. Both are provider timestamps, so accept either
  // without relaxing the fail-closed rule for IDs that carry no time at all.
  return id.match(/(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}:\d{2}/)?.[1];
}

/**
 * A realtime result is valid only for the date encoded in its provider
 * timestamp. If the timestamp is absent, fail closed rather than claiming
 * that a live row is valid for a different service day.
 */
export function isStaleRealtimeResult(
  result: TransitResult,
  date: string,
  options: TimetableAuthenticityOptions = {},
): boolean {
  if (result.realtime !== true) return false;
  if (options.realtimeTodayOnly && options.today && options.today !== date) return true;
  const embeddedDate = embeddedTimestampDate(result.id);
  if (options.realtimeTodayOnly && options.today === date && !embeddedDate) return false;
  // Some official providers expose the requested service day as a field but
  // do not embed a timestamp in the prediction id. An explicit matching row
  // date is sufficient; an undated row remains fail-closed below.
  if (!embeddedDate) return result.date !== date;
  return embeddedDate !== date;
}

/** A route is trustworthy for endpoint/date visibility only in these classes. */
export function isVerifiableTimetable(
  authenticity: TimetableAuthenticity,
): authenticity is "scraped" | "realtime" {
  return authenticity === "scraped" || authenticity === "realtime";
}

/**
 * How much a class is willing to claim, weakest first. Used to summarize a file
 * that spans several service days: the summary may never claim more than its
 * weakest day does.
 */
const AUTHENTICITY_CONFIDENCE: TimetableAuthenticity[] = [
  "stale_realtime",
  "indicative",
  "realtime",
  "scraped",
];

export function classifyTimetable(
  snapshot: TimetableSnapshot,
  date?: string,
  options: TimetableAuthenticityOptions = {},
): TimetableAuthenticity {
  // A whole-file verdict over several service days is only honest if it is the
  // weakest of them. Classifying every row at once let four live rows valid for
  // today label a file as `realtime` when its other six days were curated —
  // and anything reading the file-level label then believed all seven.
  //
  // A single-dated file goes through the same path rather than being classified
  // dateless: a live row is only valid for the day it names, and skipping the
  // recursion for one date let a caller with no service day in hand read a
  // day-old prediction as current.
  if (date === undefined) {
    const dates = [...new Set(snapshot.results.map((row) => row.date).filter(Boolean))];
    if (dates.length >= 1) {
      let weakest: TimetableAuthenticity | undefined;
      for (const day of dates) {
        const dayClass = classifyTimetable(snapshot, day, options);
        if (dayClass === "none") continue;
        if (
          weakest === undefined
          || AUTHENTICITY_CONFIDENCE.indexOf(dayClass) < AUTHENTICITY_CONFIDENCE.indexOf(weakest)
        ) weakest = dayClass;
      }
      if (weakest !== undefined) return weakest;
    }
  }

  const rows = timetableSliceForDate(snapshot, date);
  if (rows.length === 0) return "none";

  // Curated and AI-advisory rows are no longer produced anywhere. Finding one
  // means a legacy or hand-edited file, and there is no confidence at which it
  // may be shown, so it fails outright rather than degrading to "indicative".
  if (
    snapshot.provenance === "llm-advisory" || snapshot.provenance === "curated"
    || rows.some((row) => row.provenance === "llm-advisory" || row.provenance === "curated")
  ) return "none";

  // The single gate: a registered official source read these rows. A route
  // cannot vouch for itself with a `provenance: "official"` field or an
  // official-sounding `source` label — both used to be enough, and both are
  // things a file says about itself rather than facts about where it came from.
  if (!isValidSourceMeta(snapshot.sourceMeta)) return "none";

  const realtimeRows = rows.filter((result) => result.realtime === true);
  if (realtimeRows.length > 0) {
    if (date && realtimeRows.some((result) => isStaleRealtimeResult(result, date, options))) {
      return "stale_realtime";
    }
    return "realtime";
  }

  return "scraped";
}

/**
 * Name where a route came from.
 *
 * Retired-pipeline markers are checked first so that a legacy curated file
 * cannot be laundered into `official` by bolting a valid source block onto it.
 */
function normalizedProvenance(snapshot: TimetableSnapshot, rows = snapshot.results): NormalizedTimetableProvenance {
  if (
    snapshot.provenance === "llm-advisory"
    || rows.some((result) => result.provenance === "llm-advisory")
    || LLM_ADVISORY_SOURCE.test(snapshot.source || "")
  ) return "llm-advisory";
  if (
    snapshot.provenance === "curated"
    || rows.some((result) => result.provenance === "curated")
    || CURATED_SOURCE.test(snapshot.source || "")
  ) return "curated";
  return isValidSourceMeta(snapshot.sourceMeta) ? "official" : "unknown";
}

export function truthModeFor(authenticity: TimetableAuthenticity): TimetableTruthMode {
  if (authenticity === "scraped" || authenticity === "realtime") return "verified";
  if (authenticity === "indicative") return "indicative";
  if (authenticity === "stale_realtime") return "stale";
  return "unusable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));
}

function isJourneyLeg(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.lineName !== "string"
    || typeof value.origin !== "string"
    || typeof value.destination !== "string"
  ) return false;
  const optionalStrings = ["lineCode", "color", "mode", "platform", "headsign"];
  if (optionalStrings.some((key) => !isOptionalString(value[key]))) return false;
  for (const key of ["departureTime", "arrivalTime"]) {
    const time = value[key];
    if (time !== undefined && time !== null && (typeof time !== "string" || parseClockMinutes(time) === undefined)) return false;
  }
  const optionalNumbers = ["originLat", "originLng", "destLat", "destLng", "durationMinutes", "stopCount", "delayMinutes"];
  if (optionalNumbers.some((key) => !isOptionalNumber(value[key]))) return false;
  const upcomingDepartures = value.upcomingDepartures;
  return (value.stops === undefined || isStringArray(value.stops))
    && (upcomingDepartures === undefined || upcomingDepartures === null
      || (Array.isArray(upcomingDepartures)
        && upcomingDepartures.every((time) => typeof time === "string" && parseClockMinutes(time) !== undefined)));
}

function unusableSourceFact(
  serviceDay: string | undefined,
  issue: TimetableSourceFact["issue"] = "malformed",
): TimetableSourceFact {
  return {
    provenance: "unknown",
    serviceDay,
    authenticity: "none",
    truthMode: "unusable",
    issue,
  };
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimetableResult(value: unknown): value is TransitResult {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string"
    || typeof value.country !== "string"
    || !COUNTRY_VALUES.has(value.country as Country)
    || typeof value.operator !== "string"
    || typeof value.service !== "string"
    || typeof value.departureTime !== "string"
    || typeof value.origin !== "string"
    || typeof value.destination !== "string"
    || typeof value.direct !== "boolean"
    || !Array.isArray(value.stops)
    || value.stops.some((stop) => typeof stop !== "string")
  ) return false;
  const departureTime = value.departureTime;
  const arrivalTime = value.arrivalTime;
  const resultDate = value.date;
  if (typeof departureTime !== "string" || parseClockMinutes(departureTime) === undefined) return false;
  if (arrivalTime !== undefined && arrivalTime !== null && (typeof arrivalTime !== "string" || parseClockMinutes(arrivalTime) === undefined)) return false;
  if (resultDate !== undefined && typeof resultDate !== "string") return false;
  if (typeof resultDate === "string" && !isIsoCalendarDate(resultDate)) return false;
  if (value.realtime !== undefined && typeof value.realtime !== "boolean") return false;
  const optionalStrings = ["trainType", "currency", "platform", "headsign", "warning", "lineColor"];
  if (optionalStrings.some((key) => !isOptionalString(value[key]))) return false;
  const optionalNumbers = ["durationMinutes", "originLat", "originLng", "destLat", "destLng", "price", "delayMinutes"];
  if (optionalNumbers.some((key) => !isOptionalNumber(value[key]))) return false;
  if (value.seatClass !== undefined && value.seatClass !== null
    && value.seatClass !== "reserved" && value.seatClass !== "economy" && value.seatClass !== "first") return false;
  if (value.amenities !== undefined && !isStringArray(value.amenities)) return false;
  if (value.tags !== undefined && !isStringArray(value.tags)) return false;
  if (value.legs !== undefined && (!Array.isArray(value.legs) || !value.legs.every(isJourneyLeg))) return false;
  if (value.transferStations !== undefined && !isStringArray(value.transferStations)) return false;
  if (
    value.provenance !== undefined
    && value.provenance !== "official"
    && value.provenance !== "curated"
    && value.provenance !== "llm-advisory"
  ) return false;
  return true;
}

function isTimetableSnapshot(value: unknown): value is TimetableSnapshot {
  if (!isRecord(value)) return false;
  if (typeof value.origin !== "string" || typeof value.destination !== "string") return false;
  if (value.source !== undefined && typeof value.source !== "string") return false;
  if (value.date !== undefined && typeof value.date !== "string") return false;
  if (value.scrapedAt !== undefined && typeof value.scrapedAt !== "string") return false;
  if (
    value.provenance !== undefined
    && value.provenance !== "official"
    && value.provenance !== "curated"
    && value.provenance !== "llm-advisory"
  ) return false;
  // A malformed block is a corrupt file, not merely an unverified one — the
  // difference matters because "malformed" is reported separately from
  // "nobody vouches for this". An absent block is the latter, handled by
  // classification rather than rejected as unparseable here.
  if (value.sourceMeta !== undefined && !isValidSourceMeta(value.sourceMeta)) return false;
  return Array.isArray(value.results) && value.results.every(isTimetableResult);
}

/**
 * Stamp a route with the provenance verdict its source fact carries.
 *
 * Every consumer of {@link normalizeTimetableSource} needs the same five fields
 * copied onto whatever it hands back, including the `"unknown"` → `undefined`
 * narrowing that keeps an unrecognised provenance off the wire. Keeping that in
 * one place stops the copies from drifting apart field by field.
 */
export function applySourceFact<T extends object>(
  route: T,
  fact: TimetableSourceFact,
): T & {
  provenance: TimetableProvenance | undefined;
  authenticity: TimetableAuthenticity;
  truthMode: TimetableTruthMode;
  sourceServiceDay: string | undefined;
  sourceIssue: TimetableSourceIssue | undefined;
} {
  return {
    ...route,
    provenance: fact.provenance === "unknown" ? undefined : fact.provenance,
    authenticity: fact.authenticity,
    truthMode: fact.truthMode,
    sourceServiceDay: fact.sourceServiceDay,
    sourceIssue: fact.issue,
  };
}

export function isCompleteTimetableSnapshot(value: TimetableSnapshot): value is CompleteTimetableSnapshot {
  return typeof value.date === "string"
    && typeof value.scrapedAt === "string"
    && Number.isFinite(Date.parse(value.scrapedAt))
    && typeof value.source === "string"
    && value.source.trim().length > 0
    && isValidSourceMeta(value.sourceMeta);
}

/**
 * Normalize one route source into facts without promoting a dateless canonical
 * snapshot into an exact service-day timetable.
 */
export function normalizeTimetableSource(
  value: unknown,
  date?: string,
  options: TimetableAuthenticityOptions = {},
): TimetableSourceFact {
  const serviceDay = date?.trim() || undefined;
  if (serviceDay && !isIsoCalendarDate(serviceDay)) {
    return unusableSourceFact(serviceDay);
  }
  if (!isTimetableSnapshot(value)) {
    return unusableSourceFact(serviceDay);
  }
  const snapshot = value;
  if (options.expectedCountry && snapshot.results.some((result) => result.country !== options.expectedCountry)) {
    return unusableSourceFact(serviceDay);
  }
  // The source block must belong to the country whose data this is. Without
  // this, a France file's rows could be vouched for by Germany's GTFS feed:
  // both blocks are individually valid, and the mismatch is only visible when
  // the two are compared.
  if (
    options.expectedCountry
    && snapshot.sourceMeta !== undefined
    && snapshot.sourceMeta.country !== options.expectedCountry
  ) {
    return unusableSourceFact(serviceDay);
  }
  if (snapshot.scrapedAt !== undefined && !Number.isFinite(Date.parse(snapshot.scrapedAt))) {
    return unusableSourceFact(serviceDay);
  }
  // Only rows carrying the passenger's exact service day may answer for it. A
  // dateless "canonical day" used to stand in when the exact day was missing,
  // which is how one representative timetable came to answer for seven dates.
  // Nothing writes dateless rows any more, and none are accepted here.
  const selectedRows = timetableSliceForDate(snapshot, serviceDay);
  const provenance = normalizedProvenance(snapshot, selectedRows);
  const selectedSnapshot = { ...snapshot, results: selectedRows };
  const authenticity = classifyTimetable(selectedSnapshot, serviceDay, options);
  const sourceDates = [...new Set(selectedRows.map((result) => (result.date || "").trim()).filter(Boolean))];

  return {
    snapshot: selectedSnapshot,
    provenance,
    serviceDay,
    sourceServiceDay: sourceDates.length === 1 ? sourceDates[0] : undefined,
    authenticity,
    truthMode: truthModeFor(authenticity),
    issue: sourceIssueFor(snapshot, selectedRows, provenance, authenticity),
  };
}

/**
 * Say why a route could not answer, distinguishing the three failures a reader
 * would otherwise conflate: nothing came back, something came back for a
 * different day, and something came back that nobody official vouches for.
 */
function sourceIssueFor(
  snapshot: TimetableSnapshot,
  selectedRows: TransitResult[],
  provenance: NormalizedTimetableProvenance,
  authenticity: TimetableAuthenticity,
): TimetableSourceFact["issue"] {
  if (authenticity === "stale_realtime") return "stale_realtime";
  if (authenticity !== "none") return undefined;
  if (snapshot.results.length === 0) return "empty";
  if (selectedRows.length === 0) return "service_day_mismatch";
  if (provenance === "curated" || provenance === "llm-advisory") return "unverified_source";
  return provenance === "unknown" ? "unknown_provenance" : "unverified_source";
}
