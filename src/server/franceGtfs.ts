import { inflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SearchResponse, ServiceDayAdvisory, ServiceDayType, TransitResult } from "../types";
import { recordError } from "./errorLog";
import { serviceDayRisk, validateServiceDayAdvisory, withArtifactFreshness, withSelectedQueryRisk } from "../data/serviceDayAdvisory";

export const FRANCE_GTFS_URL = "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip";
const FRANCE_TIMEZONE = "Europe/Paris";
const FEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type GtfsStop = { id: string; name: string; parentStation?: string };
type GtfsTrip = { serviceId: string; headsign?: string; routeId?: string };
type GtfsRoute = { shortName?: string; longName?: string };
type GtfsFeed = {
  stops: GtfsStop[];
  trips: Map<string, GtfsTrip>;
  routes: Map<string, GtfsRoute>;
  stopTimes: string;
  activeDates: Map<string, Map<string, number>>;
  calendar?: string;
  sourceUpdatedAt?: string;
};

/** One origin→destination leg of a single GTFS trip, in minutes past midnight
 *  (departure_time may exceed 24:00 for services that run past midnight). */
type GtfsJourney = {
  tripId: string;
  departure: number;
  arrival: number;
  headsign?: string;
  routeId?: string;
};

export type FranceServiceDayArtifact = {
  schemaVersion: 1;
  country: "france";
  source: "SNCF Open Data GTFS";
  sourceUrl: string;
  timezone: typeof FRANCE_TIMEZONE;
  retrievedAt: string;
  sourceUpdatedAt?: string;
  validFrom: string;
  validTo: string;
  routes: Record<string, Record<string, ServiceDayAdvisory>>;
};

let feedCache: { expiresAt: number; feed: GtfsFeed } | null = null;
let artifactCache: FranceServiceDayArtifact | null | undefined;
const ARTIFACT_PATH = resolve(process.cwd(), "src/data/service-day/france.json");

function read16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function read32(bytes: Uint8Array, offset: number) {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0;
}

function zipTextEntries(bytes: Uint8Array): Map<string, string> {
  const entries = new Map<string, string>();
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (read32(bytes, offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("SNCF GTFS archive has no end-of-central-directory record.");

  const count = read16(bytes, end + 10);
  const centralOffset = read32(bytes, end + 16);
  let offset = centralOffset;
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (read32(bytes, offset) !== 0x02014b50) throw new Error("SNCF GTFS archive has an invalid central directory.");
    const compression = read16(bytes, offset + 10);
    const compressedSize = read32(bytes, offset + 20);
    const nameLength = read16(bytes, offset + 28);
    const extraLength = read16(bytes, offset + 30);
    const commentLength = read16(bytes, offset + 32);
    const localOffset = read32(bytes, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = read16(bytes, localOffset + 26);
    const localExtraLength = read16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const uncompressed = compression === 0
      ? compressed
      : compression === 8
        ? new Uint8Array(inflateRawSync(compressed))
        : (() => { throw new Error(`Unsupported GTFS ZIP compression method ${compression}.`); })();
    entries.set(name, decoder.decode(uncompressed));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function csvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function forEachCsvRow(text: string, callback: (row: Record<string, string>) => void) {
  let start = 0;
  let headers: string[] | undefined;
  while (start < text.length) {
    const end = text.indexOf("\n", start);
    const line = text.slice(start, end < 0 ? text.length : end).replace(/\r$/, "");
    start = end < 0 ? text.length : end + 1;
    if (!line) continue;
    const values = csvLine(line);
    if (!headers) {
      headers = values;
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = values[index] || ""; });
    callback(row);
  }
}

function normalizeStation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stationStopIds(stops: GtfsStop[], query: string): Set<string> {
  const queryKey = normalizeStation(query);
  const exact = stops.filter((stop) => normalizeStation(stop.name) === queryKey);
  const candidates = exact.length > 0
    ? exact
    : stops.filter((stop) => {
      const key = normalizeStation(stop.name);
      return key.includes(queryKey) || queryKey.includes(key);
    });
  const selected = new Set(candidates.map((stop) => stop.id));
  const selectedParents = new Set(candidates.map((stop) => stop.parentStation).filter(Boolean));
  for (const stop of stops) {
    if (selectedParents.has(stop.parentStation) || selectedParents.has(stop.id)) selected.add(stop.id);
  }
  return selected;
}

async function loadFeed(): Promise<GtfsFeed> {
  if (feedCache && feedCache.expiresAt > Date.now()) return feedCache.feed;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  let archiveBytes: ArrayBuffer;
  try {
    response = await fetch(FRANCE_GTFS_URL, {
      signal: controller.signal,
      headers: { Accept: "application/zip", "User-Agent": "TransitRail/1.0" },
    });
    if (!response.ok) throw new Error(`SNCF GTFS returned HTTP ${response.status}.`);
    archiveBytes = await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
  const archive = zipTextEntries(new Uint8Array(archiveBytes));
  const stops: GtfsStop[] = [];
  forEachCsvRow(archive.get("stops.txt") || "", (row) => {
    if (row.stop_id && row.stop_name) stops.push({ id: row.stop_id, name: row.stop_name, parentStation: row.parent_station || undefined });
  });
  const trips = new Map<string, GtfsTrip>();
  forEachCsvRow(archive.get("trips.txt") || "", (row) => {
    if (row.trip_id && row.service_id) trips.set(row.trip_id, { serviceId: row.service_id, headsign: row.trip_headsign || undefined, routeId: row.route_id || undefined });
  });
  const activeDates = new Map<string, Map<string, number>>();
  forEachCsvRow(archive.get("calendar_dates.txt") || "", (row) => {
    if (!row.date || !row.service_id) return;
    const byService = activeDates.get(row.date) || new Map<string, number>();
    byService.set(row.service_id, Number(row.exception_type));
    activeDates.set(row.date, byService);
  });
  const routes = new Map<string, GtfsRoute>();
  forEachCsvRow(archive.get("routes.txt") || "", (row) => {
    if (row.route_id) routes.set(row.route_id, { shortName: row.route_short_name || undefined, longName: row.route_long_name || undefined });
  });
  const feed = {
    stops,
    trips,
    routes,
    stopTimes: archive.get("stop_times.txt") || "",
    activeDates,
    calendar: archive.get("calendar.txt"),
    sourceUpdatedAt: response.headers.get("last-modified") || undefined,
  };
  feedCache = { feed, expiresAt: Date.now() + FEED_CACHE_TTL_MS };
  return feed;
}

function activeServices(feed: GtfsFeed, date: string): Set<string> {
  const active = new Set<string>();
  const exceptions = feed.activeDates.get(date.replace(/-/g, ""));
  exceptions?.forEach((type, serviceId) => {
    if (type === 1) active.add(serviceId);
    if (type === 2) active.delete(serviceId);
  });
  // Some regional feeds provide a normal calendar in addition to exceptions.
  if (feed.calendar) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const field = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][weekday];
    forEachCsvRow(feed.calendar, (row) => {
      if (row.start_date <= date && date <= row.end_date && row[field] === "1") active.add(row.service_id);
    });
  }
  exceptions?.forEach((type, serviceId) => { if (type === 2) active.delete(serviceId); });
  return active;
}

function gtfsMinutes(value: string): number | undefined {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatGtfsMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function serviceDayType(feed: GtfsFeed | undefined, date: string): ServiceDayType {
  const exceptions = feed?.activeDates.get(date.replace(/-/g, ""));
  if (feed?.calendar && exceptions && exceptions.size > 0) return "special";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: FRANCE_TIMEZONE, weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FRANCE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: FRANCE_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function advisoryRisk(date: string, lastDeparture: number, selectedTime?: string) {
  const now = new Date();
  const queryMinutes = date === localDate(now)
    ? selectedTime && /^\d{2}:\d{2}$/.test(selectedTime)
      ? Number(selectedTime.slice(0, 2)) * 60 + Number(selectedTime.slice(3))
      : localMinutes(now)
    : date > localDate(now) ? 0 : 24 * 60;
  const minutesToLastDeparture = lastDeparture - queryMinutes;
  const risk = serviceDayRisk(minutesToLastDeparture);
  return { risk, minutesToLastDeparture } as const;
}

function buildUnavailable(date: string, note: string, feed?: GtfsFeed): ServiceDayAdvisory {
  return {
    coverage: "unavailable",
    serviceDate: date,
    timezone: FRANCE_TIMEZONE,
    serviceDayType: serviceDayType(feed, date),
    risk: "unavailable",
    source: "SNCF Open Data GTFS",
    sourceUrl: FRANCE_GTFS_URL,
    checkedAt: new Date().toISOString(),
    note,
  };
}

function routeKey(origin: string, destination: string) {
  return `${normalizeStation(origin)}->${normalizeStation(destination)}`;
}

function loadArtifact(): FranceServiceDayArtifact | null {
  if (artifactCache !== undefined) return artifactCache;
  if (!existsSync(ARTIFACT_PATH)) {
    artifactCache = null;
    return artifactCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as FranceServiceDayArtifact;
    if (parsed.schemaVersion !== 1 || parsed.country !== "france" || !parsed.routes || !parsed.validFrom || !parsed.validTo) {
      throw new Error("SNCF service-day artifact failed schema validation.");
    }
    for (const dates of Object.values(parsed.routes)) {
      for (const [date, advisory] of Object.entries(dates)) {
        const normalized = validateServiceDayAdvisory(advisory);
        if (normalized.serviceDate !== date) throw new Error("SNCF service-day artifact date does not match its advisory.");
      }
    }
    artifactCache = parsed;
    return parsed;
  } catch (error) {
    void recordError({
      severity: "warning",
      module: "france-gtfs",
      operation: "service-day.artifact-read",
      errorCode: "SNCF_GTFS_ARTIFACT_INVALID",
      error,
      country: "france",
      provider: FRANCE_GTFS_URL,
      context: { path: ARTIFACT_PATH },
    });
    artifactCache = null;
    return null;
  }
}

/**
 * Every trip in the feed that calls at the origin and then, later in its stop
 * sequence, at the destination on the given service date. Shared by the
 * service-day advisory (which needs only the first and last departure) and the
 * timetable builder (which needs them all).
 */
function collectJourneys(feed: GtfsFeed, origin: string, destination: string, date: string): GtfsJourney[] {
  const active = activeServices(feed, date);
  const originIds = stationStopIds(feed.stops, origin);
  const destinationIds = stationStopIds(feed.stops, destination);
  const journeys: GtfsJourney[] = [];
  const byTrip = new Map<string, { origins: Array<{ sequence: number; minutes: number }>; destinations: Array<{ sequence: number; minutes: number }> }>();
  forEachCsvRow(feed.stopTimes, (row) => {
    const trip = feed.trips.get(row.trip_id);
    if (!trip || !active.has(trip.serviceId)) return;
    const minutes = gtfsMinutes(row.departure_time || row.arrival_time);
    const sequence = Number(row.stop_sequence);
    if (minutes === undefined || !Number.isFinite(sequence)) return;
    const current = byTrip.get(row.trip_id) || { origins: [], destinations: [] };
    if (originIds.has(row.stop_id)) current.origins.push({ sequence, minutes });
    if (destinationIds.has(row.stop_id)) current.destinations.push({ sequence, minutes });
    byTrip.set(row.trip_id, current);
  });
  for (const [tripId, value] of byTrip) {
    const origins = value.origins.sort((a, b) => a.sequence - b.sequence);
    const destinations = value.destinations.sort((a, b) => a.sequence - b.sequence);
    const originStop = origins.find((candidate) => destinations.some((destinationStop) => destinationStop.sequence > candidate.sequence));
    const destinationStop = originStop && destinations.find((candidate) => candidate.sequence > originStop.sequence);
    if (originStop && destinationStop) {
      const trip = feed.trips.get(tripId);
      journeys.push({
        tripId,
        departure: originStop.minutes,
        arrival: destinationStop.minutes,
        headsign: trip?.headsign,
        routeId: trip?.routeId,
      });
    }
  }
  return journeys.sort((a, b) => a.departure - b.departure);
}

function calculateAdvisory(feed: GtfsFeed, origin: string, destination: string, date: string, selectedTime?: string): ServiceDayAdvisory {
  const journeys = collectJourneys(feed, origin, destination, date);
  if (journeys.length === 0) return buildUnavailable(date, "SNCF did not publish a service for this station pair on the selected date.", feed);
  const firstDeparture = journeys[0].departure;
  const lastDeparture = journeys[journeys.length - 1].departure;
  const { risk, minutesToLastDeparture } = advisoryRisk(date, lastDeparture, selectedTime);
  return {
    coverage: "supported",
    serviceDate: date,
    timezone: FRANCE_TIMEZONE,
    serviceDayType: serviceDayType(feed, date),
    firstDeparture: formatGtfsMinutes(firstDeparture),
    lastDeparture: formatGtfsMinutes(lastDeparture),
    risk,
    minutesToLastDeparture,
    source: "SNCF Open Data GTFS",
    sourceUrl: FRANCE_GTFS_URL,
    updatedAt: feed.sourceUpdatedAt,
    checkedAt: new Date().toISOString(),
  };
}

export async function getFranceServiceDayAdvisory(
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): Promise<ServiceDayAdvisory> {
  const artifact = loadArtifact();
  const artifactAdvisory = artifact?.routes[routeKey(origin, destination)]?.[date];
  if (artifactAdvisory) return withSelectedQueryRisk(withArtifactFreshness(artifactAdvisory, artifact?.retrievedAt), selectedTime);
  // Journey search is deliberately artifact-only. The scheduled France
  // scraper owns GTFS retrieval and atomic publication; a missing artifact is
  // unavailable coverage, not permission to fetch an upstream feed per user.
  return buildUnavailable(date, "SNCF service-day information is not available from the latest scheduled artifact.");
}

/** GTFS times run past 24:00 for services crossing midnight; the wall clock a
 *  passenger reads does not. Duration is taken from the raw values, so a
 *  23:50 → 25:15 trip renders as 23:50 → 01:15 lasting 85 min. */
function formatClock(minutes: number) {
  return formatGtfsMinutes(((minutes % 1440) + 1440) % 1440);
}

function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  return route?.shortName || route?.longName || "TER";
}

/**
 * Real departures for a France route on a given date, straight from the SNCF
 * GTFS calendar — the same feed the service-day advisory already downloads.
 *
 * Shaped for ProviderBackedScraper, so a failed download or a date the feed
 * does not cover falls back to the curated snapshot rather than failing the
 * scrape. No fare is emitted: SNCF's GTFS ships no fare_attributes, and an
 * invented price is exactly what this replaces.
 */
export async function searchFranceGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  let feed: GtfsFeed;
  try {
    feed = await loadFeed();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "SNCF_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "SNCF GTFS download failed.",
        results: [],
        source: FRANCE_GTFS_URL,
      },
    };
  }

  const journeys = collectJourneys(feed, origin, destination, date);
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `SNCF published no ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: "SNCF Open Data GTFS",
      },
    };
  }

  const results: TransitResult[] = journeys.map((journey) => ({
    id: `fr-${journey.tripId}`,
    country: "france",
    operator: "SNCF",
    service: serviceLabel(feed, journey),
    departureTime: formatClock(journey.departure),
    arrivalTime: formatClock(journey.arrival),
    durationMinutes: journey.arrival - journey.departure,
    origin,
    destination,
    direct: true,
    stops: [],
    ...(journey.headsign ? { headsign: journey.headsign } : {}),
  }));

  return { status: 200, body: { results, source: "SNCF Open Data GTFS" } };
}

/** Collect and atomically publish the route/date artifact used by scheduled scrapes. */
export async function collectFranceServiceDayArtifact(
  routes: Array<{ origin: string; destination: string }>,
  date: string,
): Promise<FranceServiceDayArtifact> {
  const feed = await loadFeed();
  const existing = loadArtifact();
  const artifact: FranceServiceDayArtifact = existing
    ? { ...existing, routes: Object.fromEntries(Object.entries(existing.routes).map(([key, dates]) => [key, { ...dates }])) }
    : {
      schemaVersion: 1,
      country: "france",
      source: "SNCF Open Data GTFS",
      sourceUrl: FRANCE_GTFS_URL,
      timezone: FRANCE_TIMEZONE,
      retrievedAt: new Date().toISOString(),
      sourceUpdatedAt: feed.sourceUpdatedAt,
      validFrom: date,
      validTo: date,
      routes: {},
    };
  artifact.retrievedAt = new Date().toISOString();
  artifact.sourceUpdatedAt = feed.sourceUpdatedAt || artifact.sourceUpdatedAt;
  artifact.validFrom = artifact.validFrom < date ? artifact.validFrom : date;
  artifact.validTo = artifact.validTo > date ? artifact.validTo : date;
  let collectedRoutes = 0;
  for (const route of routes) {
    const key = routeKey(route.origin, route.destination);
    const advisory = validateServiceDayAdvisory(calculateAdvisory(feed, route.origin, route.destination, date));
    if (advisory.coverage !== "supported") {
      await recordError({
        severity: "warning",
        module: "france-gtfs",
        operation: "service-day.route",
        errorCode: "SNCF_GTFS_ROUTE_UNAVAILABLE",
        message: `SNCF GTFS has no complete service for ${route.origin} → ${route.destination} on ${date}.`,
        country: "france",
        provider: FRANCE_GTFS_URL,
        context: { origin: route.origin, destination: route.destination, date },
      });
      continue;
    }
    artifact.routes[key] = { ...(artifact.routes[key] || {}), [date]: advisory };
    collectedRoutes += 1;
  }
  if (collectedRoutes === 0) throw new Error(`SNCF GTFS collected no complete service routes for ${date}.`);
  const tempPath = `${ARTIFACT_PATH}.${process.pid}.tmp`;
  mkdirSync(resolve(ARTIFACT_PATH, ".."), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(tempPath, ARTIFACT_PATH);
  artifactCache = artifact;
  return artifact;
}

export function resetFranceGtfsCache() {
  feedCache = null;
  artifactCache = undefined;
}

export function resetFranceGtfsFeedCache() {
  feedCache = null;
}
