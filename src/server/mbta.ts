import type { SearchResponse, TransitResult } from "../types";

const MBTA_API_URL = "https://api-v3.mbta.com";
const RAIL_ROUTE_TYPES = "0,1,2";
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
    departure_time?: string | null;
    direction_id?: number;
    headsign?: string;
    location_type?: number;
    long_name?: string;
    municipality?: string;
    name?: string;
    platform_code?: string;
    short_name?: string;
    status?: string | null;
    stop_sequence?: number;
    trip_headsign?: string;
  };
  relationships?: {
    parent_station?: MbtaRelationship;
    route?: MbtaRelationship;
    stop?: MbtaRelationship;
    trip?: MbtaRelationship;
  };
}

interface MbtaResponse {
  data?: MbtaResource[];
  included?: MbtaResource[];
}

interface MbtaStation {
  id: string;
  name: string;
  municipality?: string;
}

let stationCache: { expiresAt: number; stations: MbtaStation[] } | null = null;

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

async function loadMbtaStations() {
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

async function resolveMbtaStation(query: string) {
  const stations = await loadMbtaStations();
  const normalizedQuery = normalizeStationName(query);
  const exact = stations.find((station) => normalizeStationName(station.name) === normalizedQuery);
  if (exact) return exact;
  return stations.find((station) => normalizeStationName(station.name).includes(normalizedQuery)) || null;
}

export async function getMbtaStations() {
  const stations = await loadMbtaStations();
  return stations.map((station) => station.name);
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
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  if (date !== dateInBoston()) {
    return {
      status: 400,
      body: {
        error: "Live date required",
        message: "MBTA live prediction search currently supports today's Boston date only.",
        results: [],
        source: MBTA_API_URL,
      },
    };
  }

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
        destination: resolvedDestination.name,
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

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0
          ? "MBTA returned no direct realtime predictions for this station pair."
          : undefined,
        source: MBTA_API_URL,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: error instanceof Error ? error.message : "Could not reach MBTA.",
        results: [],
        source: MBTA_API_URL,
      },
    };
  }
}
