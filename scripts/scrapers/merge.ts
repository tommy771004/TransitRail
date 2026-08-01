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

/** A live next-train response must not replace a much fuller day snapshot. */
export function isSparseLiveSlice(
  existing: readonly TransitResult[],
  incoming: readonly TransitResult[],
): boolean {
  if (existing.length < 8 || incoming.length === 0) return false;
  if (!incoming.some((result) => result.realtime === true)) return false;
  return incoming.length * 2 < existing.length;
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
