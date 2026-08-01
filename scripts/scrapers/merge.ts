import type { TransitResult } from "../../src/types";

/**
 * Provider APIs occasionally repeat one trip across pages or included
 * resources. Keep the first complete row and never let duplicate rows inflate
 * a service-day slice.
 */
export function dedupeScrapedResults(results: TransitResult[]): TransitResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [
      result.date || "",
      result.operator,
      result.origin,
      result.destination,
      result.service,
      result.departureTime,
      result.arrivalTime || "",
      result.headsign || "",
    ].join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Below this many existing rows a slice is too thin to be worth protecting —
 * a live response replacing it loses nothing a passenger could have used.
 */
const PROTECTED_SLICE_MIN_ROWS = 8;

/**
 * A live response is treated as sparse when the existing slice is at least this
 * many times larger. Two means "the live rows cover under half the day we
 * already had", which is what a next-train feed looks like next to a timetable.
 */
const SPARSE_LIVE_SLICE_RATIO = 2;

/** A live next-train response must not replace a much fuller day snapshot. */
export function isSparseLiveSlice(
  existing: readonly TransitResult[],
  incoming: readonly TransitResult[],
): boolean {
  if (existing.length < PROTECTED_SLICE_MIN_ROWS || incoming.length === 0) return false;
  if (!incoming.some((result) => result.realtime === true)) return false;
  return incoming.length * SPARSE_LIVE_SLICE_RATIO < existing.length;
}

/**
 * Which route's metadata should describe the merged file.
 *
 * A slice that contributed no rows must not relabel the file. A live-only
 * market emits an empty day for every date its provider cannot speak for, and
 * letting that slice win rewrote the file's source and provenance — which then
 * failed the load-time provenance check and threw away the real rows the file
 * still held for today.
 */
export function describingRoute<T extends { results: readonly unknown[] }>(
  existing: T | undefined,
  incoming: T,
  mergedRowCount: number,
): T {
  return incoming.results.length === 0 && mergedRowCount > 0 && existing ? existing : incoming;
}

export function replaceDateSlice(
  existing: readonly TransitResult[],
  incoming: readonly TransitResult[],
): { results: TransitResult[]; preservedExisting: boolean } {
  const dedupedExisting = dedupeScrapedResults([...existing]);
  const dedupedIncoming = dedupeScrapedResults([...incoming]);
  if (isSparseLiveSlice(dedupedExisting, dedupedIncoming)) {
    return { results: dedupedExisting, preservedExisting: true };
  }
  return { results: dedupedIncoming, preservedExisting: false };
}
