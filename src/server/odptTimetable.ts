import { findOdptRoute, type OdptRoute } from "../data/odptRoutes";
import type { SearchResponse, TransitResult } from "../types";

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

function stationLabel(id: string, route: OdptRoute): string {
  if (id === route.originStation) return route.origin;
  if (id === route.destinationStation) return route.destination;
  return id.split(".").at(-1)?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? id;
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

  for (const train of trains) {
    if (train["odpt:calendar"] !== calendar) continue;
    const calls = train["odpt:trainTimetableObject"] ?? [];
    const originIndex = calls.findIndex(
      (call) => call["odpt:departureStation"] === route.originStation && call["odpt:departureTime"],
    );
    if (originIndex < 0) continue;
    const destinationIndex = calls.findIndex(
      (call, index) => index > originIndex
        && (call["odpt:arrivalStation"] === route.destinationStation
          || call["odpt:departureStation"] === route.destinationStation),
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
        stationLabel(call["odpt:departureStation"] ?? call["odpt:arrivalStation"] ?? "", route)),
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
