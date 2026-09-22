// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: A short-lived cache in front of the transit search: one identical query
// in flight at a time, and a successful answer reused for a few seconds, so a double
// tap or two passengers on the same route cost the provider one call.

import { createPromiseCache } from "../utils/requestCache";
import type { TransitSearchInput, TransitSearchResult } from "./transitSearch";

/**
 * Short on purpose: live markets (MTR next trains, TfL, iRail) move minute to
 * minute, and a passenger who re-runs a search half a minute later should see
 * the provider's current answer. A miss or a provider failure is never kept.
 */
export const SEARCH_CACHE_TTL_MS = 30_000;

const cache = createPromiseCache<TransitSearchResult>(SEARCH_CACHE_TTL_MS);

export function searchCacheKey(input: TransitSearchInput): string {
  return JSON.stringify([input.country ?? "", input.origin, input.destination, input.date, input.time ?? ""]);
}

/** Run `search` for `input`, sharing and briefly reusing a successful answer. */
export async function cachedTransitSearch(
  input: TransitSearchInput,
  search: (input: TransitSearchInput) => Promise<TransitSearchResult>,
): Promise<TransitSearchResult> {
  const key = searchCacheKey(input);
  const result = await cache.get(key, () => search(input));
  const reusable = result.statusCode >= 200 && result.statusCode < 300 && result.payload.results.length > 0;
  if (!reusable) cache.clear(key);
  return result;
}

export const resetSearchResponseCache = () => cache.clear();

// --- End of searchResponseCache.ts ---
