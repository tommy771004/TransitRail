import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { TransitResult, Country, JourneyLeg } from "../../types";

interface ScrapedRouteData {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

const DATA_DIR = join(process.cwd(), "src/data/scraped");

const ALL_COUNTRIES: Country[] = [
  "japan", "korea", "singapore", "thailand",
  "hong_kong", "united_kingdom", "united_states",
  "germany", "france", "china",
];

let cache: Record<string, ScrapedRouteData[]> = {};
let loaded = false;

function loadDir(country: string): ScrapedRouteData[] {
  const dirPath = join(DATA_DIR, country);
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

function resultsForDate(route: ScrapedRouteData, date?: string): TransitResult[] {
  if (!date) return route.results;

  return route.results.filter((result) => {
    const resultDate = result.date || route.date;
    return resultDate === date;
  });
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
    return normalizeResults(resultsForDate(reverse, date).map((r) => {
      const result = { ...r };
      result.origin = r.destination;
      result.destination = r.origin;
      result.id = `rev-${r.id}`;
      result.stops = [...r.stops].reverse();
      return result;
    }));
  }

  // Step 3: transfer chaining — find origin→X + X→destination
  const chainResults: TransitResult[] = [];
  const transferCandidates = new Map<string, { outbound: ScrapedRouteData; inbound: ScrapedRouteData }>();

  for (const routeOut of countryData) {
    if (key(routeOut.origin) !== oKey || !resultsForDate(routeOut, date).length) continue;
    const transferStation = routeOut.destination;
    if (key(transferStation) === oKey || key(transferStation) === dKey) continue;

    for (const routeIn of countryData) {
      if (key(routeIn.destination) !== dKey || !resultsForDate(routeIn, date).length) continue;
      if (key(routeIn.origin) !== key(transferStation)) continue;

      transferCandidates.set(key(transferStation), { outbound: routeOut, inbound: routeIn });
    }
  }

  // Build chained results for each transfer candidate
  let chainId = 0;
  for (const { outbound, inbound } of transferCandidates.values()) {
    const transferName = outbound.destination;
    const outboundResults = resultsForDate(outbound, date);
    const inboundResults = resultsForDate(inbound, date);

    for (const first of outboundResults) {
      for (const second of inboundResults) {
        if (!first.departureTime || !second.arrivalTime) continue;

        const dep = parseTime(first.departureTime);
        const firstArr = parseTime(first.arrivalTime || first.departureTime);
        const secondDep = parseTime(second.departureTime || "00:00");
        const waitMinutes = secondDep - firstArr + (secondDep < firstArr ? 1440 : 0);

        // Only chain if transfer wait is reasonable (≥2 min, ≤120 min)
        if (waitMinutes < 2 || waitMinutes > 120) continue;

        const totalDuration = parseTime(second.arrivalTime) - dep + (parseTime(second.arrivalTime) < dep ? 1440 : 0);
        if (totalDuration <= 0) continue;

        // Construct legs
        const firstLeg: JourneyLeg = {
          lineName: first.service || outbound.source,
          origin: first.origin,
          destination: first.destination,
          departureTime: first.departureTime,
          arrivalTime: first.arrivalTime,
          durationMinutes: first.durationMinutes,
          stopCount: first.stops ? first.stops.length - 1 : undefined,
          headsign: first.headsign,
          lineCode: first.service,
        };

        const secondLeg: JourneyLeg = {
          lineName: second.service || inbound.source,
          origin: second.origin,
          destination: second.destination,
          departureTime: second.departureTime,
          arrivalTime: second.arrivalTime,
          durationMinutes: second.durationMinutes,
          stopCount: second.stops ? second.stops.length - 1 : undefined,
          headsign: second.headsign,
          lineCode: second.service,
        };

        chainResults.push({
          id: `chain-${country}-${chainId++}`,
          country,
          date: first.date || second.date || date,
          operator: `${first.operator} → ${second.operator}`,
          service: `${first.service} → ${second.service}`,
          departureTime: first.departureTime,
          arrivalTime: second.arrivalTime,
          durationMinutes: totalDuration,
          price: first.price != null && second.price != null
            ? first.price + second.price
            : first.price ?? second.price,
          currency: first.currency || second.currency,
          origin: first.origin,
          destination: second.destination,
          direct: false,
          stops: [first.origin, transferName, second.destination],
          legs: [firstLeg, secondLeg],
          transferStations: [transferName],
          tags: ["chain"],
        });
      }
    }
  }

  if (chainResults.length > 0) {
    // Sort by departure time and limit to prevent N×M explosion
    chainResults.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    return chainResults.slice(0, 50);
  }

  return null;
}
