import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { TransitResult, Country, JourneyLeg } from "../../types";

interface ScrapedRouteData {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

// Resolve the data directory relative to this file, regardless of CJS or ESM.
function resolveDataDir(): string {
  // ESM: use import.meta.url
  if (typeof import.meta !== "undefined" && import.meta.url) {
    return dirname(fileURLToPath(import.meta.url));
  }
  // CJS production bundle: __dirname is the dist/ directory
  try {
    // @ts-ignore – __dirname exists in CJS
    const d = __dirname as string;
    const isDist = d.endsWith("dist") || d.endsWith("api");
    return isDist ? join(d, "../src/data/scraped") : d;
  } catch {
    // Last-resort fallback: cwd-relative (works when running from project root)
    return join(process.cwd(), "src/data/scraped");
  }
}

const ACTUAL_DATA_DIR = resolveDataDir();

const ALL_COUNTRIES: Country[] = [
  "japan", "korea", "singapore", "thailand",
  "hong_kong", "united_kingdom", "united_states",
  "germany", "france", "china",
];

let cache: Record<string, ScrapedRouteData[]> = {};
let loaded = false;

function loadDir(country: string): ScrapedRouteData[] {
  const dirPath = join(ACTUAL_DATA_DIR, country);
  const data: ScrapedRouteData[] = [];

  if (!existsSync(dirPath)) {
    return data;
  }

  const files = readdirSync(dirPath);
  for (const file of files) {
    if (!file.endsWith(".json") || file === "metadata.json") continue;
    try {
      const content = readFileSync(join(dirPath, file), "utf-8");
      data.push(JSON.parse(content));
    } catch (e) {
      console.warn(`[scraped] Failed to parse ${country}/${file}:`, e);
    }
  }

  return data;
}

export function loadScrapedData(): void {
  let totalRoutes = 0;
  for (const country of ALL_COUNTRIES) {
    cache[country] = loadDir(country);
    totalRoutes += cache[country].length;
  }
  loaded = true;
  console.log(`[scraped] Loaded ${totalRoutes} routes across ${ALL_COUNTRIES.length} countries`);
}

const key = (s: string) => s.toLowerCase().trim();

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

function normalizeTransferLegTimes(result: TransitResult): TransitResult {
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

function normalizeResults(results: TransitResult[]): TransitResult[] {
  return results.map(normalizeTransferLegTimes);
}

interface RouteEdge {
  route: ScrapedRouteData;
  from: string;
  to: string;
  reversed: boolean;
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
    // A reverse timetable cannot safely reuse the original direction's
    // platform or headsign. Leg durations and transfer waits are retained.
    platform: undefined,
    headsign: undefined,
    legs: reversedLegs.length > 0 ? reversedLegs : undefined,
    transferStations: result.transferStations
      ? [...result.transferStations].reverse()
      : undefined,
  };
}

function resultsForEdge(edge: RouteEdge, date?: string): TransitResult[] {
  const results = resultsForDate(edge.route, date);
  return edge.reversed ? results.map(reverseResult) : results;
}

/**
 * Find a small number of shortest paths through the route snapshots. Edges
 * are usable in both directions, matching the existing reverse-route search.
 * Five edges covers the sparse intercity snapshot graph without allowing an
 * unbounded walk through unrelated routes.
 */
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
  const target = key(destination);
  const queue: Array<{ station: string; path: RouteEdge[]; visited: Set<string> }> = [{
    station: origin,
    path: [],
    visited: new Set([key(origin)]),
  }];
  const found: RouteEdge[][] = [];
  let shortestLength = Number.POSITIVE_INFINITY;

  while (queue.length > 0 && found.length < 5) {
    const current = queue.shift()!;
    if (current.path.length >= Math.min(shortestLength, 5)) continue;

    for (const edge of edges) {
      if (key(edge.from) !== key(current.station) || current.visited.has(key(edge.to))) continue;
      const path = [...current.path, edge];
      if (key(edge.to) === target) {
        shortestLength = path.length;
        found.push(path);
        continue;
      }
      if (path.length < 5) {
        queue.push({
          station: edge.to,
          path,
          visited: new Set([...current.visited, key(edge.to)]),
        });
      }
    }
  }

  return found.filter((path) => path.length === shortestLength);
}

function resultsForDate(route: ScrapedRouteData, date?: string): TransitResult[] {
  if (!date) return route.results;

  // Filter to only results whose stored date matches the requested date.
  const target = date.trim();
  const filtered = route.results.filter((result) => {
    const resultDate = (result.date || "").trim();
    return resultDate === target;
  });

  return filtered;
}

export function findScrapedResults(
  country: Country,
  origin: string,
  destination: string,
  date?: string,
): TransitResult[] | null {
  if (!loaded) loadScrapedData();

  const countryData = cache[country];
  if (!countryData || countryData.length === 0) return null;

  const oKey = key(origin);
  const dKey = key(destination);

  // Step 1: exact match on file-level origin/destination
  const exact = countryData.find(
    (r) => key(r.origin) === oKey && key(r.destination) === dKey && resultsForDate(r, date).length > 0,
  );
  if (exact) return normalizeResults(resultsForDate(exact, date));

  // Step 1b: match on file origin + result-level destination (e.g. mixed-destination file)
  const resultMatch = countryData.find(
    (r) => key(r.origin) === oKey && resultsForDate(r, date).some((res) => key(res.destination) === dKey),
  );
  if (resultMatch) {
    return normalizeResults(resultsForDate(resultMatch, date).filter((r) => key(r.destination) === dKey));
  }

  // Step 2: reverse match
  const reverse = countryData.find(
    (r) => key(r.origin) === dKey && key(r.destination) === oKey && resultsForDate(r, date).length > 0,
  );
  if (reverse) {
    return normalizeResults(resultsForDate(reverse, date).map(reverseResult));
  }

  // Step 3: graph chaining. Unlike the old origin→X→destination loop, this
  // supports reverse edges and several regional/intercity connections.
  const chainResults: TransitResult[] = [];
  let chainId = 0;
  for (const path of findRoutePaths(countryData, origin, destination, date)) {
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
      const first = partial.results[0];
      const last = partial.results[partial.results.length - 1];
      const arrival = parseTime(last.arrivalTime!);
      const departure = parseTime(first.departureTime);
      const totalDuration = arrival - departure + (arrival < departure ? 1440 : 0);
      if (totalDuration <= 0) continue;
      const transferStations = partial.results.slice(0, -1).map((result) => result.destination);

      chainResults.push({
          id: `chain-${country}-${chainId++}`,
          country,
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

  if (chainResults.length > 0) {
    // Sort by departure time and limit to prevent N×M explosion
    chainResults.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    return chainResults.slice(0, 50);
  }

  return null;
}
