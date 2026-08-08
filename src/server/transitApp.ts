import type { Country } from "../types";
import { getStationCoordinatesForCountry, type GeoCoord } from "../utils/geoCoordinates";

const DEFAULT_BASE_URL = "https://external.transitapp.com/v4/public";
const CACHE_TTL_MS = 5 * 60_000;

const countryCodes: Record<Country, string> = {
  japan: "JP",
  korea: "KR",
  hong_kong: "HK",
  united_kingdom: "GB",
  united_states: "US",
  singapore: "SG",
  malaysia: "MY",
  thailand: "TH",
  germany: "DE",
  france: "FR",
  china: "CN",
  switzerland: "CH",
  belgium: "BE",
  norway: "NO",
};

export type TransitAppAvailability = "available" | "uncovered" | "unavailable" | "ambiguous";

export type TransitAppCoverage = {
  status: TransitAppAvailability;
  provider: "Transit";
  retrievedAt: string;
  country: Country;
  station: string;
  networkIds: string[];
  stopIds: string[];
  reason?: string;
};

export type TransitAppDeparture = {
  time?: string;
  route?: string;
  headsign?: string;
  cancelled?: boolean;
  terminal?: string;
};

export type TransitAppAlert = {
  title: string;
  description?: string;
  severity?: string;
};

export type TransitAppLiveContext = {
  status: TransitAppAvailability | "empty_live_data" | "error";
  provider: "Transit";
  retrievedAt: string;
  coverage: TransitAppCoverage;
  reason?: string;
  departures: TransitAppDeparture[];
  alerts: TransitAppAlert[];
  freshness?: string;
};

export type TransitAppPlanLeg = {
  mode?: string;
  route?: string;
  durationMinutes?: number;
  instructions?: string[];
};

export type TransitAppPlan = {
  status: TransitAppAvailability | "empty_live_data" | "error";
  kind: "third_party_plan";
  provider: "Transit";
  retrievedAt: string;
  reason?: string;
  itineraries?: Array<{ durationMinutes?: number; legs: TransitAppPlanLeg[]; fare?: string }>;
};

export type TransitAppScheduleComparison = {
  status: "available" | "unavailable";
  provider: "Transit";
  requestedDate: string;
  retrievedAt: string;
  reason?: string;
  departureCount?: number;
  returnedDate?: string;
  networkId?: string;
  freshness?: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Clock = () => Date;

type TransitAppClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  now?: Clock;
  coordinateForStation?: (station: string, country: Country) => GeoCoord | undefined;
};

type StationInput = { country: Country; station: string };
type PlanInput = { country: Country; origin: string; destination: string; accessibility?: "strict" | "prioritize_step_free" };
type ComparisonInput = { globalRouteId: string; globalStopId: string; date: string; allowedNetworkIds: string[] };

type CacheEntry = { expiresAt: number; value: TransitAppCoverage };

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function values(payload: unknown, names: string[]): unknown[] {
  const record = object(payload);
  for (const name of names) {
    const value = record?.[name];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function id(record: Record<string, unknown>, names: string[]): string | undefined {
  for (const name of names) {
    const value = text(record[name]);
    if (value) return value;
  }
  return undefined;
}

function normalizedStationName(value: string): string {
  return value
    .replace(/ Station| Underground Station| Railway Station/gi, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLocaleLowerCase();
}

function sameStation(left: string | undefined, right: string): boolean {
  return Boolean(left) && normalizedStationName(left!) === normalizedStationName(right);
}

function isoNow(now: Clock): string {
  return now().toISOString();
}

function providerTime(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  return text(value);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function fareText(value: Record<string, unknown>): string | undefined {
  const direct = object(value.fare);
  const candidates = [
    direct?.formatted,
    object(direct?.low_price)?.text,
    object(direct?.high_price)?.text,
    object(direct?.price_min)?.text,
    object(direct?.price_max)?.text,
    object(values(value, ["fares"])[0])?.low_price && object(object(values(value, ["fares"])[0])?.low_price)?.text,
    object(values(value, ["fares"])[0])?.price_min && object(object(values(value, ["fares"])[0])?.price_min)?.text,
  ];
  return candidates.map(text).find((candidate): candidate is string => Boolean(candidate));
}

function unavailableCoverage(input: StationInput, now: Clock, status: TransitAppAvailability, reason: string): TransitAppCoverage {
  return {
    status,
    provider: "Transit",
    retrievedAt: isoNow(now),
    country: input.country,
    station: input.station,
    networkIds: [],
    stopIds: [],
    reason,
  };
}

function parseJson(textBody: string): unknown {
  try {
    return JSON.parse(textBody);
  } catch {
    throw new Error("Transit App returned invalid JSON");
  }
}

/**
 * The only boundary for Transit App's third-party data.  Its output is never a
 * TransitResult, sourceMeta block, or service-day artifact, so callers cannot
 * accidentally turn an aggregator response into a verified timetable.
 */
export function createTransitAppClient(options: TransitAppClientOptions = {}) {
  // Read the environment lazily. ESM evaluates imports before server.ts calls
  // dotenv.config(), while Vercel already supplies it at process start.
  const apiKey = () => options.apiKey ?? process.env.TRANSIT_APP_API_KEY ?? "";
  const baseUrl = () => (options.baseUrl ?? process.env.TRANSIT_APP_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const coordinateForStation = options.coordinateForStation ?? ((station: string, country: Country) => getStationCoordinatesForCountry(country, station));
  const coverageCache = new Map<string, CacheEntry>();

  async function request(path: string, params: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    const key = apiKey();
    if (!key) throw new Error("TRANSIT_APP_NOT_CONFIGURED");
    const url = new URL(`${baseUrl()}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetcher(url, { headers: new Headers({ apiKey: key }) });
    const body = await response.text();
    if (!response.ok) throw new Error(`TRANSIT_APP_HTTP_${response.status}`);
    return parseJson(body);
  }

  async function resolveCoverage(input: StationInput): Promise<TransitAppCoverage> {
    if (!apiKey()) return unavailableCoverage(input, now, "unavailable", "integration_not_configured");
    const cacheKey = `${input.country}:${normalizedStationName(input.station)}`;
    const cached = coverageCache.get(cacheKey);
    if (cached && cached.expiresAt > now().getTime()) return cached.value;

    const coordinate = coordinateForStation(input.station, input.country);
    if (!coordinate) return unavailableCoverage(input, now, "uncovered", "missing_station_coordinate");

    try {
      const networkPayload = await request("available_networks", {
        lat: coordinate.lat,
        lon: coordinate.lng,
        country_code: countryCodes[input.country],
      });
      const networkIds = values(networkPayload, ["networks", "available_networks"])
        .flatMap((entry) => {
          const network = object(entry);
          if (!network || network.network_in_beta === true) return [];
          const networkId = id(network, ["global_network_id", "network_id", "id"]);
          return networkId ? [networkId] : [];
        });

      if (networkIds.length === 0) {
        const coverage = unavailableCoverage(input, now, "uncovered", "no_approved_network");
        coverageCache.set(cacheKey, { value: coverage, expiresAt: now().getTime() + CACHE_TTL_MS });
        return coverage;
      }

      const [stopPayload, ...networkStopPayloads] = await Promise.all([
        request("nearby_stops", { lat: coordinate.lat, lon: coordinate.lng }),
        ...networkIds.map((networkId) => request("stops_for_network", { network_id: networkId, lat: coordinate.lat, lon: coordinate.lng })),
      ]);
      const confirmedNetworkStopIds = new Set(networkStopPayloads.flatMap((payload) => values(payload, ["stops"]).flatMap((entry) => {
        const stop = object(entry);
        const stopId = stop && id(stop, ["global_stop_id", "stop_id", "id"]);
        return stopId ? [stopId] : [];
      })));
      const matchedStops = values(stopPayload, ["stops", "nearby_stops"])
        .flatMap((entry) => {
          const stop = object(entry);
          if (!stop || !sameStation(text(stop.name ?? stop.stop_name), input.station)) return [];
          const stopId = id(stop, ["global_stop_id", "stop_id", "id"]);
          const networkId = id(stop, ["global_network_id", "network_id"]);
          const parentId = id(object(stop.parent_station) ?? {}, ["global_stop_id", "stop_id", "id"]);
          return stopId && (confirmedNetworkStopIds.has(stopId) || (networkId !== undefined && networkIds.includes(networkId))) ? [{ stopId, parentId: parentId ?? stopId }] : [];
        });

      if (matchedStops.length === 0) {
        const coverage = unavailableCoverage(input, now, "uncovered", "no_matching_stop");
        coverageCache.set(cacheKey, { value: coverage, expiresAt: now().getTime() + CACHE_TTL_MS });
        return coverage;
      }
      if (new Set(matchedStops.map((stop) => stop.parentId)).size > 1) {
        return unavailableCoverage(input, now, "ambiguous", "ambiguous_stop_match");
      }

      const coverage: TransitAppCoverage = {
        status: "available",
        provider: "Transit",
        retrievedAt: isoNow(now),
        country: input.country,
        station: input.station,
        networkIds: [...new Set(networkIds)],
        stopIds: [...new Set(matchedStops.map((stop) => stop.stopId))],
      };
      coverageCache.set(cacheKey, { value: coverage, expiresAt: now().getTime() + CACHE_TTL_MS });
      return coverage;
    } catch {
      return unavailableCoverage(input, now, "unavailable", "provider_unavailable");
    }
  }

  async function getLiveContext(input: StationInput): Promise<TransitAppLiveContext> {
    const coverage = await resolveCoverage(input);
    if (coverage.status !== "available") {
      return { status: coverage.status, provider: "Transit", retrievedAt: isoNow(now), coverage, reason: coverage.reason, departures: [], alerts: [] };
    }
    try {
      const [departurePayload, alertsPayload, freshnessPayload] = await Promise.all([
        request("stop_departures", { global_stop_ids: coverage.stopIds.join(","), should_update_realtime: true }),
        request("alerts_for_networks", { network_ids: coverage.networkIds.join(","), show_active_alerts_only: true }).catch(() => ({ alerts: [] })),
        request("latest_update_for_network", { network_id: coverage.networkIds[0] }).catch(() => ({})),
      ]);
      const directDepartures = values(departurePayload, ["departures", "stop_departures"]);
      const groupedDepartures = values(departurePayload, ["route_departures"]).flatMap((route) =>
        values(route, ["merged_itineraries", "itineraries"]).flatMap((itinerary) =>
          values(itinerary, ["schedule_items"]).map((item) => ({
            ...object(item),
            route_name: object(route)?.route_name ?? object(route)?.route_short_name,
            headsign: object(itinerary)?.headsign ?? object(itinerary)?.merged_headsign,
          })),
        ),
      );
      const departures = [...directDepartures, ...groupedDepartures].flatMap((entry) => {
        const item = object(entry);
        if (!item) return [];
        return [{
          time: providerTime(item.departure_time ?? item.departureTime ?? item.scheduled_departure_time),
          route: text(item.route_name ?? item.route ?? item.route_short_name),
          headsign: text(item.headsign ?? item.trip_headsign),
          ...(item.cancelled === true || item.is_cancelled === true ? { cancelled: true } : {}),
          ...(text(item.terminal_name ?? item.terminal) ? { terminal: text(item.terminal_name ?? item.terminal) } : {}),
        }];
      });
      const alerts = [...values(departurePayload, ["alerts"]), ...values(alertsPayload, ["alerts"])]
        .flatMap((entry) => {
          const item = object(entry);
          const title = item && text(item.title ?? item.header ?? item.alert_header);
          return title ? [{ title, ...(text(item?.description ?? item?.body) ? { description: text(item?.description ?? item?.body) } : {}), ...(text(item?.severity) ? { severity: text(item?.severity) } : {}) }] : [];
        });
      const freshness = providerTime(object(freshnessPayload)?.time ?? object(departurePayload)?.latest_update_time ?? object(departurePayload)?.updated_at);
      return {
        status: departures.length || alerts.length ? "available" : "empty_live_data",
        provider: "Transit",
        retrievedAt: isoNow(now),
        coverage,
        ...(departures.length || alerts.length ? {} : { reason: "provider_returned_no_live_data" }),
        departures,
        alerts,
        ...(freshness ? { freshness } : {}),
      };
    } catch {
      return { status: "error", provider: "Transit", retrievedAt: isoNow(now), coverage, reason: "provider_unavailable", departures: [], alerts: [] };
    }
  }

  async function planJourney(input: PlanInput): Promise<TransitAppPlan> {
    const [origin, destination] = await Promise.all([
      resolveCoverage({ country: input.country, station: input.origin }),
      resolveCoverage({ country: input.country, station: input.destination }),
    ]);
    const retrievedAt = isoNow(now);
    if (origin.status !== "available" || destination.status !== "available") {
      return { status: origin.status === "unavailable" || destination.status === "unavailable" ? "unavailable" : "uncovered", kind: "third_party_plan", provider: "Transit", retrievedAt, reason: "endpoint_not_covered" };
    }
    try {
      const payload = await request("plan", {
        from_global_stop_ids: origin.stopIds.join(","),
        to_global_stop_ids: destination.stopIds.join(","),
        allowed_networks: [...new Set([...origin.networkIds, ...destination.networkIds])].join(","),
        should_update_realtime: true,
        should_include_directions: true,
        should_include_pathways: true,
        consider_downtimes: true,
        ...(input.accessibility ? { accessibility_need: input.accessibility } : {}),
      });
      const itineraries = values(payload, ["results", "itineraries", "plans", "journeys"]).map((entry) => {
        const itinerary = object(entry) ?? {};
        const durationSeconds = itinerary.duration ?? itinerary.duration_seconds ?? itinerary.durationSeconds;
        const durationMinutes = typeof durationSeconds === "number" ? Math.round(durationSeconds / 60) : undefined;
        const legs = values(itinerary, ["legs", "segments"]).map((leg) => {
          const value = object(leg) ?? {};
          const legSeconds = value.duration ?? value.duration_seconds ?? value.durationSeconds;
          const directions = list(value.directions).flatMap((direction) => text(object(direction)?.instruction ?? object(direction)?.text) ? [text(object(direction)?.instruction ?? object(direction)?.text)!] : []);
          return {
            mode: text(value.leg_mode ?? value.mode ?? value.mode_name),
            route: text(value.route_name ?? value.route),
            ...(typeof legSeconds === "number" ? { durationMinutes: Math.round(legSeconds / 60) } : {}),
            ...(directions.length ? { instructions: directions } : {}),
          };
        });
        const fare = fareText(itinerary);
        return { ...(durationMinutes !== undefined ? { durationMinutes } : {}), legs, ...(fare ? { fare } : {}) };
      });
      return itineraries.length
        ? { status: "available", kind: "third_party_plan", provider: "Transit", retrievedAt, itineraries }
        : { status: "empty_live_data", kind: "third_party_plan", provider: "Transit", retrievedAt, reason: "provider_returned_no_plan" };
    } catch {
      return { status: "error", kind: "third_party_plan", provider: "Transit", retrievedAt, reason: "provider_unavailable" };
    }
  }

  async function compareSchedule(input: ComparisonInput): Promise<TransitAppScheduleComparison> {
    const retrievedAt = isoNow(now);
    if (!isCalendarDate(input.date)) {
      return { status: "unavailable", provider: "Transit", requestedDate: input.date, retrievedAt, reason: "invalid_requested_date" };
    }
    if (!apiKey()) return { status: "unavailable", provider: "Transit", requestedDate: input.date, retrievedAt, reason: "integration_not_configured" };
    try {
      const routeDetails = await request("route_details", { global_route_id: input.globalRouteId });
      const route = object(object(routeDetails)?.route);
      const networkId = text(route?.route_network_id ?? route?.network_id);
      if (!networkId || !input.allowedNetworkIds.includes(networkId)) {
        return { status: "unavailable", provider: "Transit", requestedDate: input.date, retrievedAt, reason: "preview_schedule_network_unconfirmed" };
      }
      const payload = await request("schedule_for_dates", { global_route_id: input.globalRouteId, global_stop_id: input.globalStopId, dates: input.date });
      const schedules = values(payload, ["itineraries"]).flatMap((itinerary) => values(itinerary, ["schedules"]));
      const scheduledTrips = schedules
        .filter((schedule) => text(object(schedule)?.date) === input.date)
        .flatMap((schedule) => values(schedule, ["trips"]));
      const total = scheduledTrips.length;
      if (total === 0) {
        return {
          status: "unavailable",
          provider: "Transit",
          requestedDate: input.date,
          retrievedAt,
          reason: schedules.length ? "preview_schedule_date_unconfirmed" : "preview_schedule_empty",
        };
      }
      const freshnessPayload = await request("latest_update_for_network", { network_id: networkId }).catch(() => ({}));
      const freshness = providerTime(object(freshnessPayload)?.time);
      if (!freshness) {
        return { status: "unavailable", provider: "Transit", requestedDate: input.date, retrievedAt, reason: "preview_schedule_freshness_unknown", networkId };
      }
      return { status: "available", provider: "Transit", requestedDate: input.date, returnedDate: input.date, retrievedAt, networkId, freshness, departureCount: total };
    } catch {
      return { status: "unavailable", provider: "Transit", requestedDate: input.date, retrievedAt, reason: "preview_schedule_unavailable" };
    }
  }

  async function auditStations(country: Country, stations: readonly string[]) {
    // The audit can span a large national catalog. Deliberate sequential work
    // keeps an operator run from turning a coverage check into a provider
    // burst; the runtime cache still avoids repeat discovery for aliases.
    const coverage: TransitAppCoverage[] = [];
    for (const station of stations) {
      coverage.push(await resolveCoverage({ country, station }));
    }
    const counts = coverage.reduce<Record<TransitAppAvailability, number>>((summary, item) => {
      summary[item.status] += 1;
      return summary;
    }, { available: 0, uncovered: 0, unavailable: 0, ambiguous: 0 });
    return { provider: "Transit" as const, country, retrievedAt: isoNow(now), counts, stations: coverage };
  }

  return { resolveCoverage, getLiveContext, planJourney, compareSchedule, auditStations };
}

export const transitAppClient = createTransitAppClient();
