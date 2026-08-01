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
