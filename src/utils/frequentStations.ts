import type { Country, FavoriteRoute, SearchHistoryItem } from "../types";

const FAVORITE_WEIGHT = 3;
const PINNED_WEIGHT = 2;
const HISTORY_WEIGHT = 1;

/**
 * The stations a rider keeps coming back to in one market, most used first.
 *
 * Both ends of every favourite route and past search count; a favourite or a
 * pinned search counts for more than a one-off. Ties keep the order the station
 * was first met — favourites, then history newest first — so the row is stable
 * between renders. Names stay the raw provider names: they are query identity,
 * and the caller labels them for display.
 */
export function frequentStations(
  history: SearchHistoryItem[],
  favorites: FavoriteRoute[],
  country: Country,
  limit = 6,
): string[] {
  const scores = new Map<string, number>();
  const add = (station: string | undefined, weight: number) => {
    const name = station?.trim();
    if (!name) return;
    scores.set(name, (scores.get(name) ?? 0) + weight);
  };

  for (const route of favorites) {
    if (route.country !== country) continue;
    add(route.origin, FAVORITE_WEIGHT);
    add(route.destination, FAVORITE_WEIGHT);
  }
  for (const item of history) {
    if (item.country !== country) continue;
    const weight = item.pinned ? PINNED_WEIGHT : HISTORY_WEIGHT;
    add(item.origin, weight);
    add(item.destination, weight);
  }

  // Map keeps insertion order and Array.prototype.sort is stable, so equal
  // scores stay in first-met order.
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}
