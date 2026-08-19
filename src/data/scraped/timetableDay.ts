import type { Country, JourneyLeg, TimetableProvenance, TransitResult } from "../../types";
import type { TimetableAuthenticity, TimetableSourceIssue, TimetableTruthMode } from "../timetableAuthenticity";
import type { TimetableSourceMeta } from "../sourceRegistry";
import { stationSearchKey } from "../stationKey";
import { resolveStationAlias } from "../stationAliases";
import {
  aggregateTransferFare,
  getMinimumTransferMinutes,
  sameOperatorFareWarning,
} from "../transferRules";

export interface ScrapedRouteData {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  /**
   * Which registered official source produced these rows, and when it was read.
   *
   * This — not the free-text `source` label — is what makes a route verifiable.
   * A file without a valid block is treated as unverified data whatever it says
   * about itself; see {@link ../sourceRegistry}.
   */
  sourceMeta?: TimetableSourceMeta;
  provenance?: TimetableProvenance;
  authenticity?: TimetableAuthenticity;
  truthMode?: TimetableTruthMode;
  sourceServiceDay?: string;
  sourceIssue?: TimetableSourceIssue;
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
    realtime: false,
    warning: [
      result.warning,
      "Reverse timetable times are estimated from the opposite direction; confirm with the operator.",
    ].filter(Boolean).join(" "),
    tags: Array.from(new Set([...(result.tags || []), "reverse"])),
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

function stationKeyFor(country: Country | undefined, name: string): string {
  return stationSearchKey(resolveStationAlias(country, name));
}

function resultStopPath(
  route: ScrapedRouteData,
  result: TransitResult,
  country?: Country,
): string[] {
  const origin = result.origin || route.origin;
  const destination = result.destination || route.destination;
  const raw = result.stops?.length > 0 ? result.stops : [origin, destination];
  const points = [origin, ...raw, destination];
  const path: string[] = [];
  for (const point of points) {
    if (!point) continue;
    if (path.length === 0 || stationKeyFor(country, path[path.length - 1]) !== stationKeyFor(country, point)) {
      path.push(point);
    }
  }
  return path.length >= 2 ? path : [origin, destination];
}

function routeSegments(route: ScrapedRouteData, date?: string, country?: Country): Array<[string, string]> {
  const segments = new Map<string, [string, string]>();
  const addPath = (path: string[]) => {
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      const key = `${stationKeyFor(country, from)}→${stationKeyFor(country, to)}`;
      if (stationKeyFor(country, from) !== stationKeyFor(country, to)) {
        segments.set(key, [from, to]);
      }
    }
  };

  addPath([route.origin, route.destination]);
  for (const result of resultsForDate(route, date)) {
    addPath(resultStopPath(route, result, country));
  }
  return Array.from(segments.values());
}

function spanDuration(departureMinutes: number, arrivalMinutes: number): number | undefined {
  if (!Number.isFinite(departureMinutes) || !Number.isFinite(arrivalMinutes)) return undefined;
  return arrivalMinutes - departureMinutes + (arrivalMinutes < departureMinutes ? 1440 : 0);
}

/**
 * The run of legs a train makes from `fromKey` to `toKey`, or null.
 *
 * A source that times every call publishes one leg per hop (ODPT gives each
 * train's `odpt:departureTime` at every station it passes), so the leg for
 * "Kuramae → Nihombashi" is four consecutive hops rather than a single entry.
 * Reading the first leg's departure and the last leg's arrival keeps every
 * time the operator's own; it is the intermediate legs' contiguity — not any
 * arithmetic of ours — that proves the two stations are one ride apart.
 *
 * The run must be unbroken and stay on one service. A gap or a change of line
 * means the pair needs a connection, which is {@link chainResults}' job and
 * carries transfer rules this function has no business assuming away.
 */
function legSpan(
  legs: JourneyLeg[] | undefined,
  fromKey: string,
  toKey: string,
  country?: Country,
): JourneyLeg[] | null {
  if (!legs || legs.length === 0) return null;
  const start = legs.findIndex((leg) => (
    stationKeyFor(country, leg.origin) === fromKey
    && Boolean(leg.departureTime)
    && Boolean(leg.arrivalTime)
  ));
  if (start < 0) return null;

  const span: JourneyLeg[] = [];
  for (let index = start; index < legs.length; index += 1) {
    const leg = legs[index];
    if (!leg.departureTime || !leg.arrivalTime) return null;
    if (index > start) {
      const previous = legs[index - 1];
      if (stationKeyFor(country, previous.destination) !== stationKeyFor(country, leg.origin)) return null;
      if ((leg.lineName || "") !== (legs[start].lineName || "")) return null;
    }
    span.push(leg);
    if (stationKeyFor(country, leg.destination) === toKey) return span;
  }
  return null;
}

function segmentResult(
  result: TransitResult,
  route: ScrapedRouteData,
  edge: RouteEdge,
  country?: Country,
): TransitResult | null {
  const oriented = edge.reversed ? reverseResult(result) : result;
  const path = resultStopPath(route, oriented, country);
  const fromKey = stationKeyFor(country, edge.from);
  const toKey = stationKeyFor(country, edge.to);
  const fromIndex = path.findIndex((station) => stationKeyFor(country, station) === fromKey);
  const toIndex = path.findIndex(
    (station, index) => index > fromIndex && stationKeyFor(country, station) === toKey,
  );
  if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return null;

  const fullPath = path.slice(fromIndex, toIndex + 1);
  const isFullResult = fromIndex === 0 && toIndex === path.length - 1;
  if (isFullResult) return oriented;

  // An intermediate stop is a valid graph node, but a route-level departure
  // and arrival do not tell us when the train reached that stop. Only expose a
  // partial edge when the source supplied explicit legs for it; proportional
  // interpolation would turn an unknown time into fabricated timetable data.
  const span = legSpan(oriented.legs, fromKey, toKey, country);
  if (!span) return null;
  const first = span[0];
  const last = span[span.length - 1];
  const departureTime = first.departureTime!;
  const arrivalTime = last.arrivalTime!;
  const departureMinutes = parseTime(departureTime);
  const arrivalMinutes = parseTime(arrivalTime);
  const durationMinutes = span.length === 1
    ? first.durationMinutes ?? spanDuration(departureMinutes, arrivalMinutes)
    : spanDuration(departureMinutes, arrivalMinutes);
  // One leg is one train, whatever journey it was cut out of. Several legs are
  // only direct when the journey they came from was.
  const direct = span.length === 1 || oriented.direct !== false;

  return {
    ...oriented,
    id: `${oriented.id}-segment-${fromIndex}-${toIndex}`,
    origin: fullPath[0],
    destination: fullPath[fullPath.length - 1],
    service: first.lineName || oriented.service,
    departureTime,
    arrivalTime,
    durationMinutes,
    price: fromIndex === 0 ? oriented.price : undefined,
    platform: first.platform,
    headsign: first.headsign,
    direct,
    stops: fullPath,
    legs: direct ? undefined : span,
    transferStations: direct ? undefined : span.slice(0, -1).map((leg) => leg.destination),
  };
}

/**
 * One departure, once.
 *
 * A line can be filed under more than one route when its trains do not all run
 * the same span (Tokyo's Asakusa Line is committed end to end *and* as the
 * Sengakuji through-service span, because only a quarter of its trains run the
 * whole line). A train that appears in two of those files is still one train,
 * and the ride cut out of it for a given pair is the same ride, so it must not
 * reach the results twice. Identity is the departure itself — its clock times
 * and service — not the row id, which carries the file's own origin and so
 * differs between copies.
 */
function dedupeDepartures(results: TransitResult[]): TransitResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [
      result.departureTime,
      result.arrivalTime,
      result.origin,
      result.destination,
      result.service,
      result.operator,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resultsForEdge(edge: RouteEdge, date?: string, country?: Country): TransitResult[] {
  return resultsForDate(edge.route, date)
    .flatMap((result) => segmentResult(result, edge.route, edge, country) || []);
}

function findRoutePaths(
  routes: ScrapedRouteData[],
  origin: string,
  destination: string,
  date?: string,
  country?: Country,
): RouteEdge[][] {
  const edges: RouteEdge[] = routes
    .filter((route) => resultsForDate(route, date).length > 0)
    .flatMap((route) => routeSegments(route, date, country).flatMap(([from, to]) => [
      { route, from, to, reversed: false },
      { route, from: to, to: from, reversed: true },
    ]));
  const target = stationKeyFor(country, destination);
  const queue: Array<{ station: string; path: RouteEdge[]; visited: Set<string> }> = [{
    station: origin,
    path: [],
    visited: new Set([stationKeyFor(country, origin)]),
  }];
  const found: RouteEdge[][] = [];
  let shortestLength = Number.POSITIVE_INFINITY;

  while (queue.length > 0 && found.length < 5) {
    const current = queue.shift()!;
    if (current.path.length >= Math.min(shortestLength, 5)) continue;

    for (const edge of edges) {
      if (stationKeyFor(country, edge.from) !== stationKeyFor(country, current.station) || current.visited.has(stationKeyFor(country, edge.to))) continue;
      const path = [...current.path, edge];
      if (stationKeyFor(country, edge.to) === target) {
        shortestLength = path.length;
        found.push(path);
        continue;
      }
      if (path.length < 5) {
        queue.push({
          station: edge.to,
          path,
          visited: new Set([...current.visited, stationKeyFor(country, edge.to)]),
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

  for (const path of findRoutePaths(routes, origin, destination, date, country)) {
    type PartialChain = { results: TransitResult[]; legs: JourneyLeg[] };
    let partials: PartialChain[] = resultsForEdge(path[0], date, country)
      .filter((result) => result.departureTime && result.arrivalTime)
      .slice(0, 100)
      .map((result) => ({
        results: [result],
        legs: [resultToLeg(result, path[0].route.source)],
      }));

    for (const edge of path.slice(1)) {
      const nextResults = resultsForEdge(edge, date, country)
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
          .filter(({ wait }) => {
            const transferStation = previous.destination;
            const minimum = getMinimumTransferMinutes(
              country ?? previous.country,
              transferStation,
            );
            return wait >= minimum && wait <= 120;
          })
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
      const fareWarning = sameOperatorFareWarning(partial.results);
      chainResultsList.push({
        id: country ? `chain-${country}-${chainId++}` : `chain-${chainId++}`,
        country: resolvedCountry,
        date: first.date || last.date || date,
        operator: partial.results.map((result) => result.operator).join(" → "),
        service: partial.results.map((result) => result.service).join(" → "),
        departureTime: first.departureTime,
        arrivalTime: last.arrivalTime,
        durationMinutes: totalDuration,
        price: aggregateTransferFare(partial.results),
        currency: partial.results.every((result) => result.currency === first.currency)
          ? first.currency
          : undefined,
        origin: first.origin,
        destination: last.destination,
        direct: false,
        stops: [first.origin, ...transferStations, last.destination],
        legs: partial.legs,
        transferStations,
        tags: ["chain"],
        warning: fareWarning,
      });
    }
  }

  chainResultsList.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  return chainResultsList.slice(0, 50);
}

/**
 * Names in one route's committed rows that can act as a journey endpoint.
 *
 * Route- and result-level origins and destinations always can. An intermediate
 * stop only can when the source supplied a leg carrying its own departure and
 * arrival times — the same admission rule {@link segmentResult} applies before
 * it will answer for a partial edge. Counting every `stops` entry instead
 * published names search must answer nothing for: Japan's ODPT rows list the
 * whole calling pattern but carry no legs, so eleven stations (Kuramae,
 * Asakusabashi, Akebonobashi, …) were offered as pickable and then met with
 * "no timetable".
 */
export function endpointNamesForRoute(route: ScrapedRouteData): string[] {
  const names: Array<string | undefined> = [route.origin, route.destination];
  for (const result of route.results || []) {
    names.push(result.origin, result.destination);
    for (const leg of result.legs || []) {
      if (!leg.departureTime || !leg.arrivalTime) continue;
      names.push(leg.origin, leg.destination);
    }
  }
  return names.filter((name): name is string => Boolean(name));
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

  // A station can reach the picker under a different naming system than the
  // timetables use (Seoul Metro "Seoul Station" vs Korail "Seoul (SNC)").
  // Resolve to the timetable spelling before keying, including for chaining.
  origin = resolveStationAlias(country, origin);
  destination = resolveStationAlias(country, destination);

  const oKey = stationKeyFor(country, origin);
  const dKey = stationKeyFor(country, destination);

  const exact = routes.find(
    (r) => stationKeyFor(country, r.origin) === oKey
      && stationKeyFor(country, r.destination) === dKey
      && resultsForDate(r, date).length > 0,
  );
  if (exact) {
    const results = resultsForDate(exact, date);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  // File origin matches, but destination is only on individual results
  // (mixed-destination snapshot files).
  const resultMatch = routes.find(
    (r) => stationKeyFor(country, r.origin) === oKey
      && resultsForDate(r, date).some((res) => stationKeyFor(country, res.destination) === dKey),
  );
  if (resultMatch) {
    const results = resultsForDate(resultMatch, date)
      .filter((r) => stationKeyFor(country, r.destination) === dKey);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  const reverse = routes.find(
    (r) => stationKeyFor(country, r.origin) === dKey
      && stationKeyFor(country, r.destination) === oKey
      && resultsForDate(r, date).length > 0,
  );
  if (reverse) {
    const results = resultsForDate(reverse, date).map(reverseResult);
    return country ? results.map((r) => (r.country ? r : { ...r, country })) : results;
  }

  // One route's own train can serve a pair that is neither the file's endpoints
  // nor two adjacent stops: a line scraped terminal-to-terminal answers
  // Kuramae → Nihombashi from the same rows. The stop graph below only ever
  // builds edges between consecutive stops, so without this the pair would fall
  // through to chaining and be rejected — a single train is not a connection,
  // and no transfer window applies to staying seated.
  for (const reversed of [false, true]) {
    const spans = dedupeDepartures(routes
      .filter((route) => resultsForDate(route, date).length > 0)
      .flatMap((route) => resultsForEdge({ route, from: origin, to: destination, reversed }, date, country)))
      .sort((left, right) => left.departureTime.localeCompare(right.departureTime));
    if (spans.length > 0) {
      return country ? spans.map((result) => (result.country ? result : { ...result, country })) : spans;
    }
  }

  const graphPaths = findRoutePaths(routes, origin, destination, date, country);
  if (graphPaths.some((path) => path.length === 1)) {
    const directSegments = dedupeDepartures(graphPaths
      .filter((path) => path.length === 1)
      .flatMap((path) => resultsForEdge(path[0], date, country)));
    if (directSegments.length > 0) {
      return country
        ? directSegments.map((result) => (result.country ? result : { ...result, country }))
        : directSegments;
    }
  }

  // Overlapping route files can build the same connection twice, so the same
  // rule applies to chains as to a single ride.
  const chained = dedupeDepartures(chainResults(routes, origin, destination, date, country));
  if (chained.length > 0) return chained;

  return null;
}
