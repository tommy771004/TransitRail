// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: UK Transport for London (TfL) transit provider service supporting future date and time queries

import type {
  JourneyLeg,
  SearchResponse,
  ServiceDayAdvisory,
  ServiceDayType,
  TransitLine,
  TransitResult,
} from "../types";
import { serviceDayRisk } from "../data/serviceDayAdvisory";
import { recordError } from "./errorLog";

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
const serviceDayCache = new Map<string, { first: TflJourney; last: TflJourney }>();

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anonymous TfL access is rate limited, and a service-day sweep issues one
 * request per sampled hour. Back off and retry on 429 rather than dropping the
 * sample: a half-collected day is worse than a slow one, because the gaps look
 * like missing service instead of a throttled scrape. Set `TFL_APP_KEY` to lift
 * the limit and make this path rare.
 */
const TFL_RATE_LIMIT_RETRIES = 3;

async function fetchTflJson<T>(url: URL): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
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
      if (response.status === 429 && attempt < TFL_RATE_LIMIT_RETRIES) {
        const retryAfter = Number(response.headers.get("retry-after"));
        clearTimeout(timeout);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2_000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`TfL returned HTTP ${response.status}.`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeStationName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+(underground|rail|dlr|overground)\s+station$/, "")
    // A bare "Station" suffix too: TfL's own catalogue carries both
    // "Paddington Station" and "Paddington Underground Station", and they are
    // the same place. Without this they hash to different keys and the exact
    // match below never fires.
    .replace(/\s+station$/, "")
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

/**
 * TfL timestamps are already London local and carry NO timezone designator
 * ("2026-08-05T09:00:00"). `new Date()` reads such a string in the *process's*
 * zone, so converting it to Europe/London shifted every departure by the gap
 * between the server's zone and London's — an hour late on a UTC host through
 * British Summer Time, seven hours early on an Asia/Taipei laptop. The wall
 * clock in the string is the answer; read it, do not convert it.
 */
const LONDON_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function londonParts(value?: string): { date: string; time: string } | null {
  if (!value) return null;
  const local = value.match(LONDON_LOCAL);
  // Zone-less: the string is London wall-clock time already.
  if (local && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return { date: `${local[1]}-${local[2]}-${local[3]}`, time: `${local[4]}:${local[5]}` };
  }
  // Zoned (or unparseable as local): convert properly.
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function timeInLondon(value?: string) {
  return londonParts(value)?.time ?? "--:--";
}

function localDateTimeInLondon(value?: string) {
  return londonParts(value);
}

function localMinutes(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

function serviceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function buildServiceDayAdvisory(
  date: string,
  selectedTime: string,
  firstJourney: TflJourney | undefined,
  lastJourney: TflJourney | undefined,
): ServiceDayAdvisory {
  const first = localDateTimeInLondon(firstJourney?.startDateTime);
  const last = localDateTimeInLondon(lastJourney?.startDateTime);
  const queryMinutes = localMinutes(date, selectedTime);
  const lastMinutes = last ? localMinutes(last.date, last.time) : null;
  const minutesToLastDeparture = queryMinutes !== null && lastMinutes !== null
    ? lastMinutes - queryMinutes
    : undefined;
  const risk = minutesToLastDeparture === undefined
    ? "unavailable"
    : serviceDayRisk(minutesToLastDeparture);

  return {
    coverage: first && last ? "supported" : "unavailable",
    serviceDate: date,
    timezone: "Europe/London",
    serviceDayType: serviceDayType(date),
    firstDeparture: first?.time,
    lastDeparture: last?.time,
    risk,
    minutesToLastDeparture,
    source: TFL_API_URL,
    sourceUrl: TFL_API_URL,
    checkedAt: new Date().toISOString(),
  };
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

async function searchTflStopPoints(query: string) {
  const data = await fetchTflJson<TflSearchResponse>(
    tflUrl(`/StopPoint/Search/${encodeURIComponent(query)}`, { modes: TFL_MODES }),
  );
  return (data.matches || []).filter((match) => match.id && match.name);
}

/**
 * TfL's search matches on words, so a "Station" suffix the network does not use
 * finds nothing: "Paddington Station" and "Liverpool Street Station" resolved to
 * null and every date for that route fell back to the snapshot, while the three
 * routes named "… Underground Station" worked. Retrying without the suffix costs
 * one request on the paths that were previously dead ends.
 */
async function resolveTflStation(query: string) {
  const normalizedQuery = normalizeStationName(query);
  let matches = await searchTflStopPoints(query);
  if (matches.length === 0 && normalizedQuery && normalizedQuery !== query.toLowerCase()) {
    matches = await searchTflStopPoints(normalizedQuery);
  }
  let exact = matches.find((match) => normalizeStationName(match.name || "") === normalizedQuery);
  let selected = exact || matches[0];

  // TfL's search returns a HUB* interchange id for some bare station names.
  // JourneyResults cannot disambiguate those hubs (HTTP 300); retry with the
  // Tube spelling to obtain the child StopPoint id when one exists.
  if (selected?.id?.startsWith("HUB") && normalizedQuery) {
    const specificMatches = await searchTflStopPoints(`${normalizedQuery} Underground Station`);
    exact = specificMatches.find((match) => normalizeStationName(match.name || "") === normalizedQuery);
    selected = exact || specificMatches[0] || selected;
  }
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

    const journeyPath = `/Journey/JourneyResults/${encodeURIComponent(resolvedOrigin.id)}/to/${encodeURIComponent(resolvedDestination.id)}`;
    const serviceDayCacheKey = `${resolvedOrigin.id}->${resolvedDestination.id}:${date}`;
    const journeyParams = {
      mode: TFL_MODES,
      timeIs: "Departing",
      journeyPreference: "LeastTime",
      date: tflDate,
      time: tflTime,
    };
    const data = await fetchTflJson<TflJourneyResponse>(tflUrl(journeyPath, journeyParams));
    let firstData: TflJourneyResponse | undefined;
    let lastData: TflJourneyResponse | undefined;
    let serviceDayAdvisory: ServiceDayAdvisory;
    try {
      [firstData, lastData] = await Promise.all([
        fetchTflJson<TflJourneyResponse>(tflUrl(journeyPath, { ...journeyParams, adjustment: "TripFirst" })),
        fetchTflJson<TflJourneyResponse>(tflUrl(journeyPath, { ...journeyParams, adjustment: "TripLast" })),
      ]);
      const first = firstData.journeys?.[0];
      const last = lastData.journeys?.[0];
      if (first && last) {
        serviceDayCache.set(serviceDayCacheKey, { first, last });
      }
      serviceDayAdvisory = buildServiceDayAdvisory(date, `${tflTime.slice(0, 2)}:${tflTime.slice(2)}`, first, last);
    } catch (error) {
      void recordError({
        severity: "error",
        module: "tfl",
        operation: "service-day.fetch",
        errorCode: "TFL_SERVICE_DAY_FAILED",
        error,
        country: "united_kingdom",
        provider: TFL_API_URL,
        context: { origin, destination, date },
      });
      const cached = serviceDayCache.get(serviceDayCacheKey);
      const fallback = cached
        ? buildServiceDayAdvisory(
          date,
          `${tflTime.slice(0, 2)}:${tflTime.slice(2)}`,
          cached.first,
          cached.last,
        )
        : buildServiceDayAdvisory(date, `${tflTime.slice(0, 2)}:${tflTime.slice(2)}`, undefined, undefined);
      serviceDayAdvisory = {
        ...fallback,
        coverage: cached ? "stale" : "unavailable",
        note: cached
          ? "The last known service-day timetable is being shown while TfL is unavailable."
          : "TfL service-day information is temporarily unavailable.",
        checkedAt: new Date().toISOString(),
      };
    }

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
        // The journey planner answers future dates from the published schedule.
        // Only a journey on today's London service day can be a live arrival;
        // flagging the rest realtime made real scheduled data classify as a
        // stale live snapshot and get thrown away.
        realtime: londonParts(journey.startDateTime)?.date === dateInLondon(),
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
        serviceDayAdvisory,
      },
    };
  } catch (error) {
    void recordError({
      severity: "error",
      module: "tfl",
      operation: "journey.fetch",
      errorCode: "TFL_JOURNEY_FAILED",
      error,
      country: "united_kingdom",
      provider: TFL_API_URL,
      context: { origin, destination, date },
    });
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: "Transit data is temporarily unavailable. Please try again later.",
        results: [],
        source: TFL_API_URL,
      },
    };
  }
}

// --- End of tfl.ts ---

/**
 * Times of day sampled to build a service day from the journey planner.
 *
 * The planner answers "journeys near this time", so one query returns a handful
 * of departures within a few minutes. Sweeping the operating day turns that into
 * a real, if incomplete, picture of the service — every row is a genuine
 * published departure, and nothing between the samples is invented.
 */
const SERVICE_DAY_SAMPLE_TIMES = [
  "05:30", "07:00", "08:30", "10:00", "12:00",
  "14:00", "16:00", "17:30", "19:00", "21:00", "23:00",
];

/**
 * One service day for a route, assembled from several journey-planner queries.
 *
 * A single query gave three departures for a whole day, which is why the daily
 * scrape used to look like a live snapshot stamped on seven dates. Sampling
 * across the day keeps every row real while covering the hours a passenger
 * might actually travel.
 */
export async function searchTflServiceDay(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  const byId = new Map<string, SearchResponse["results"][number]>();
  let last: { status: number; body: SearchResponse & { error?: string } } | undefined;

  for (const [index, time] of SERVICE_DAY_SAMPLE_TIMES.entries()) {
    // Pace the sweep so anonymous access stays under TfL's limit; the retry in
    // fetchTflJson is the safety net, not the plan.
    if (index > 0 && !process.env.TFL_APP_KEY) await sleep(1_200);
    const response = await searchTflJourney(origin, destination, date, time);
    last = response;
    for (const result of response.body.results || []) {
      if (!byId.has(result.id)) byId.set(result.id, result);
    }
  }

  // Every sample failed: hand back the last failure so the caller's existing
  // provider-fallback path reports it rather than seeing a silent empty day.
  if (byId.size === 0) {
    return last ?? {
      status: 502,
      body: { error: "Provider request failed", results: [], source: TFL_API_URL },
    };
  }

  const results = [...byId.values()].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  return {
    status: 200,
    body: { ...last!.body, results, source: TFL_API_URL },
  };
}
