// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: UK Transport for London (TfL) transit provider service supporting future date and time queries

import type { JourneyLeg, SearchResponse, TransitLine, TransitResult } from "../types";

const TFL_API_URL = "https://api.tfl.gov.uk";
const TFL_MODES = "tube,dlr,overground,elizabeth-line";
const STATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface TflStopPoint {
  id?: string;
  commonName?: string;
  modes?: string[];
}

interface TflStopPointResponse {
  stopPoints?: TflStopPoint[];
}

interface TflSearchResponse {
  matches?: Array<{
    id?: string;
    name?: string;
    modes?: string[];
  }>;
}

interface TflLeg {
  duration?: number;
  departureTime?: string;
  arrivalTime?: string;
  mode?: { name?: string };
  departurePoint?: { commonName?: string; lat?: number; lon?: number };
  arrivalPoint?: { commonName?: string; lat?: number; lon?: number };
  instruction?: { summary?: string; detailed?: string };
  routeOptions?: Array<{
    lineIdentifier?: { id?: string; name?: string };
  }>;
  path?: {
    stopPoints?: Array<{ name?: string }>;
  };
  disruptions?: Array<{ description?: string }>;
}

interface TflJourney {
  startDateTime?: string;
  arrivalDateTime?: string;
  duration?: number;
  legs?: TflLeg[];
  fare?: { totalCost?: number };
}

interface TflJourneyResponse {
  journeys?: TflJourney[];
}

let stationCache: { expiresAt: number; stations: string[] } | null = null;
let lineCache: { expiresAt: number; lines: TransitLine[] } | null = null;

const tflLineColors: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
  dlr: "#00A4A7",
  liberty: "#6C6D70",
  lioness: "#FFA600",
  mildmay: "#0077AD",
  suffragette: "#5BBD72",
  weaver: "#823A62",
  windrush: "#EE2E24",
};

function tflUrl(pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, TFL_API_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (process.env.TFL_APP_KEY) {
    url.searchParams.set("app_key", process.env.TFL_APP_KEY);
  }
  return url;
}

async function fetchTflJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "TransitRail/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`TfL returned HTTP ${response.status}.`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStationName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+(underground|rail|dlr|overground)\s+station$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateInLondon() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function timeInLondon(value?: string) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function publicTransportLegs(legs: TflLeg[]) {
  return legs.filter((leg) => leg.mode?.name !== "walking");
}

export async function getTflStations() {
  if (stationCache && stationCache.expiresAt > Date.now()) {
    return stationCache.stations;
  }

  const data = await fetchTflJson<TflStopPointResponse>(
    tflUrl(`/StopPoint/Mode/${TFL_MODES}`),
  );
  const stations = Array.from(
    new Set(
      (data.stopPoints || [])
        .map((station) => station.commonName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  stationCache = {
    expiresAt: Date.now() + STATION_CACHE_TTL_MS,
    stations,
  };
  return stations;
}

interface TflLineSummary {
  id?: string;
  name?: string;
  modeName?: string;
}

export async function getTflLines(): Promise<TransitLine[]> {
  if (lineCache && lineCache.expiresAt > Date.now()) {
    return lineCache.lines;
  }

  const lineSummaries = await fetchTflJson<TflLineSummary[]>(
    tflUrl(`/Line/Mode/${TFL_MODES}`),
  );
  const summaries = (lineSummaries || []).filter((line): line is Required<TflLineSummary> =>
    Boolean(line.id && line.name));

  const lines = await Promise.all(
    summaries.map(async (summary) => {
      const stopPoints = await fetchTflJson<TflStopPoint[]>(
        tflUrl(`/Line/${encodeURIComponent(summary.id)}/StopPoints`),
      );
      const stations = (stopPoints || [])
        .map((stop) => stop.commonName?.trim())
        .filter((name): name is string => Boolean(name));
      return { id: summary.id, name: summary.name, stations };
    }),
  );

  const linesByStation = new Map<string, string[]>();
  for (const line of lines) {
    for (const station of line.stations) {
      const names = linesByStation.get(station) || [];
      if (!names.includes(line.name)) names.push(line.name);
      linesByStation.set(station, names);
    }
  }

  const catalog: TransitLine[] = lines.map((line) => ({
    id: line.id,
    name: line.name,
    color: tflLineColors[line.id],
    stations: line.stations.map((station) => {
      const transfers = (linesByStation.get(station) || []).filter((name) => name !== line.name);
      return {
        name: station,
        interchanges: transfers.length > 0 ? transfers : undefined,
      };
    }),
  }));

  lineCache = {
    expiresAt: Date.now() + STATION_CACHE_TTL_MS,
    lines: catalog,
  };
  return catalog;
}

async function resolveTflStation(query: string) {
  const data = await fetchTflJson<TflSearchResponse>(
    tflUrl(`/StopPoint/Search/${encodeURIComponent(query)}`, { modes: TFL_MODES }),
  );
  const matches = (data.matches || []).filter((match) => match.id && match.name);
  const normalizedQuery = normalizeStationName(query);
  const exact = matches.find((match) => normalizeStationName(match.name || "") === normalizedQuery);
  const selected = exact || matches[0];
  return selected?.id
    ? { id: selected.id, name: selected.name || query }
    : null;
}

function currentLondonTimeHHMM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}${values.minute}`;
}

export async function searchTflJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  const tflDate = date.replace(/-/g, "");
  const tflTime = time ? time.replace(/:/g, "") : currentLondonTimeHHMM();

  try {
    const [resolvedOrigin, resolvedDestination] = await Promise.all([
      resolveTflStation(origin),
      resolveTflStation(destination),
    ]);

    if (!resolvedOrigin || !resolvedDestination) {
      return {
        status: 400,
        body: {
          error: "Station not found",
          message: "TfL could not resolve one or both station names.",
          results: [],
          source: TFL_API_URL,
        },
      };
    }

    const data = await fetchTflJson<TflJourneyResponse>(
      tflUrl(
        `/Journey/JourneyResults/${encodeURIComponent(resolvedOrigin.id)}/to/${encodeURIComponent(resolvedDestination.id)}`,
        {
          mode: TFL_MODES,
          timeIs: "Departing",
          journeyPreference: "LeastTime",
          date: tflDate,
          time: tflTime,
        },
      ),
    );

    const results: TransitResult[] = (data.journeys || []).slice(0, 5).map((journey, index) => {
      const legs = journey.legs || [];
      const transitLegs = publicTransportLegs(legs);
      const services = Array.from(
        new Set(
          transitLegs
            .flatMap((leg) => leg.routeOptions || [])
            .map((option) => option.lineIdentifier?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      );
      const intermediateStops = transitLegs
        .flatMap((leg) => leg.path?.stopPoints || [])
        .map((stop) => stop.name)
        .filter((name): name is string => Boolean(name))
        .filter((name) => (
          normalizeStationName(name) !== normalizeStationName(resolvedOrigin.name) &&
          normalizeStationName(name) !== normalizeStationName(resolvedDestination.name)
        ));
      const warnings = transitLegs
        .flatMap((leg) => leg.disruptions || [])
        .map((disruption) => disruption.description)
        .filter((description): description is string => Boolean(description));
      const farePence = journey.fare?.totalCost;

      const legDetails: JourneyLeg[] = transitLegs.map((leg) => {
        const lineId = leg.routeOptions?.[0]?.lineIdentifier?.id;
        return {
          lineName: leg.routeOptions?.[0]?.lineIdentifier?.name || leg.mode?.name || "TfL",
          lineCode: lineId,
          color: lineId ? tflLineColors[lineId] : undefined,
          mode: leg.mode?.name,
          origin: leg.departurePoint?.commonName || "",
          originLat: leg.departurePoint?.lat,
          originLng: leg.departurePoint?.lon,
          destination: leg.arrivalPoint?.commonName || "",
          destLat: leg.arrivalPoint?.lat,
          destLng: leg.arrivalPoint?.lon,
          departureTime: timeInLondon(leg.departureTime),
          arrivalTime: timeInLondon(leg.arrivalTime),
          durationMinutes: leg.duration,
          headsign: leg.instruction?.summary,
          stopCount: leg.path?.stopPoints?.length || undefined,
        };
      });
      const transferStations = legDetails
        .slice(0, -1)
        .map((leg) => leg.destination)
        .filter(Boolean);
      const firstLineId = transitLegs[0]?.routeOptions?.[0]?.lineIdentifier?.id;

      return {
        id: `uk-tfl-${journey.startDateTime || Date.now()}-${index}`,
        country: "united_kingdom",
        operator: "Transport for London",
        service: services.join(" + ") || "TfL",
        trainType: transitLegs.map((leg) => leg.mode?.name).filter(Boolean).join(" + "),
        durationMinutes: journey.duration,
        departureTime: timeInLondon(journey.startDateTime),
        arrivalTime: timeInLondon(journey.arrivalDateTime),
        origin: resolvedOrigin.name,
        originLat: legDetails[0]?.originLat,
        originLng: legDetails[0]?.originLng,
        destination: resolvedDestination.name,
        destLat: legDetails.at(-1)?.destLat,
        destLng: legDetails.at(-1)?.destLng,
        price: typeof farePence === "number" ? farePence / 100 : undefined,
        currency: typeof farePence === "number" ? "GBP" : undefined,
        direct: transitLegs.length <= 1,
        stops: Array.from(new Set(intermediateStops)),
        headsign: transitLegs.at(-1)?.instruction?.summary,
        realtime: true,
        warning: warnings[0],
        lineColor: firstLineId ? tflLineColors[firstLineId] : undefined,
        legs: legDetails.length > 1 ? legDetails : undefined,
        transferStations: transferStations.length > 0 ? transferStations : undefined,
      };
    });

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0 ? "TfL returned no journeys for this route." : undefined,
        source: TFL_API_URL,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: error instanceof Error ? error.message : "Could not reach TfL.",
        results: [],
        source: TFL_API_URL,
      },
    };
  }
}

// --- End of tfl.ts ---
