import type { JourneyLeg, SearchResponse, TransitResult } from "../types";

const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";
const ENTUR_GEOCODER_URL = "https://api.entur.io/geocoder/v1/autocomplete";
const ENTUR_CLIENT_NAME = process.env.ENTUR_CLIENT_NAME || "transitrail-timetable";

interface EnturPlaceFeature {
  properties?: { id?: string; name?: string; label?: string };
}

interface EnturGeocoderResponse {
  features?: EnturPlaceFeature[];
}

interface EnturLeg {
  mode?: string;
  expectedStartTime?: string;
  expectedEndTime?: string;
  fromPlace?: { name?: string };
  toPlace?: { name?: string };
  line?: { publicCode?: string; name?: string; authority?: { name?: string } };
}

interface EnturTripPattern {
  startTime?: string;
  duration?: number;
  legs?: EnturLeg[];
}

interface EnturTripResponse {
  data?: { trip?: { tripPatterns?: EnturTripPattern[] } };
  errors?: Array<{ message?: string }>;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9æøå]+/g, " ").trim();
}

function isoAtOsloTime(date: string, time?: string) {
  const rawTime = time || "08:00";
  const display = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Oslo", timeZoneName: "longOffset",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const offset = display.find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "+01:00";
  return `${date}T${rawTime}:00${offset === "" ? "Z" : offset}`;
}

function timeInOslo(value?: string) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(parsed);
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : undefined;
}

function isTodayInOslo(date: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return date === `${values.year}-${values.month}-${values.day}`;
}

function legColor(mode?: string) {
  if (mode === "rail") return "#8B1D3D";
  if (mode === "metro") return "#2563EB";
  if (mode === "tram") return "#0F766E";
  if (mode === "water") return "#0369A1";
  return "#4B5563";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "ET-Client-Name": ENTUR_CLIENT_NAME,
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Entur returned HTTP ${response.status}.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveNorwayStation(query: string) {
  const url = new URL(ENTUR_GEOCODER_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("lang", "en");
  const data = await fetchJson<EnturGeocoderResponse>(url.toString());
  const target = normalize(query);
  const candidates = (data.features || []).map((feature) => feature.properties).filter((item): item is NonNullable<EnturPlaceFeature["properties"]> => Boolean(item?.id));
  return candidates.find((item) => normalize(item.name || item.label || "") === target) || candidates[0] || null;
}

function toLeg(leg: EnturLeg): JourneyLeg {
  const service = leg.line?.publicCode || leg.line?.name || leg.mode || "Entur";
  return {
    lineName: service,
    lineCode: leg.line?.publicCode,
    color: legColor(leg.mode),
    mode: leg.mode?.toLowerCase(),
    origin: leg.fromPlace?.name || "",
    destination: leg.toPlace?.name || "",
    departureTime: timeInOslo(leg.expectedStartTime),
    arrivalTime: timeInOslo(leg.expectedEndTime),
    durationMinutes: minutesBetween(leg.expectedStartTime, leg.expectedEndTime),
  };
}

const TRIP_QUERY = `
  query NorwayTrip($from: String!, $to: String!, $dateTime: DateTime) {
    trip(
      from: { place: $from }
      to: { place: $to }
      dateTime: $dateTime
      numTripPatterns: 6
    ) {
      tripPatterns {
        startTime
        duration
        legs {
          mode
          expectedStartTime
          expectedEndTime
          fromPlace { name }
          toPlace { name }
          line { publicCode name authority { name } }
        }
      }
    }
  }
`;

export async function searchNorwayJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  try {
    const [from, to] = await Promise.all([resolveNorwayStation(origin), resolveNorwayStation(destination)]);
    if (!from?.id || !to?.id) {
      return { status: 400, body: { error: "Station not found", message: "Entur could not resolve one or both station names.", results: [], source: ENTUR_API_URL } };
    }
    const response = await fetchJson<EnturTripResponse>(ENTUR_API_URL, {
      method: "POST",
      body: JSON.stringify({ query: TRIP_QUERY, variables: { from: from.id, to: to.id, dateTime: isoAtOsloTime(date, time) } }),
    });
    if (response.errors?.length) {
      return { status: 502, body: { error: "Provider query failed", message: response.errors.map((entry) => entry.message).filter(Boolean).join(" "), results: [], source: ENTUR_API_URL } };
    }
    const realtime = isTodayInOslo(date);
    const results: TransitResult[] = (response.data?.trip?.tripPatterns || []).map((pattern, index) => {
      const legs = (pattern.legs || []).map(toLeg).filter((leg) => leg.origin && leg.destination);
      const firstRaw = pattern.legs?.[0];
      const first = legs[0];
      const last = legs.at(-1);
      return {
        id: `no-entur-${date}-${index}-${pattern.startTime || "trip"}`,
        country: "norway",
        operator: firstRaw?.line?.authority?.name || "Entur",
        service: legs.map((leg) => leg.lineName).join(" + ") || "Entur",
        trainType: firstRaw?.line?.publicCode || firstRaw?.line?.name,
        durationMinutes: typeof pattern.duration === "number" ? Math.round(pattern.duration / 60) : minutesBetween(firstRaw?.expectedStartTime, pattern.legs?.at(-1)?.expectedEndTime),
        departureTime: timeInOslo(firstRaw?.expectedStartTime || pattern.startTime),
        arrivalTime: last?.arrivalTime,
        origin: from.name || from.label || origin,
        destination: to.name || to.label || destination,
        direct: legs.length <= 1,
        stops: [],
        realtime,
        lineColor: first?.color,
        legs: legs.length > 1 ? legs : undefined,
        transferStations: legs.slice(0, -1).map((leg) => leg.destination),
      };
    });
    return { status: 200, body: { results, message: results.length === 0 ? "Entur returned no journeys for this route." : undefined, source: ENTUR_API_URL } };
  } catch (error) {
    return { status: 502, body: { error: "Provider request failed", message: error instanceof Error ? error.message : "Could not reach Entur.", results: [], source: ENTUR_API_URL } };
  }
}
