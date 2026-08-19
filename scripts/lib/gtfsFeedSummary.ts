/**
 * What a GTFS feed says its lines and stations are, in the feed's own spelling.
 *
 * Adding a GTFS-backed market needs three constants that only the feed can
 * supply: which lines it publishes, each line's two terminals, and the exact
 * `stop_name` strings — a route list written from a station's Wikipedia title
 * matches nothing, because `collectGtfsJourneys` looks stops up by the name the
 * operator filed. This module derives all three from a parsed feed so the
 * scrape list is transcribed rather than guessed.
 *
 * Kept pure and separate from the CLI so it can be tested against the in-memory
 * zip fixture instead of a live download.
 */
import { forEachGtfsCsvRow, type GtfsFeed } from "../../src/server/gtfs/feed";

export type GtfsRouteSummary = {
  routeId: string;
  /** Display name, preferring the operator's own short name. */
  name: string;
  routeType?: number;
  tripCount: number;
  /** Most-served first and last stop, by the feed's `stop_name`. */
  terminals?: [string, string];
  /** Ordered stop names of the route's longest trip. */
  stops: string[];
};

/**
 * Whether a `route_type` runs on rails.
 *
 * Both vocabularies count. The basic one is 0/1/2 plus the cable family, but
 * European feeds publish the extended codes instead — SNCF files its TGV as
 * 101 and its TER as 106 — so a rail filter written against the basic set
 * alone drops exactly the operators most likely to be worth adding.
 */
export function isGtfsRailRouteType(routeType: number | undefined): boolean {
  if (routeType === undefined) return true;
  if ([0, 1, 2, 5, 7, 12].includes(routeType)) return true;
  return (routeType >= 100 && routeType <= 117)
    || (routeType >= 400 && routeType <= 405)
    || (routeType >= 900 && routeType <= 906)
    || routeType === 1400;
}

const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: "tram",
  1: "subway",
  2: "rail",
  3: "bus",
  4: "ferry",
  5: "cable tram",
  6: "aerial lift",
  7: "funicular",
  11: "trolleybus",
  12: "monorail",
};

export function gtfsRouteTypeLabel(routeType: number | undefined): string {
  if (routeType === undefined) return "unknown";
  return ROUTE_TYPE_LABELS[routeType] || `type ${routeType}`;
}

type TripEnds = { routeId: string; first?: { sequence: number; stopId: string }; last?: { sequence: number; stopId: string }; stopCount: number };

function tripEnds(feed: GtfsFeed): Map<string, TripEnds> {
  const byTrip = new Map<string, TripEnds>();
  forEachGtfsCsvRow(feed.stopTimes, (row) => {
    const trip = feed.trips.get(row.trip_id);
    if (!trip?.routeId) return;
    const sequence = Number(row.stop_sequence);
    if (!Number.isFinite(sequence) || !row.stop_id) return;
    const current = byTrip.get(row.trip_id) || { routeId: trip.routeId, stopCount: 0 };
    if (!current.first || sequence < current.first.sequence) current.first = { sequence, stopId: row.stop_id };
    if (!current.last || sequence > current.last.sequence) current.last = { sequence, stopId: row.stop_id };
    current.stopCount += 1;
    byTrip.set(row.trip_id, current);
  });
  return byTrip;
}

function mostCommon(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * One summary per route the feed publishes, longest-first within a route type.
 *
 * Two passes over `stop_times.txt`: the first counts trips and terminals, the
 * second reads back the calling pattern of the one trip chosen to represent
 * each route. A nationwide feed is too large to hold every trip's stop list at
 * once, and the representative trip is not known until the first pass ends.
 */
export function summarizeGtfsRoutes(feed: GtfsFeed): GtfsRouteSummary[] {
  const stopNames = new Map(feed.stops.map((stop) => [stop.id, stop.name]));
  const ends = tripEnds(feed);

  type RouteTally = {
    tripCount: number;
    firsts: Map<string, number>;
    lasts: Map<string, number>;
    longestTripId?: string;
    longestStopCount: number;
  };
  const perRoute = new Map<string, RouteTally>();
  for (const [tripId, trip] of ends) {
    const entry: RouteTally = perRoute.get(trip.routeId)
      || { tripCount: 0, firsts: new Map(), lasts: new Map(), longestStopCount: 0 };
    entry.tripCount += 1;
    const first = trip.first && stopNames.get(trip.first.stopId);
    const last = trip.last && stopNames.get(trip.last.stopId);
    if (first) entry.firsts.set(first, (entry.firsts.get(first) || 0) + 1);
    if (last) entry.lasts.set(last, (entry.lasts.get(last) || 0) + 1);
    if (trip.stopCount > entry.longestStopCount) {
      entry.longestStopCount = trip.stopCount;
      entry.longestTripId = tripId;
    }
    perRoute.set(trip.routeId, entry);
  }

  const wanted = new Map<string, string>();
  for (const [routeId, entry] of perRoute) {
    if (entry.longestTripId) wanted.set(entry.longestTripId, routeId);
  }
  const calling = new Map<string, Array<{ sequence: number; stopId: string }>>();
  forEachGtfsCsvRow(feed.stopTimes, (row) => {
    if (!wanted.has(row.trip_id)) return;
    const sequence = Number(row.stop_sequence);
    if (!Number.isFinite(sequence) || !row.stop_id) return;
    const path = calling.get(row.trip_id) || [];
    path.push({ sequence, stopId: row.stop_id });
    calling.set(row.trip_id, path);
  });

  const summaries: GtfsRouteSummary[] = [];
  for (const [routeId, entry] of perRoute) {
    const route = feed.routes.get(routeId);
    const first = mostCommon(entry.firsts);
    const last = mostCommon(entry.lasts);
    const path = entry.longestTripId ? calling.get(entry.longestTripId) || [] : [];
    summaries.push({
      routeId,
      name: route?.shortName?.trim() || route?.longName?.trim() || routeId,
      routeType: route?.routeType,
      tripCount: entry.tripCount,
      terminals: first && last ? [first, last] : undefined,
      stops: [...path]
        .sort((left, right) => left.sequence - right.sequence)
        .map((stop) => stopNames.get(stop.stopId))
        .filter((name): name is string => Boolean(name)),
    });
  }
  return summaries.sort((left, right) => right.stops.length - left.stops.length);
}

/** The `routes.ts` entries a feed's rail lines imply, both directions. */
export function scrapeRoutePairs(
  summaries: readonly GtfsRouteSummary[],
): Array<{ origin: string; destination: string }> {
  const pairs = new Map<string, { origin: string; destination: string }>();
  for (const summary of summaries) {
    if (!isGtfsRailRouteType(summary.routeType)) continue;
    const [origin, destination] = summary.terminals || [];
    if (!origin || !destination || origin === destination) continue;
    pairs.set(`${origin}→${destination}`, { origin, destination });
    pairs.set(`${destination}→${origin}`, { origin: destination, destination: origin });
  }
  return [...pairs.values()];
}
