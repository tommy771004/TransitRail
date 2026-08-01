import type {
  JourneyLeg,
  SearchResponse,
  ServiceDayAdvisory,
  ServiceDayType,
  TransitLine,
  TransitResult,
} from "../types";
import { recordError } from "./errorLog";
import { serviceDayRisk } from "../data/serviceDayAdvisory";
import { getMinimumTransferMinutes, sameOperatorFareWarning } from "../data/transferRules";

const MBTA_API_URL = "https://api-v3.mbta.com";
const RAIL_ROUTE_TYPES = "0,1,2";
const JOURNEY_ROUTE_TYPES = "0,1,2,3";
const STATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface MbtaRelationship {
  data?: {
    id?: string;
    type?: string;
  } | null;
}

interface MbtaResource {
  id?: string;
  type?: string;
  attributes?: {
    arrival_time?: string | null;
    color?: string;
    departure_time?: string | null;
    direction_id?: number;
    headsign?: string;
    latitude?: number;
    longitude?: number;
    location_type?: number;
    long_name?: string;
    municipality?: string;
    name?: string;
    platform_code?: string;
    short_name?: string;
    status?: string | null;
    stop_sequence?: number;
    trip_headsign?: string;
    valid_days?: number[];
    schedule_type?: string | null;
    added_dates?: string[];
    removed_dates?: string[];
  };
  relationships?: {
    parent_station?: MbtaRelationship;
    route?: MbtaRelationship;
    service?: MbtaRelationship;
    stop?: MbtaRelationship;
    trip?: MbtaRelationship;
  };
}

interface MbtaResponse {
  data?: MbtaResource[];
  included?: MbtaResource[];
  links?: { next?: string | null };
}

interface MbtaStation {
  id: string;
  name: string;
  municipality?: string;
}

let stationCache: { expiresAt: number; stations: MbtaStation[] } | null = null;
let lineCache: { expiresAt: number; lines: TransitLine[] } | null = null;
const serviceDayCache = new Map<string, { first: ScheduledJourney; last: ScheduledJourney }>();
const scheduleCache = new Map<string, Promise<MbtaResponse>>();
const serviceCache = new Map<string, MbtaResource>();
let cacheFetch: typeof globalThis.fetch | undefined;

function ensureCacheScope() {
  if (cacheFetch === globalThis.fetch) return;
  cacheFetch = globalThis.fetch;
  stationCache = null;
  lineCache = null;
  scheduleCache.clear();
  serviceCache.clear();
}

function mbtaUrl(pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, MBTA_API_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchMbtaJson(url: URL): Promise<MbtaResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
    "User-Agent": "TransitRail/1.0",
  };
  if (process.env.MBTA_API_KEY) {
    headers["x-api-key"] = process.env.MBTA_API_KEY;
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    if (!response.ok) {
      throw new Error(`MBTA returned HTTP ${response.status}.`);
    }
    return await response.json() as MbtaResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStationName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+station$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateInBoston() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function currentBostonTimeHHMM() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

function timeInBoston(value?: string | null) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return undefined;
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return duration >= 0 ? duration : undefined;
}

interface ScheduledJourney {
  result: TransitResult;
  departureIso: string;
  arrivalIso: string;
  scheduleType?: string;
}

function localDateTimeInBoston(value?: string | null) {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function localMinutes(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

function fallbackServiceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function normalizeServiceDayType(scheduleType: string | undefined, date: string): ServiceDayType {
  const normalized = scheduleType?.toLowerCase();
  if (normalized?.includes("saturday")) return "saturday";
  if (normalized?.includes("sunday")) return "sunday_holiday";
  if (normalized?.includes("weekday")) return "weekday";
  if (normalized && normalized !== "other") return "special";
  return fallbackServiceDayType(date);
}

function buildMbtaAdvisory(
  date: string,
  selectedTime: string,
  first: ScheduledJourney | undefined,
  last: ScheduledJourney | undefined,
): ServiceDayAdvisory {
  const firstLocal = localDateTimeInBoston(first?.departureIso);
  const lastLocal = localDateTimeInBoston(last?.departureIso);
  const queryMinutes = localMinutes(date, selectedTime);
  const lastMinutes = lastLocal ? localMinutes(lastLocal.date, lastLocal.time) : null;
  const minutesToLastDeparture = queryMinutes !== null && lastMinutes !== null
    ? lastMinutes - queryMinutes
    : undefined;
  const risk = minutesToLastDeparture === undefined
    ? "unavailable"
    : serviceDayRisk(minutesToLastDeparture);

  return {
    coverage: first && last ? "supported" : "unavailable",
    serviceDate: date,
    timezone: "America/New_York",
    serviceDayType: normalizeServiceDayType(first?.scheduleType, date),
    firstDeparture: firstLocal?.time,
    lastDeparture: lastLocal?.time,
    risk,
    minutesToLastDeparture,
    source: MBTA_API_URL,
    sourceUrl: MBTA_API_URL,
    checkedAt: new Date().toISOString(),
  };
}

async function loadMbtaStations() {
  ensureCacheScope();
  if (stationCache && stationCache.expiresAt > Date.now()) {
    return stationCache.stations;
  }

  const response = await fetchMbtaJson(
    mbtaUrl("/stops", {
      "filter[route_type]": RAIL_ROUTE_TYPES,
      "page[limit]": "1000",
      sort: "name",
    }),
  );
  const stationsById = new Map<string, MbtaStation>();
  for (const resource of response.data || []) {
    const name = resource.attributes?.name?.trim();
    const stationId = resource.relationships?.parent_station?.data?.id || resource.id;
    if (!stationId || !name || stationsById.has(stationId)) continue;
    stationsById.set(stationId, {
      id: stationId,
      name,
      municipality: resource.attributes?.municipality || undefined,
    });
  }
  const stations = Array.from(stationsById.values());

  stationCache = {
    expiresAt: Date.now() + STATION_CACHE_TTL_MS,
    stations,
  };
  return stations;
}

/**
 * Names the network does not use for a stop it does serve. MBTA calls the Blue
 * Line stop for Boston Logan simply "Airport" — there is no station containing
 * "Logan" in its catalogue at all, so "Logan International Airport" resolved to
 * null and that route fell back to the snapshot on every date. Kept as an alias
 * rather than renaming the route, because the fuller name is what travellers
 * search for and it is the route page's title.
 */
const MBTA_STATION_ALIASES: Record<string, string> = {
  "logan international airport": "Airport",
  "logan airport": "Airport",
  "boston logan": "Airport",
};

// The parent "Airport" stop is the Blue Line station. The route page names
// Logan's terminal bus service, so use Terminal A as a stable representative
// stop for the live Silver Line SL1 schedule instead.
const MBTA_SPECIAL_STATIONS: Record<string, MbtaStation> = {
  "logan international airport": { id: "17091", name: "Logan International Airport" },
  "logan airport": { id: "17091", name: "Logan International Airport" },
  "boston logan": { id: "17091", name: "Logan International Airport" },
};

async function resolveMbtaStation(query: string) {
  const special = MBTA_SPECIAL_STATIONS[normalizeStationName(query)];
  if (special) return special;
  const stations = await loadMbtaStations();
  const aliased = MBTA_STATION_ALIASES[normalizeStationName(query)];
  const normalizedQuery = normalizeStationName(aliased ?? query);
  const exact = stations.find((station) => normalizeStationName(station.name) === normalizedQuery);
  if (exact) return exact;
  return stations.find((station) => normalizeStationName(station.name).includes(normalizedQuery)) || null;
}

export async function getMbtaStations() {
  const stations = await loadMbtaStations();
  return stations.map((station) => station.name);
}

// Subway and light rail only (route types 0 and 1): about eight routes, so the
// per-route stop requests stay well under the keyless MBTA rate limit.
// Commuter-rail stations remain available through the flat station catalog.
export async function getMbtaLines(): Promise<TransitLine[]> {
  if (lineCache && lineCache.expiresAt > Date.now()) {
    return lineCache.lines;
  }

  const routesResponse = await fetchMbtaJson(
    mbtaUrl("/routes", { "filter[type]": "0,1", sort: "sort_order" }),
  );
  const routes = (routesResponse.data || []).filter((route): route is MbtaResource & { id: string } =>
    Boolean(route.id));

  const lines = await Promise.all(
    routes.map(async (route) => {
      const stopsResponse = await fetchMbtaJson(
        mbtaUrl("/stops", { "filter[route]": route.id, "page[limit]": "200" }),
      );
      const stations = (stopsResponse.data || [])
        .map((stop) => stop.attributes?.name?.trim())
        .filter((name): name is string => Boolean(name));
      return {
        id: route.id,
        name: route.attributes?.long_name || route.attributes?.short_name || route.id,
        color: route.attributes?.color ? `#${route.attributes.color}` : undefined,
        stations,
      };
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
    color: line.color,
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

function relationshipId(resource: MbtaResource, relationship: "route" | "stop" | "trip") {
  return resource.relationships?.[relationship]?.data?.id;
}

function resourceMap(resources: MbtaResource[], type: string) {
  return new Map(
    resources
      .filter((resource) => resource.type === type && resource.id)
      .map((resource) => [resource.id as string, resource]),
  );
}

async function schedulesForStop(stopId: string, date: string) {
  ensureCacheScope();
  const key = `${stopId}:${date}`;
  const cached = scheduleCache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<MbtaResponse> => {
    let next: URL | undefined = mbtaUrl("/schedules", {
      "filter[stop]": stopId,
      "filter[date]": date,
      // Include bus schedules for the Silver Line airport leg. The station
      // catalog remains rail-only, so this does not pollute the picker.
      "filter[route_type]": JOURNEY_ROUTE_TYPES,
      include: "trip,route,stop",
      "page[limit]": "1000",
      sort: "time",
    });
    const data: MbtaResource[] = [];
    const includedByKey = new Map<string, MbtaResource>();
    let pages = 0;
    while (next && pages < 20) {
      const response = await fetchMbtaJson(next);
      data.push(...(response.data || []));
      for (const resource of response.included || []) {
        if (resource.id && resource.type) includedByKey.set(`${resource.type}:${resource.id}`, resource);
      }
      const nextLink = response.links?.next;
      next = nextLink ? new URL(nextLink, MBTA_API_URL) : undefined;
      pages += 1;
    }
    return { data, included: [...includedByKey.values()] };
  })();
  scheduleCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    // A transient 429/5xx must not poison the process-wide cache.
    scheduleCache.delete(key);
    throw error;
  }
}

async function servicesForIds(ids: Set<string>) {
  if (ids.size === 0) return new Map<string, MbtaResource>();
  const missing = Array.from(ids).filter((id) => !serviceCache.has(id));
  if (missing.length > 0) {
    const response = await fetchMbtaJson(
      mbtaUrl("/services", {
        "filter[id]": missing.join(","),
        "page[limit]": String(missing.length),
      }),
    );
    for (const service of response.data || []) {
      if (service.id) serviceCache.set(service.id, service);
    }
  }
  return new Map(Array.from(ids).flatMap((id) => {
    const service = serviceCache.get(id);
    return service ? [[id, service] as const] : [];
  }));
}

function scheduledJourneysForRoute(
  originResponse: MbtaResponse,
  destinationResponse: MbtaResponse,
  origin: MbtaStation,
  destination: MbtaStation,
  date: string,
  serviceMetadata?: Map<string, MbtaResource>,
): ScheduledJourney[] {
  const destinationByTrip = new Map<string, MbtaResource[]>();
  for (const schedule of destinationResponse.data || []) {
    const tripId = relationshipId(schedule, "trip");
    if (!tripId) continue;
    const schedules = destinationByTrip.get(tripId) || [];
    schedules.push(schedule);
    destinationByTrip.set(tripId, schedules);
  }

  const included = [...(originResponse.included || []), ...(destinationResponse.included || [])];
  const routes = resourceMap(included, "route");
  const trips = resourceMap(included, "trip");
  const services = serviceMetadata || resourceMap(included, "service");
  const seenTrips = new Set<string>();
  const journeys: ScheduledJourney[] = [];

  for (const originSchedule of originResponse.data || []) {
    const tripId = relationshipId(originSchedule, "trip");
    const destinationSchedules = tripId ? destinationByTrip.get(tripId) : undefined;
    const destinationSchedule = destinationSchedules?.find((candidate) => (
      typeof originSchedule.attributes?.stop_sequence === "number" &&
      typeof candidate.attributes?.stop_sequence === "number" &&
      candidate.attributes.stop_sequence > originSchedule.attributes.stop_sequence
    ));
    if (!tripId || !destinationSchedule || seenTrips.has(tripId)) continue;

    const departureIso = originSchedule.attributes?.departure_time || originSchedule.attributes?.arrival_time;
    const arrivalIso = destinationSchedule.attributes?.arrival_time || destinationSchedule.attributes?.departure_time;
    if (!departureIso || !arrivalIso) continue;

    const route = routes.get(relationshipId(originSchedule, "route") || "");
    const trip = trips.get(tripId);
    const serviceId = originSchedule.relationships?.service?.data?.id || trip?.relationships?.service?.data?.id;
    const service = services.get(serviceId || "");
    const routeName = route?.attributes?.short_name || route?.attributes?.long_name || "MBTA Rail";
    const departureTime = timeInBoston(departureIso);
    const arrivalTime = timeInBoston(arrivalIso);
    if (!departureTime || !arrivalTime) continue;

    seenTrips.add(tripId);
    journeys.push({
      departureIso,
      arrivalIso,
      scheduleType: service?.attributes?.schedule_type || undefined,
      result: {
        id: `us-mbta-schedule-${tripId}-${originSchedule.attributes?.stop_sequence || 0}`,
        country: "united_states",
        date,
        operator: "MBTA",
        service: routeName,
        trainType: route?.attributes?.long_name || "Rail",
        durationMinutes: minutesBetween(departureIso, arrivalIso),
        departureTime,
        arrivalTime,
        origin: origin.name,
        destination: destination.name,
        direct: true,
        stops: [],
        headsign: originSchedule.attributes?.trip_headsign || trip?.attributes?.headsign,
        realtime: false,
      },
    });
  }

  return journeys.sort((a, b) => a.departureIso.localeCompare(b.departureIso));
}

function transferJourneysForRoute(
  firstLeg: ScheduledJourney[],
  secondLeg: ScheduledJourney[],
  transfer: MbtaStation,
  date: string,
): ScheduledJourney[] {
  const journeys: ScheduledJourney[] = [];
  let secondIndex = 0;
  const minimumTransferMinutes = getMinimumTransferMinutes("united_states", transfer.name);

  for (const first of firstLeg) {
    const firstArrival = new Date(first.arrivalIso).getTime();
    while (
      secondIndex < secondLeg.length &&
      new Date(secondLeg[secondIndex].departureIso).getTime()
        < firstArrival + minimumTransferMinutes * 60_000
    ) {
      secondIndex += 1;
    }
    const second = secondLeg[secondIndex];
    if (!second) break;

    const firstResult = first.result;
    const secondResult = second.result;
    const firstLegDetails: JourneyLeg = {
      lineName: firstResult.service,
      origin: firstResult.origin,
      destination: transfer.name,
      departureTime: firstResult.departureTime,
      arrivalTime: firstResult.arrivalTime,
      durationMinutes: minutesBetween(first.departureIso, first.arrivalIso),
      headsign: firstResult.headsign,
      mode: firstResult.trainType,
    };
    const secondLegDetails: JourneyLeg = {
      lineName: secondResult.service,
      origin: transfer.name,
      destination: secondResult.destination,
      departureTime: secondResult.departureTime,
      arrivalTime: secondResult.arrivalTime,
      durationMinutes: minutesBetween(second.departureIso, second.arrivalIso),
      headsign: secondResult.headsign,
      mode: secondResult.trainType,
    };

    journeys.push({
      departureIso: first.departureIso,
      arrivalIso: second.arrivalIso,
      scheduleType: first.scheduleType || second.scheduleType,
      result: {
        id: `us-mbta-transfer-${date}-${journeys.length}`,
        country: "united_states",
        date,
        operator: "MBTA",
        service: `${firstResult.service} → ${secondResult.service}`,
        trainType: `${firstResult.trainType || "Rail"} → ${secondResult.trainType || "Bus"}`,
        durationMinutes: minutesBetween(first.departureIso, second.arrivalIso),
        departureTime: firstResult.departureTime,
        arrivalTime: secondResult.arrivalTime,
        origin: firstResult.origin,
        destination: secondResult.destination,
        direct: false,
        stops: [firstResult.origin, transfer.name, secondResult.destination],
        headsign: secondResult.headsign,
        realtime: false,
        legs: [firstLegDetails, secondLegDetails],
        transferStations: [transfer.name],
        warning: sameOperatorFareWarning([firstResult, secondResult]),
      },
    });
  }

  return journeys;
}

async function predictionsForStop(stopId: string) {
  return fetchMbtaJson(
    mbtaUrl("/predictions", {
      "filter[stop]": stopId,
      "filter[route_type]": RAIL_ROUTE_TYPES,
      include: "trip,route,stop",
      "page[limit]": "100",
      sort: "time",
    }),
  );
}

export async function searchMbtaJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  try {
    const [resolvedOrigin, resolvedDestination] = await Promise.all([
      resolveMbtaStation(origin),
      resolveMbtaStation(destination),
    ]);

    if (!resolvedOrigin || !resolvedDestination) {
      return {
        status: 400,
        body: {
          error: "Station not found",
          message: "MBTA could not resolve one or both station names.",
          results: [],
          source: MBTA_API_URL,
        },
      };
    }

    let scheduledJourneys: ScheduledJourney[] = [];
    let serviceDayAdvisory: ServiceDayAdvisory;
    const serviceDayCacheKey = `${resolvedOrigin.id}->${resolvedDestination.id}:${date}`;
    const selectedTime = time && /^\d{2}:\d{2}$/.test(time)
      ? time
      : date === dateInBoston() ? currentBostonTimeHHMM() : "00:00";
    try {
      const [originScheduleResponse, destinationScheduleResponse] = await Promise.all([
        schedulesForStop(resolvedOrigin.id, date),
        schedulesForStop(resolvedDestination.id, date),
      ]);
      let transferStation: MbtaStation | null = null;
      let transferScheduleResponse: MbtaResponse | null = null;
      if (resolvedOrigin.id === "place-harsq" && resolvedDestination.id === "17091") {
        transferStation = await resolveMbtaStation("South Station");
        if (transferStation) {
          transferScheduleResponse = await schedulesForStop(transferStation.id, date);
        }
      }
      const scheduleResponses = [
        originScheduleResponse,
        destinationScheduleResponse,
        ...(transferScheduleResponse ? [transferScheduleResponse] : []),
      ];
      const serviceIds = new Set(
        scheduleResponses.flatMap((response) => response.included || [])
          .filter((resource) => resource.type === "trip")
          .map((trip) => trip.relationships?.service?.data?.id)
          .filter((id): id is string => Boolean(id)),
      );
      let serviceMetadata = new Map<string, MbtaResource>();
      if (serviceIds.size > 0) {
        try {
          serviceMetadata = await servicesForIds(serviceIds);
        } catch (error) {
          void recordError({
            severity: "warning",
            module: "mbta",
            operation: "service-day.metadata",
            errorCode: "MBTA_SERVICE_METADATA_FAILED",
            error,
            country: "united_states",
            provider: MBTA_API_URL,
            context: { origin, destination, date },
          });
        }
      }
      scheduledJourneys = scheduledJourneysForRoute(
        originScheduleResponse,
        destinationScheduleResponse,
        resolvedOrigin,
        resolvedDestination,
        date,
        serviceMetadata,
      );
      if (scheduledJourneys.length === 0 && transferStation && transferScheduleResponse) {
        const firstLeg = scheduledJourneysForRoute(
          originScheduleResponse,
          transferScheduleResponse,
          resolvedOrigin,
          transferStation,
          date,
          serviceMetadata,
        );
        const secondLeg = scheduledJourneysForRoute(
          transferScheduleResponse,
          destinationScheduleResponse,
          transferStation,
          resolvedDestination,
          date,
          serviceMetadata,
        );
        scheduledJourneys = transferJourneysForRoute(firstLeg, secondLeg, transferStation, date);
      }
      serviceDayAdvisory = buildMbtaAdvisory(
        date,
        selectedTime,
        scheduledJourneys[0],
        scheduledJourneys.at(-1),
      );
      const first = scheduledJourneys[0];
      const last = scheduledJourneys.at(-1);
      if (first && last) {
        serviceDayCache.set(serviceDayCacheKey, { first, last });
      }
    } catch (error) {
      void recordError({
        severity: "error",
        module: "mbta",
        operation: "service-day.fetch",
        errorCode: "MBTA_SERVICE_DAY_FAILED",
        error,
        country: "united_states",
        provider: MBTA_API_URL,
        context: { origin, destination, date },
      });
      const cached = serviceDayCache.get(serviceDayCacheKey);
      serviceDayAdvisory = {
        ...(cached
          ? buildMbtaAdvisory(date, selectedTime, cached.first, cached.last)
          : buildMbtaAdvisory(date, selectedTime, undefined, undefined)),
        coverage: cached ? "stale" : "unavailable",
        note: cached
          ? "The last known service-day timetable is being shown while MBTA is unavailable."
          : "MBTA service-day information is temporarily unavailable.",
        checkedAt: new Date().toISOString(),
      };
    }

    if (date !== dateInBoston()) {
      return {
        status: scheduledJourneys.length > 0 ? 200 : 404,
        body: {
          results: scheduledJourneys.map((journey) => journey.result),
          message: scheduledJourneys.length > 0
            ? undefined
            : "MBTA returned no scheduled journeys for this station pair on the selected date.",
          source: MBTA_API_URL,
          serviceDayAdvisory,
        },
      };
    }

    // The airport itinerary is a scheduled two-leg journey. Predictions are
    // stop-local and cannot join Red Line and Silver Line trips, so preserve
    // the live schedule result for this route on today's date as well.
    if (scheduledJourneys.some((journey) => !journey.result.direct)) {
      return {
        status: 200,
        body: {
          results: scheduledJourneys.map((journey) => journey.result),
          source: MBTA_API_URL,
          serviceDayAdvisory,
        },
      };
    }

    const [originResponse, destinationResponse] = await Promise.all([
      predictionsForStop(resolvedOrigin.id),
      predictionsForStop(resolvedDestination.id),
    ]);
    const destinationByTrip = new Map<string, MbtaResource>();
    for (const prediction of destinationResponse.data || []) {
      const tripId = relationshipId(prediction, "trip");
      if (tripId && !destinationByTrip.has(tripId)) {
        destinationByTrip.set(tripId, prediction);
      }
    }

    const included = [...(originResponse.included || []), ...(destinationResponse.included || [])];
    const routes = resourceMap(included, "route");
    const trips = resourceMap(included, "trip");
    const stops = resourceMap(included, "stop");
    const seenTrips = new Set<string>();
    const results: TransitResult[] = [];

    for (const originPrediction of originResponse.data || []) {
      const tripId = relationshipId(originPrediction, "trip");
      const destinationPrediction = tripId ? destinationByTrip.get(tripId) : undefined;
      if (!tripId || !destinationPrediction || seenTrips.has(tripId)) continue;

      const originSequence = originPrediction.attributes?.stop_sequence;
      const destinationSequence = destinationPrediction.attributes?.stop_sequence;
      if (
        typeof originSequence !== "number" ||
        typeof destinationSequence !== "number" ||
        destinationSequence <= originSequence
      ) {
        continue;
      }

      const departureIso = originPrediction.attributes?.departure_time
        || originPrediction.attributes?.arrival_time;
      const arrivalIso = destinationPrediction.attributes?.arrival_time
        || destinationPrediction.attributes?.departure_time;
      const departureTime = timeInBoston(departureIso);
      const arrivalTime = timeInBoston(arrivalIso);
      if (!departureTime || !arrivalTime) continue;

      const route = routes.get(relationshipId(originPrediction, "route") || "");
      const trip = trips.get(tripId);
      const originStop = stops.get(relationshipId(originPrediction, "stop") || "");
      const destStop = stops.get(relationshipId(destinationPrediction, "stop") || "");

      const routeName = route?.attributes?.short_name
        || route?.attributes?.long_name
        || "MBTA Rail";
      const headsign = originPrediction.attributes?.trip_headsign
        || trip?.attributes?.headsign;

      seenTrips.add(tripId);
      results.push({
        id: `us-mbta-${tripId}-${originSequence}`,
        country: "united_states",
        operator: "MBTA",
        service: routeName,
        trainType: route?.attributes?.long_name || "Rail",
        durationMinutes: minutesBetween(departureIso, arrivalIso),
        departureTime,
        arrivalTime,
        origin: resolvedOrigin.name,
        originLat: originStop?.attributes?.latitude,
        originLng: originStop?.attributes?.longitude,
        destination: resolvedDestination.name,
        destLat: destStop?.attributes?.latitude,
        destLng: destStop?.attributes?.longitude,
        direct: true,
        stops: [],
        headsign,
        realtime: true,
        tags: originPrediction.attributes?.status
          ? [originPrediction.attributes.status]
          : undefined,
      });
      if (results.length >= 8) break;
    }

    if (results.length === 0 && scheduledJourneys.length > 0) {
      // MBTA publishes no predictions outside service hours (and none during a
      // prediction outage), but the schedules fetched above are real MBTA data
      // for this same date. Returning [] here discarded them and pushed the
      // scraper onto a curated snapshot, which is strictly worse data.
      return {
        status: 200,
        body: {
          results: scheduledJourneys.map((journey) => journey.result),
          source: MBTA_API_URL,
          serviceDayAdvisory,
        },
      };
    }

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0
          ? "MBTA returned no direct realtime predictions for this station pair."
          : undefined,
        source: MBTA_API_URL,
        serviceDayAdvisory,
      },
    };
  } catch (error) {
    void recordError({
      severity: "error",
      module: "mbta",
      operation: "journey.fetch",
      errorCode: "MBTA_JOURNEY_FAILED",
      error,
      country: "united_states",
      provider: MBTA_API_URL,
      context: { origin, destination, date },
    });
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: "Transit data is temporarily unavailable. Please try again later.",
        results: [],
        source: MBTA_API_URL,
      },
    };
  }
}
