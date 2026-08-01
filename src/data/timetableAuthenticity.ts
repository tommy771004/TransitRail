import type { TimetableProvenance, TransitResult } from "../types";

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
}

export type TimetableTruthMode = "verified" | "indicative" | "stale" | "unusable";
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
  return embeddedDate !== date;
}

/** A route is trustworthy for endpoint/date visibility only in these classes. */
export function isVerifiableTimetable(
  authenticity: TimetableAuthenticity,
): authenticity is "scraped" | "realtime" {
  return authenticity === "scraped" || authenticity === "realtime";
}

export function classifyTimetable(
  snapshot: TimetableSnapshot,
  date?: string,
  options: TimetableAuthenticityOptions = {},
): TimetableAuthenticity {
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

  if (isIndicativeTimetable(snapshot.source || "", rows)) return "indicative";
  return "scraped";
}

function normalizedProvenance(snapshot: TimetableSnapshot): NormalizedTimetableProvenance {
  if (
    snapshot.provenance === "llm-advisory"
    || snapshot.results.some((result) => result.provenance === "llm-advisory")
    || LLM_ADVISORY_SOURCE.test(snapshot.source || "")
  ) return "llm-advisory";
  if (
    snapshot.provenance === "curated"
    || snapshot.results.some((result) => result.provenance === "curated")
    || CURATED_SOURCE.test(snapshot.source || "")
  ) return "curated";
  if (snapshot.provenance === "official" || (snapshot.source || "").trim()) return "official";
  return "unknown";
}

function truthModeFor(authenticity: TimetableAuthenticity): TimetableTruthMode {
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
  const optionalNumbers = ["originLat", "originLng", "destLat", "destLng", "durationMinutes", "stopCount"];
  if (optionalNumbers.some((key) => !isOptionalNumber(value[key]))) return false;
  return (value.stops === undefined || isStringArray(value.stops))
    && (value.upcomingDepartures === undefined || isStringArray(value.upcomingDepartures));
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
  if (snapshot.scrapedAt !== undefined && !Number.isFinite(Date.parse(snapshot.scrapedAt))) {
    return unusableSourceFact(serviceDay);
  }
  const exactRows = serviceDay ? timetableSliceForDate(snapshot, serviceDay) : snapshot.results;
  const canonicalRows = serviceDay
    ? snapshot.results.filter((result) => !(result.date || "").trim())
    : [];
  const provenance = normalizedProvenance(snapshot);
  const useCanonical = exactRows.length === 0
    && canonicalRows.length > 0
    && (provenance === "curated" || provenance === "llm-advisory");
  const selectedRows = useCanonical ? canonicalRows : exactRows;
  const selectedSnapshot = { ...snapshot, results: selectedRows };
  const classifiedAuthenticity = classifyTimetable(
    selectedSnapshot,
    useCanonical ? undefined : serviceDay,
    options,
  );
  const authenticity = provenance === "unknown" && selectedRows.length > 0
    ? "none"
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
