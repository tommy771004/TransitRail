import { findOdptRoute, type OdptRoute } from "../data/odptRoutes";
import { japanRailLines } from "../data/stations";
import type { JourneyLeg, SearchResponse, TransitResult } from "../types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ProviderResponse = {
  status: number;
  body: SearchResponse & { error?: string };
};

interface OdptProviderOptions {
  fetcher?: Fetcher;
  apiKey?: string;
}

interface OdptCall {
  "odpt:arrivalTime"?: string;
  "odpt:departureTime"?: string;
  "odpt:arrivalStation"?: string;
  "odpt:departureStation"?: string;
}

interface OdptTrain {
  "odpt:calendar"?: string;
  "odpt:trainNumber"?: string;
  "odpt:railDirection"?: string;
  "odpt:destinationStation"?: string[];
  "odpt:trainTimetableObject"?: OdptCall[];
}

function requestedCalendar(date: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));
  return weekday === "Sat" || weekday === "Sun"
    ? "odpt.Calendar:SaturdayHoliday"
    : "odpt.Calendar:Weekday";
}

function minutes(value: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!match || Number(match[2]) > 59) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Match station identities on the romaji, not the string.
 *
 * `odpt.Station:Toei.Asakusa.Nishimagome` and the line map's `Nishi-magome`
 * are the same platform written by two publishers; hyphens, case and the id
 * prefix are the only difference. Keying past them means a station configured
 * here is matched by what it is called, so an id whose casing we guessed
 * wrongly still finds its train rather than silently scraping nothing.
 */
function stationIdKey(value: string | undefined): string {
  return (value ?? "").split(".").at(-1)?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function callStation(call: OdptCall): string {
  return call["odpt:departureStation"] ?? call["odpt:arrivalStation"] ?? "";
}

/** Line map spellings, keyed the same way, per line and then across all lines. */
const catalogNamesByLine = new Map<string, Map<string, string>>();
const catalogNames = new Map<string, string>();
for (const line of japanRailLines) {
  const names = new Map<string, string>();
  for (const station of line.stations) {
    const key = stationIdKey(station.name);
    if (!key) continue;
    if (!names.has(key)) names.set(key, station.name);
    if (!catalogNames.has(key)) catalogNames.set(key, station.name);
  }
  catalogNamesByLine.set(line.name, names);
}

/**
 * The name a station is offered under, given the id the feed used.
 *
 * Station names are the join key between a timetable row and the search index,
 * so a stop that reaches the picker as `Higashi-nihombashi` has to be filed
 * under that spelling too — the derived `Higashi Nihombashi` would be a name
 * the map offers and search cannot answer. The feed's own romaji is only the
 * fallback, for a station the line map does not list.
 */
function stationLabel(id: string, route: OdptRoute): string {
  const key = stationIdKey(id);
  if (!key) return "";
  if (key === stationIdKey(route.originStation)) return route.origin;
  if (key === stationIdKey(route.destinationStation)) return route.destination;
  return catalogNamesByLine.get(route.lineName)?.get(key)
    ?? catalogNames.get(key)
    ?? id.split(".").at(-1)?.replace(/([a-z])([A-Z])/g, "$1 $2")
    ?? id;
}

/**
 * One leg per hop the train makes, each timed by the operator.
 *
 * ODPT gives a departure time at every station a train passes, so publishing
 * the calling pattern as legs is what lets a search for two stations in the
 * middle of the line be answered from these rows — with the operator's times,
 * never an interpolation between the terminals. A hop the feed left untimed is
 * dropped rather than filled, which also stops any span across it.
 */
function buildLegs(calls: OdptCall[], from: number, to: number, route: OdptRoute): JourneyLeg[] {
  const legs: JourneyLeg[] = [];
  for (let index = from; index < to; index += 1) {
    const call = calls[index];
    const next = calls[index + 1];
    const departureTime = call["odpt:departureTime"] ?? call["odpt:arrivalTime"];
    const arrivalTime = next["odpt:arrivalTime"] ?? next["odpt:departureTime"];
    const departureMinutes = minutes(departureTime);
    const arrivalMinutes = minutes(arrivalTime);
    if (!departureTime || !arrivalTime || departureMinutes === undefined || arrivalMinutes === undefined) continue;
    const origin = stationLabel(callStation(call), route);
    const destination = stationLabel(callStation(next), route);
    if (!origin || !destination || origin === destination) continue;
    legs.push({
      lineName: route.lineName,
      origin,
      destination,
      departureTime,
      arrivalTime,
      durationMinutes: arrivalMinutes - departureMinutes + (arrivalMinutes < departureMinutes ? 1440 : 0),
    });
  }
  return legs;
}

function timetableUrl(route: OdptRoute, apiKey: string): string {
  const base = route.operator === "Toei"
    ? "https://api-public.odpt.org/api/v4/odpt:TrainTimetable"
    : "https://api.odpt.org/api/v4/odpt:TrainTimetable";
  const url = new URL(base);
  url.searchParams.set("odpt:operator", `odpt.Operator:${route.operator}`);
  url.searchParams.set("odpt:railway", route.railway);
  if (route.operator === "TokyoMetro") url.searchParams.set("acl:consumerKey", apiKey);
  return url.toString();
}

function buildResults(trains: OdptTrain[], route: OdptRoute, date: string): TransitResult[] {
  const calendar = requestedCalendar(date);
  const unique = new Map<string, TransitResult>();
  const originKey = stationIdKey(route.originStation);
  const destinationKey = stationIdKey(route.destinationStation);

  for (const train of trains) {
    if (train["odpt:calendar"] !== calendar) continue;
    const calls = train["odpt:trainTimetableObject"] ?? [];
    const originIndex = calls.findIndex(
      (call) => stationIdKey(call["odpt:departureStation"]) === originKey && call["odpt:departureTime"],
    );
    if (originIndex < 0) continue;
    const destinationIndex = calls.findIndex(
      (call, index) => index > originIndex
        && (stationIdKey(call["odpt:arrivalStation"]) === destinationKey
          || stationIdKey(call["odpt:departureStation"]) === destinationKey),
    );
    if (destinationIndex < 0) continue;

    const departureTime = calls[originIndex]["odpt:departureTime"];
    const arrivalTime = calls[destinationIndex]["odpt:arrivalTime"]
      ?? calls[destinationIndex]["odpt:departureTime"];
    let departureMinutes = minutes(departureTime);
    let arrivalMinutes = minutes(arrivalTime);
    if (departureMinutes === undefined || arrivalMinutes === undefined || !departureTime || !arrivalTime) continue;
    if (arrivalMinutes < departureMinutes) arrivalMinutes += 1440;

    const trainNumber = train["odpt:trainNumber"] ?? "unknown";
    const key = `${trainNumber}|${departureTime}|${arrivalTime}`;
    unique.set(key, {
      id: `${date}-jp-odpt-${route.operator.toLowerCase()}-${trainNumber.toLowerCase()}-${departureTime.replace(":", "")}`,
      country: "japan",
      date,
      operator: route.operator === "Toei" ? "Toei Subway" : "Tokyo Metro",
      service: route.lineName,
      departureTime,
      arrivalTime,
      durationMinutes: arrivalMinutes - departureMinutes,
      origin: route.origin,
      destination: route.destination,
      direct: true,
      stops: calls.slice(originIndex, destinationIndex + 1).map((call) =>
        stationLabel(callStation(call), route)),
      legs: buildLegs(calls, originIndex, destinationIndex, route),
      headsign: stationLabel(train["odpt:destinationStation"]?.[0] ?? "", route),
      lineColor: route.lineColor,
    });
  }

  return [...unique.values()].sort((left, right) => left.departureTime.localeCompare(right.departureTime));
}

export function createOdptTimetableProvider(
  options: OdptProviderOptions = {},
): (origin: string, destination: string, date: string) => Promise<ProviderResponse> {
  const fetcher = options.fetcher ?? fetch;
  const apiKey = options.apiKey ?? process.env.ODPT_API_KEY?.trim() ?? "";
  const cache = new Map<string, Promise<OdptTrain[]>>();

  return async (origin, destination, date) => {
    const route = findOdptRoute(origin, destination);
    if (!route) {
      return { status: 404, body: { results: [], error: "ODPT_ROUTE_NOT_CONFIGURED" } };
    }
    if (route.operator === "TokyoMetro" && !apiKey) {
      return {
        status: 503,
        body: {
          results: [],
          error: "ODPT_KEY_MISSING",
          message: "ODPT_API_KEY is required for Tokyo Metro scheduled downloads.",
        },
      };
    }

    const url = timetableUrl(route, apiKey);
    try {
      let promise = cache.get(url);
      if (!promise) {
        promise = fetcher(url, { headers: { "user-agent": "TransitRail scheduled timetable scraper" } })
          .then(async (response) => {
            if (!response.ok) throw new Error(`ODPT returned HTTP ${response.status}.`);
            const value = await response.json();
            if (!Array.isArray(value)) throw new Error("ODPT returned malformed timetable JSON.");
            return value as OdptTrain[];
          });
        cache.set(url, promise);
      }
      const results = buildResults(await promise, route, date);
      if (results.length === 0) {
        return {
          status: 404,
          body: { results: [], source: `ODPT ${route.operator} timetable`, error: "ODPT_ROUTE_NOT_FOUND" },
        };
      }
      return {
        status: 200,
        body: {
          results,
          source: route.operator === "Toei"
            ? "ODPT Toei timetable (CC BY 4.0)"
            : "ODPT Tokyo Metro timetable",
        },
      };
    } catch (error) {
      cache.delete(url);
      return {
        status: 503,
        body: {
          results: [],
          error: "ODPT_SOURCE_UNAVAILABLE",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  };
}

export const searchOdptTimetable = createOdptTimetableProvider();
