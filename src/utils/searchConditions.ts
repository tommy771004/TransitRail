import { providerDateTimeValue } from "../data/countries";
import type { KoreaFilter, SearchParams, SortMode, TimeMode, TransitResult } from "../types";

export function searchTimeMode(params: Pick<SearchParams, "time" | "timeMode">): TimeMode {
  return params.timeMode ?? (params.time ? "specified" : "all_day");
}

/** Resolve once at submission; this snapshot also drives history and result copy. */
export function resolveSearchConditions(params: SearchParams, now = new Date()): SearchParams {
  const timeMode = searchTimeMode(params);
  if (timeMode === "now") {
    return { ...params, ...providerDateTimeValue(params.country, now, 0), timeMode };
  }
  if (timeMode === "specified" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(params.time ?? "")) {
    throw new Error("A specified departure time is required");
  }
  return { ...params, timeMode, time: timeMode === "all_day" ? undefined : params.time };
}

/** Keep absent values out of both the request and its offline cache key. */
export function searchQuery(params: SearchParams): string {
  return new URLSearchParams({
    origin: params.origin, destination: params.destination, country: params.country,
    date: params.date, ...(params.time ? { time: params.time } : {}),
  }).toString();
}

export function effectiveSortMode(sortMode: SortMode, koreaFilter: KoreaFilter): SortMode {
  return koreaFilter === "cheapest" ? "cheapest" : sortMode;
}

export function sortResults(results: TransitResult[], sortMode: SortMode, koreaFilter: KoreaFilter, timeMode: TimeMode) {
  const next = results.filter(trip =>
    (koreaFilter !== "direct" || trip.direct) &&
    (koreaFilter !== "first_class" || trip.seatClass === "first"));
  const mode = effectiveSortMode(sortMode, koreaFilter);
  const departure = (trip: TransitResult) => {
    // Provider service hours can extend past 24:00; do not wrap them to tomorrow's 00:00.
    const match = /^(\d{1,3}):([0-5]\d)$/.exec(trip.departureTime);
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
  };
  return next.sort((a, b) => {
    const chronological = departure(a) - departure(b);
    if (timeMode !== "all_day" && chronological) return chronological;
    if (mode === "earliest") return chronological;
    return mode === "cheapest"
      ? (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
      : (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER);
  });
}

export function nearestAvailableDate(date: string, offeredDates: readonly string[]): string | undefined {
  if (!offeredDates.length) return undefined;
  const target = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(target)) return offeredDates[0];
  return offeredDates.reduce((closest, candidate) =>
    Math.abs(Date.parse(`${candidate}T12:00:00Z`) - target) < Math.abs(Date.parse(`${closest}T12:00:00Z`) - target)
      ? candidate : closest);
}
