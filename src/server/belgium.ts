import type { JourneyLeg, SearchResponse, TransitResult } from "../types";

const IRAIL_API_URL = "https://api.irail.be";
const STATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface IrailStation {
  id?: string;
  name?: string;
  standardname?: string;
  locationX?: string;
  locationY?: string;
}

interface IrailStop {
  station?: string;
  stationinfo?: IrailStation;
  time?: string;
  delay?: string;
  platform?: string;
  vehicle?: string;
  vehicleinfo?: { shortname?: string; type?: string };
  direction?: string | { name?: string };
  stops?: { stop?: IrailStop[] };
}

interface IrailVia {
  arrival?: IrailStop;
  departure?: IrailStop;
}

interface IrailConnection {
  id?: string;
  departure?: IrailStop;
  arrival?: IrailStop;
  vias?: { via?: IrailVia[] };
  duration?: string;
  alerts?: { alert?: Array<{ header?: string; description?: string }> };
}

interface IrailConnectionsResponse {
  connection?: IrailConnection[];
}

interface IrailStationsResponse {
  station?: IrailStation[];
}

let stationCache: { expiresAt: number; stations: IrailStation[] } | null = null;

function iRailUrl(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, IRAIL_API_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchIRailJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "TransitRail/1.0 (+https://github.com/TransitRail)",
      },
    });
    if (!response.ok) throw new Error(`iRail returned HTTP ${response.status}.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStationName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function belgiumDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}${month}${year.slice(2)}`;
}

function belgiumTime(value?: string) {
  if (value) return value.replace(/:/g, "");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${part.hour}${part.minute}`;
}

function isTodayInBelgium(date: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return date === `${part.year}-${part.month}-${part.day}`;
}

function timeInBelgium(epoch?: string) {
  if (!epoch || !Number.isFinite(Number(epoch))) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(Number(epoch) * 1000));
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const minutes = Math.round((Number(end) - Number(start)) / 60);
  return minutes >= 0 ? minutes : undefined;
}

function lineColor(type?: string) {
  if (type === "IC") return "#0055A4";
  if (type === "S") return "#009B3A";
  if (type === "L") return "#E6007E";
  return "#4B5563";
}

function stationName(stop?: IrailStop) {
  return stop?.station || stop?.stationinfo?.name || "";
}

function directionName(value?: IrailStop["direction"]) {
  return typeof value === "string" ? value : value?.name;
}

function buildLeg(departure: IrailStop, arrival: IrailStop): JourneyLeg {
  const stops = (departure.stops?.stop || [])
    .map((stop) => stationName(stop))
    .filter(Boolean);
  const type = departure.vehicleinfo?.type;
  return {
    lineName: departure.vehicleinfo?.shortname || departure.vehicle || "SNCB/NMBS",
    lineCode: departure.vehicle,
    color: lineColor(type),
    mode: "train",
    origin: stationName(departure),
    originLat: Number(departure.stationinfo?.locationY) || undefined,
    originLng: Number(departure.stationinfo?.locationX) || undefined,
    destination: stationName(arrival),
    destLat: Number(arrival.stationinfo?.locationY) || undefined,
    destLng: Number(arrival.stationinfo?.locationX) || undefined,
    departureTime: timeInBelgium(departure.time),
    arrivalTime: timeInBelgium(arrival.time),
    durationMinutes: minutesBetween(departure.time, arrival.time),
    platform: departure.platform,
    delayMinutes: Math.max(0, Math.round(Number(departure.delay || "0") / 60)) || undefined,
    headsign: directionName(departure.direction),
    stopCount: stops.filter((stop) => stop !== stationName(departure) && stop !== stationName(arrival)).length || undefined,
    stops: stops.length > 0 ? stops : undefined,
  };
}

function legsForConnection(connection: IrailConnection) {
  const vias = connection.vias?.via || [];
  const legs: JourneyLeg[] = [];
  let departure = connection.departure;
  for (const via of vias) {
    if (!departure || !via.arrival || !via.departure) continue;
    legs.push(buildLeg(departure, via.arrival));
    departure = via.departure;
  }
  if (departure && connection.arrival) legs.push(buildLeg(departure, connection.arrival));
  return legs;
}

export async function getBelgiumStations() {
  if (stationCache && stationCache.expiresAt > Date.now()) {
    return Array.from(new Set(stationCache.stations.map((station) => station.name?.trim()).filter((name): name is string => Boolean(name))))
      .sort((a, b) => a.localeCompare(b));
  }
  const data = await fetchIRailJson<IrailStationsResponse>(
    iRailUrl("/stations/", { format: "json", lang: "en" }),
  );
  const rawStations = data.station || [];
  stationCache = { expiresAt: Date.now() + STATION_CACHE_TTL_MS, stations: rawStations };
  return Array.from(new Set(rawStations
    .map((station) => station.name?.trim())
    .filter((name): name is string => Boolean(name))))
    .sort((a, b) => a.localeCompare(b));
}

async function resolveBelgiumStation(query: string) {
  await getBelgiumStations();
  const stations = stationCache?.stations || [];
  const normalized = normalizeStationName(query);
  const matches = (station: IrailStation) => [station.name, station.standardname]
    .filter((name): name is string => Boolean(name))
    .some((name) => normalizeStationName(name) === normalized);
  const partial = (station: IrailStation) => [station.name, station.standardname]
    .filter((name): name is string => Boolean(name))
    .some((name) => normalizeStationName(name).includes(normalized));
  return stations.find(matches) || stations.find(partial) || null;
}

export async function searchBelgiumJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  try {
    const [resolvedOrigin, resolvedDestination] = await Promise.all([
      resolveBelgiumStation(origin),
      resolveBelgiumStation(destination),
    ]);
    if (!resolvedOrigin?.id || !resolvedDestination?.id) {
      return { status: 400, body: { error: "Station not found", message: "iRail could not resolve one or both station names.", results: [], source: IRAIL_API_URL } };
    }

    const data = await fetchIRailJson<IrailConnectionsResponse>(iRailUrl("/connections/", {
      from: resolvedOrigin.id,
      to: resolvedDestination.id,
      date: belgiumDate(date),
      time: belgiumTime(time),
      timesel: "departure",
      format: "json",
      lang: "en",
      alerts: "true",
      results: "6",
    }));

    const results: TransitResult[] = (data.connection || []).map((connection, index) => {
      const legs = legsForConnection(connection);
      const first = legs[0];
      const last = legs.at(-1);
      const alerts = connection.alerts?.alert || [];
      return {
        id: `be-irail-${connection.id || `${date}-${index}`}`,
        country: "belgium",
        operator: "SNCB/NMBS via iRail",
        service: legs.map((leg) => leg.lineName).join(" + ") || "SNCB/NMBS",
        trainType: legs.map((leg) => leg.lineName.split(" ")[0]).filter(Boolean).join(" + ") || undefined,
        durationMinutes: Number(connection.duration) ? Math.round(Number(connection.duration) / 60) : minutesBetween(connection.departure?.time, connection.arrival?.time),
        departureTime: timeInBelgium(connection.departure?.time),
        arrivalTime: timeInBelgium(connection.arrival?.time),
        origin: resolvedOrigin.name || origin,
        originLat: first?.originLat,
        originLng: first?.originLng,
        destination: resolvedDestination.name || destination,
        destLat: last?.destLat,
        destLng: last?.destLng,
        direct: legs.length <= 1,
        stops: Array.from(new Set(legs.flatMap((leg) => leg.stops || []).filter((stop) => stop !== resolvedOrigin.name && stop !== resolvedDestination.name))),
        platform: first?.platform,
        headsign: last?.headsign,
        // iRail returns the same shape for timetables and live departures. Do not
        // advertise a scheduled future-day result as realtime.
        realtime: isTodayInBelgium(date),
        warning: alerts[0]?.header || alerts[0]?.description,
        lineColor: first?.color,
        legs: legs.length > 1 ? legs : undefined,
        transferStations: legs.slice(0, -1).map((leg) => leg.destination).filter(Boolean),
      };
    });

    return { status: 200, body: { results, message: results.length === 0 ? "iRail returned no journeys for this route." : undefined, source: IRAIL_API_URL } };
  } catch (error) {
    return { status: 502, body: { error: "Provider request failed", message: error instanceof Error ? error.message : "Could not reach iRail.", results: [], source: IRAIL_API_URL } };
  }
}
