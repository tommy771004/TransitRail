import type { Country, TimetableProvenance, TimetableTruthMode, TransitResult } from "../types";
import { providerDateValue } from "./countries";
import { getCountryCapability } from "./countryCapability";

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
export type TimetableSourceIssue = "malformed" | "empty" | "service_day_mismatch" | "stale_realtime" | "unknown_provenance";

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
}

/** "06:05" → 365. Undefined for anything that is not a HH:MM clock time. */
export function parseClockMinutes(time: string | undefined): number | undefined {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [hours, minutes] = time.split(":").map(Number);
  if (minutes > 59) return undefined;
  return hours * 60 + minutes;
}

const CURATED_SOURCE = /curated|snapshot/i;
const LLM_ADVISORY_SOURCE = /\b(?:llm|openrouter|ai)[-_ ]?(?:advisory|generated|gap(?:-| )?fill)?\b/i;
const OFFICIAL_SOURCE_LABELS = new Set([
  "official timetable",
  "ODPT timetable",
  "ODPT Tokyo Metro timetable",
  "ODPT Toei timetable (CC BY 4.0)",
  "JR Central official journey search",
  "SNCF Open Data GTFS",
  "gtfs.de Long Distance Rail Germany",
  "OpenTransportData Swiss GTFS Static",
  "Seoul Metro official timetable CSV",
  "Incheon Transit Corporation official timetable CSV",
]);
const OFFICIAL_SOURCE_URLS = new Set([
  "https://api.tfl.gov.uk",
  "https://api-v3.mbta.com",
  "https://api.entur.io/journey-planner/v3/graphql",
  "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php",
  "https://api.irail.be",
]);
const COUNTRY_VALUES = new Set<Country>([
  "japan", "korea", "hong_kong", "united_kingdom", "united_states", "singapore",
  "malaysia", "thailand", "germany", "france", "china", "switzerland", "belgium", "norway",
]);

/**
 * A curated snapshot is a representative service pattern, not a real
 * timetable. Keep this backstop compatible with the SEO page generator: an
 * explicit curated/snapshot source wins, otherwise four or more departures
 * with one fixed headway are treated as indicative.
 */
export function isIndicativeTimetable(source: string, results: TransitResult[]): boolean {
  if (
    CURATED_SOURCE.test(source)
    || LLM_ADVISORY_SOURCE.test(source)
    || results.some((result) => result.provenance === "llm-advisory")
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
  if (date === undefined) {
    const dates = [...new Set(snapshot.results.map((row) => row.date).filter(Boolean))];
    if (dates.length > 1) {
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

  // An advisory transfer value is never promoted to scraped/realtime merely
  // because its surrounding rows happen to carry an official-looking flag.
  if (snapshot.provenance === "llm-advisory" || rows.some((row) => row.provenance === "llm-advisory")) {
    return "indicative";
  }
  if (snapshot.provenance === "curated" || rows.some((row) => row.provenance === "curated")) {
    return "indicative";
  }

  const realtimeRows = rows.filter((result) => result.realtime === true);
  if (realtimeRows.length > 0) {
    if (date && realtimeRows.some((result) => isStaleRealtimeResult(result, date, options))) {
      return "stale_realtime";
    }
    return "realtime";
  }

  if (snapshot.provenance === "official") return "scraped";
  if (isIndicativeTimetable(snapshot.source || "", rows)) return "indicative";
  return "scraped";
}

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
  const source = snapshot.source?.trim() || "";
  if (OFFICIAL_SOURCE_LABELS.has(source) || OFFICIAL_SOURCE_URLS.has(source)) return "official";
  return "unknown";
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
    && value.source.trim().length > 0;
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
  if (snapshot.scrapedAt !== undefined && !Number.isFinite(Date.parse(snapshot.scrapedAt))) {
    return unusableSourceFact(serviceDay);
  }
  const exactRows = serviceDay ? timetableSliceForDate(snapshot, serviceDay) : snapshot.results;
  const canonicalRows = serviceDay
    ? snapshot.results.filter((result) => !(result.date || "").trim())
    : [];
  const candidateRows = serviceDay && exactRows.length === 0 ? canonicalRows : exactRows;
  const provenance = normalizedProvenance(snapshot, candidateRows);
  const useCanonical = exactRows.length === 0
    && canonicalRows.length > 0
    // A dateless snapshot is representative regardless of the operator label.
    // Known official provenance may describe where it came from, but it cannot
    // substantiate the passenger's requested service day without dated rows.
    && provenance !== "unknown";
  const selectedRows = useCanonical ? canonicalRows : exactRows;
  const selectedSnapshot = { ...snapshot, results: selectedRows };
  const isDatelessCanonical = selectedRows.length > 0 && selectedRows.every((result) => !result.date);
  const classifiedAuthenticity = classifyTimetable(
    selectedSnapshot,
    useCanonical ? undefined : serviceDay,
    options,
  );
  const authenticity = provenance === "unknown" && selectedRows.length > 0
    ? "none"
    : isDatelessCanonical ? "indicative"
    : classifiedAuthenticity;
  const sourceDates = [...new Set(selectedRows.map((result) => (result.date || "").trim()).filter(Boolean))];

  return {
    snapshot: selectedSnapshot,
    provenance,
    serviceDay,
    sourceServiceDay: sourceDates.length === 1 ? sourceDates[0] : undefined,
    authenticity,
    truthMode: truthModeFor(authenticity),
    issue: provenance === "unknown" && selectedRows.length > 0
      ? "unknown_provenance"
      : authenticity === "none"
        ? snapshot.results.length === 0 ? "empty" : "service_day_mismatch"
        : authenticity === "stale_realtime" ? "stale_realtime" : undefined,
  };
}
