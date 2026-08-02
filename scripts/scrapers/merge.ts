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

/** How much a provenance claims, weakest first. */
const PROVENANCE_STRENGTH = ["unknown", "llm-advisory", "curated", "official"];

function provenanceRank(value: string | undefined): number {
  const index = PROVENANCE_STRENGTH.indexOf(value ?? "unknown");
  return index < 0 ? 0 : index;
}

/**
 * Which route's metadata should describe the merged file.
 *
 * One file holds several service days, but carries a single source and
 * provenance — so the last slice written decides what the whole file claims.
 * Two ways that goes wrong, both seen in practice:
 *
 * - An empty slice relabels the file. A live-only market emits one for every
 *   date its provider cannot speak for; letting it win rewrote the source and
 *   then failed the load-time provenance check, discarding the real rows the
 *   file still held for today.
 * - A weaker slice relabels the file. One rate-limited date falls back to the
 *   curated snapshot, and six days of genuine provider schedules are suddenly
 *   filed as `curated` — the file lies about data it really has.
 *
 * Keep the stronger description in both cases. The complete fix is per-row
 * provenance so a mixed file can describe itself honestly; until then, never
 * let one bad day speak for the good ones.
 */
export function describingRoute<T extends { results: readonly unknown[]; provenance?: string }>(
  existing: T | undefined,
  incoming: T,
  mergedRowCount: number,
): T {
  if (!existing || mergedRowCount === 0) return incoming;
  if (incoming.results.length === 0) return existing;
  return provenanceRank(incoming.provenance) < provenanceRank(existing.provenance) ? existing : incoming;
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
