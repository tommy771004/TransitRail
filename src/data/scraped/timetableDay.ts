import type { Country, JourneyLeg, TransitResult } from "../../types";
import { stationSearchKey } from "../stationKey";

export interface ScrapedRouteData {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function shiftTime(time: string | undefined, minutes: number): string | undefined {
  if (!time) return time;
  const parsed = parseTime(time);
  if (!Number.isFinite(parsed)) return time;
  return formatTime(parsed + minutes);
}

/**
 * When a multi-leg trip's top-level departure disagrees with the first leg
 * (common after template re-stamping), shift all leg times by the same offset.
 */
export function normalizeTransferLegTimes(result: TransitResult): TransitResult {
  if (result.direct || !result.legs || result.legs.length === 0) {
    return result;
  }

  const firstLegDeparture = result.legs[0].departureTime;
  if (!result.departureTime || !firstLegDeparture) {
    return result;
  }

  const topDeparture = parseTime(result.departureTime);
  const legDeparture = parseTime(firstLegDeparture);
  if (!Number.isFinite(topDeparture) || !Number.isFinite(legDeparture)) {
    return result;
  }

  const offset = topDeparture - legDeparture + (topDeparture < legDeparture ? 1440 : 0);
  if (offset === 0) {
    return result;
  }

  return {
    ...result,
    legs: result.legs.map((leg) => ({
      ...leg,
      departureTime: shiftTime(leg.departureTime, offset),
      arrivalTime: shiftTime(leg.arrivalTime, offset),
      upcomingDepartures: leg.upcomingDepartures?.map((time) => shiftTime(time, offset) || time),
    })),
  };
}

/** Coerce nested provider headsign objects to plain strings. */
export function normalizeHeadsigns(result: TransitResult): TransitResult {
  const asText = (value: unknown) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "name" in value && typeof (value as { name: unknown }).name === "string") {
      return (value as { name: string }).name;
    }
    return undefined;
  };
  return {
    ...result,
    headsign: asText(result.headsign),
    legs: result.legs?.map((leg) => ({ ...leg, headsign: asText(leg.headsign) })),
  };
}

/** Display-facing cleanup applied after route matching. */
export function normalizeResults(results: TransitResult[]): TransitResult[] {
  return results.map((result) => normalizeTransferLegTimes(normalizeHeadsigns(result)));
}

/**
 * Collapse multi-date copies of a timetable back to one dateless canonical day.
 * Result IDs are `${YYYY-MM-DD}-${baseId}`; stripping the date prefix finds the
 * same departure across scrape dates. Without this, re-saving snapshots multiplies rows.
 */
export function canonicalDay(results: TransitResult[]): TransitResult[] {
  const byBaseId = new Map<string, TransitResult>();
  for (const result of results) {
    const baseId = result.id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (byBaseId.has(baseId)) continue;
    const { date: _date, ...rest } = result;
    byBaseId.set(baseId, { ...rest, id: baseId });
  }
  return Array.from(byBaseId.values());
}

function resultsForDate(route: ScrapedRouteData, date?: string): TransitResult[] {
  if (!date) return route.results;
  const target = date.trim();
  return route.results.filter((result) => (result.date || "").trim() === target);
}

function reverseResult(result: TransitResult): TransitResult {
  const originalLegs = result.legs || [];
  const waits = originalLegs.slice(0, -1).map((leg, index) => {
    if (!leg.arrivalTime || !originalLegs[index + 1].departureTime) return 0;
    const arrival = parseTime(leg.arrivalTime);
    const departure = parseTime(originalLegs[index + 1].departureTime!);
    return departure - arrival + (departure < arrival ? 1440 : 0);
  }).reverse();
  let cursor = parseTime(result.departureTime);
  const reversedLegs = [...originalLegs].reverse().map((leg, index): JourneyLeg => {
    const duration = leg.durationMinutes
      ?? (leg.departureTime && leg.arrivalTime
        ? parseTime(leg.arrivalTime) - parseTime(leg.departureTime)
        : 0);
    const departureTime = formatTime(cursor);
    cursor += Math.max(0, duration);
    const arrivalTime = formatTime(cursor);
    cursor += waits[index] || 0;
    return {
      ...leg,
      origin: leg.destination,
      destination: leg.origin,
      departureTime,
      arrivalTime,
      platform: undefined,
      headsign: undefined,
    };
  });

  return {
    ...result,
    id: `rev-${result.id}`,
    origin: result.destination,
    destination: result.origin,
    stops: [...result.stops].reverse(),
    // Reverse timetable cannot safely reuse direction-specific fields.
    platform: undefined,
    headsign: undefined,
    legs: reversedLegs.length > 0 ? reversedLegs : undefined,
    transferStations: result.transferStations
      ? [...result.transferStations].reverse()
      : undefined,
  };
}

interface RouteEdge {
  route: ScrapedRouteData;
  from: string;
  to: string;
  reversed: boolean;
}

function resultsForEdge(edge: RouteEdge, date?: string): TransitResult[] {
  const results = resultsForDate(edge.route, date);
  return edge.reversed ? results.map(reverseResult) : results;
}

function findRoutePaths(
  routes: ScrapedRouteData[],
  origin: string,
  destination: string,
  date?: string,
): RouteEdge[][] {
  const edges: RouteEdge[] = routes
    .filter((route) => resultsForDate(route, date).length > 0)
    .flatMap((route) => [
      { route, from: route.origin, to: route.destination, reversed: false },
      { route, from: route.destination, to: route.origin, reversed: true },
    ]);
  const target = stationSearchKey(destination);
  const queue: Array<{ station: string; path: RouteEdge[]; visited: Set<string> }> = [{
    station: origin,
    path: [],
    visited: new Set([stationSearchKey(origin)]),
  }];
  const found: RouteEdge[][] = [];
  let shortestLength = Number.POSITIVE_INFINITY;

  while (queue.length > 0 && found.length < 5) {
    const current = queue.shift()!;
    if (current.path.length >= Math.min(shortestLength, 5)) continue;

    for (const edge of edges) {
      if (stationSearchKey(edge.from) !== stationSearchKey(current.station) || current.visited.has(stationSearchKey(edge.to))) continue;
      const path = [...current.path, edge];
      if (stationSearchKey(edge.to) === target) {
        shortestLength = path.length;
        found.push(path);
        continue;
      }
      if (path.length < 5) {
        queue.push({
          station: edge.to,
          path,
          visited: new Set([...current.visited, stationSearchKey(edge.to)]),
        });
      }
    }
  }

  return found.filter((path) => path.length === shortestLength);
}

function resultToLeg(result: TransitResult, source: string): JourneyLeg {
  return {
    lineName: result.service || source,
    origin: result.origin,
    destination: result.destination,
    departureTime: result.departureTime,
    arrivalTime: result.arrivalTime,
    durationMinutes: result.durationMinutes,
    stopCount: result.stops ? Math.max(0, result.stops.length - 1) : undefined,
    headsign: result.headsign,
    lineCode: result.service,
  };
}

function chainResults(
  routes: ScrapedRouteData[],
  origin: string,
  destination: string,
  date: string | undefined,
  country: Country | undefined,
): TransitResult[] {
  const chainResultsList: TransitResult[] = [];
  let chainId = 0;

  for (const path of findRoutePaths(routes, origin, destination, date)) {
    type PartialChain = { results: TransitResult[]; legs: JourneyLeg[] };
    let partials: PartialChain[] = resultsForEdge(path[0], date)
      .filter((result) => result.departureTime && result.arrivalTime)
      .slice(0, 100)
      .map((result) => ({
        results: [result],
        legs: [resultToLeg(result, path[0].route.source)],
      }));

    for (const edge of path.slice(1)) {
      const nextResults = resultsForEdge(edge, date)
        .filter((result) => result.departureTime && result.arrivalTime)
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
      const extended: PartialChain[] = [];

      for (const partial of partials) {
        const previous = partial.results[partial.results.length - 1];
        const previousArrival = parseTime(previous.arrivalTime!);
        const connections = nextResults
          .map((result) => {
            const departure = parseTime(result.departureTime);
            const wait = departure - previousArrival + (departure < previousArrival ? 1440 : 0);
            return { result, wait };
          })
          .filter(({ wait }) => wait >= 2 && wait <= 120)
          .slice(0, 2);

        for (const { result } of connections) {
          extended.push({
            results: [...partial.results, result],
            legs: [...partial.legs, resultToLeg(result, edge.route.source)],
          });
        }
      }
      partials = extended.slice(0, 200);
      if (partials.length === 0) break;
    }

    for (const partial of partials) {
      if (partial.results.length < 2) continue;
      const first = partial.results[0];
      const last = partial.results[partial.results.length - 1];
      const arrival = parseTime(last.arrivalTime!);
      const departure = parseTime(first.departureTime);
      const totalDuration = arrival - departure + (arrival < departure ? 1440 : 0);
      if (totalDuration <= 0) continue;
      const transferStations = partial.results.slice(0, -1).map((result) => result.destination);

      const resolvedCountry = country ?? first.country;
      chainResultsList.push({
        id: country ? `chain-${country}-${chainId++}` : `chain-${chainId++}`,
        country: resolvedCountry,
        date: first.date || last.date || date,
        operator: partial.results.map((result) => result.operator).join(" → "),
        service: partial.results.map((result) => result.service).join(" → "),
        departureTime: first.departureTime,
        arrivalTime: last.arrivalTime,
        durationMinutes: totalDuration,
        price: partial.results.every((result) => result.price != null)
          ? partial.results.reduce((sum, result) => sum + result.price!, 0)
          : undefined,
        currency: first.currency,
        origin: first.origin,
        destination: last.destination,
        direct: false,
        stops: [first.origin, ...transferStations, last.destination],
        legs: partial.legs,
        transferStations,
        tags: ["chain"],
      });
    }
  }

  chainResultsList.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  return chainResultsList.slice(0, 50);
}

/**
 * Find timetable results in an in-memory set of route snapshots.
 * Matching order: exact file O/D → result-level destination → reverse → chain.
 * Pass `country` so chained results get correct ids (`chain-${country}-n`) at construction.
 * Pure — no filesystem.
 */
export function findInRoutes(
  routes: ScrapedRouteData[],
  origin: string,
  destination: string,
  date?: string,
  country?: Country,
): TransitResult[] | null {
  if (!routes.length) return null;

  const oKey = stationSearchKey(origin);
  const dKey = stationSearchKey(destination);

  const exact = routes.find(
    (r) => stationSearchKey(r.origin) === oKey && stationSearchKey(r.destination) === dKey && resultsForDate(r, date).length > 0,
  );
  if (exact) {
    const results = resultsForDate(exact, date);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  // File origin matches, but destination is only on individual results
  // (mixed-destination snapshot files).
  const resultMatch = routes.find(
    (r) => stationSearchKey(r.origin) === oKey && resultsForDate(r, date).some((res) => stationSearchKey(res.destination) === dKey),
  );
  if (resultMatch) {
    const results = resultsForDate(resultMatch, date).filter((r) => stationSearchKey(r.destination) === dKey);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  const reverse = routes.find(
    (r) => stationSearchKey(r.origin) === dKey && stationSearchKey(r.destination) === oKey && resultsForDate(r, date).length > 0,
  );
  if (reverse) {
    const results = resultsForDate(reverse, date).map(reverseResult);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  const chained = chainResults(routes, origin, destination, date, country);
  if (chained.length > 0) return chained;

  return null;
}
