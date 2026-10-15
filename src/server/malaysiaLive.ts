// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Where KTMB trains are right now, from the official data.gov.my GTFS
// Realtime vehicle-position feed, placed at the nearest KTMB station from the
// static feed. Realtime trip ids are the static trip ids, so a timetable row can
// find its own train. Nothing here moves a departure time.

import { forEachGtfsCsvRow, type GtfsFeed, type GtfsStop } from "./gtfs/feed";
import { decodeVehiclePositions, type RealtimeVehicle } from "./gtfsRealtime";
import { loadMalaysiaKtmbFeed } from "./malaysiaGtfs";

export const KTMB_VEHICLE_POSITIONS_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb";

/** Peninsular Malaysia plus the Woodlands shuttle; the feed has reported points near 0°, 0°. */
const SERVICE_AREA = { minLat: 1.0, maxLat: 7.0, minLon: 99.5, maxLon: 104.5 };
/** A report older than this no longer says where the train is. */
const MAX_REPORT_AGE_MS = 10 * 60_000;
/** Farther than this from every station, the train is between stations. */
const NEAR_STATION_KM = 2;
/** Farther than this from every leg of its own trip, the position does not fit the trip. */
const ON_TRIP_KM = 15;

export interface LiveTrain {
  tripId: string;
  label?: string;
  /** Service as the static feed names its route, such as "ETS". */
  service?: string;
  /** First and last stations of the trip, in the passenger-facing spelling. */
  from?: string;
  to?: string;
  /** Nearest station within reach, in the passenger-facing spelling. */
  nearStation?: string;
  /** Otherwise, the two calling points of its own trip the train is between. */
  between?: [string, string];
  reportedAt: string;
}

export interface LiveTrainsResponse {
  trains: LiveTrain[];
  checkedAt: string;
  source: string;
}

/** "SUNGAI BULOH" → "Sungai Buloh"; short all-caps words such as "KL" stay as they are. */
export function ktmbStationName(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).map((word, index, words) => {
    const original = name.trim().split(/\s+/)[index];
    if (original.length <= 2 && words.length > 1) return original.toUpperCase();
    return word.replace(/(^|[-/(])([a-z])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
  }).join(" ");
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestStation(vehicle: Pick<RealtimeVehicle, "latitude" | "longitude">, stops: readonly GtfsStop[]): string | undefined {
  let best: { name: string; km: number } | undefined;
  for (const stop of stops) {
    if (stop.latitude === undefined || stop.longitude === undefined) continue;
    const km = distanceKm(vehicle.latitude, vehicle.longitude, stop.latitude, stop.longitude);
    if (!best || km < best.km) best = { name: stop.name, km };
  }
  return best && best.km <= NEAR_STATION_KM ? ktmbStationName(best.name) : undefined;
}

interface TripInfo {
  service?: string;
  from?: string;
  to?: string;
  /** Calling points in order, with coordinates, for placing a train between two of them. */
  calls?: Array<{ name: string; latitude: number; longitude: number }>;
}

/** Distance from a point to a short segment, on a flat local projection. */
function segmentDistanceKm(
  point: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const kmPerLat = 110.574;
  const kmPerLon = 111.32 * Math.cos((point.latitude * Math.PI) / 180);
  const ax = (a.longitude - point.longitude) * kmPerLon;
  const ay = (a.latitude - point.latitude) * kmPerLat;
  const bx = (b.longitude - point.longitude) * kmPerLon;
  const by = (b.latitude - point.latitude) * kmPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** The pair of consecutive calling points whose leg the train is on. */
export function betweenCalls(
  vehicle: { latitude: number; longitude: number },
  calls: TripInfo["calls"],
): [string, string] | undefined {
  let best: { pair: [string, string]; km: number } | undefined;
  for (let index = 1; index < (calls?.length ?? 0); index += 1) {
    const from = calls![index - 1];
    const to = calls![index];
    const km = segmentDistanceKm(vehicle, from, to);
    if (!best || km < best.km) best = { pair: [from.name, to.name], km };
  }
  return best && best.km <= ON_TRIP_KM ? best.pair : undefined;
}

const tripInfoCache = new WeakMap<GtfsFeed, Map<string, TripInfo>>();

/**
 * Each trip's service and end stations, read once per static feed. KTMB's
 * trips.txt carries no headsign, so the ends come from stop_times.
 */
export function ktmbTripInfo(feed: GtfsFeed): Map<string, TripInfo> {
  const cached = tripInfoCache.get(feed);
  if (cached) return cached;
  const callsByTrip = new Map<string, Array<[number, string]>>();
  forEachGtfsCsvRow(feed.stopTimes, (row) => {
    const sequence = Number(row.stop_sequence);
    if (!row.trip_id || !row.stop_id || !Number.isFinite(sequence)) return;
    const calls = callsByTrip.get(row.trip_id) || [];
    calls.push([sequence, row.stop_id]);
    callsByTrip.set(row.trip_id, calls);
  });
  const stopsById = new Map(feed.stops.map((stop) => [stop.id, stop]));
  const info = new Map<string, TripInfo>();
  for (const [tripId, trip] of feed.trips) {
    const route = trip.routeId ? feed.routes.get(trip.routeId) : undefined;
    const ordered = (callsByTrip.get(tripId) || [])
      .sort((a, b) => a[0] - b[0])
      .map(([, stopId]) => stopsById.get(stopId))
      .filter((stop): stop is GtfsStop => Boolean(stop));
    const named = (stop?: GtfsStop) => (stop ? ktmbStationName(stop.name) : undefined);
    info.set(tripId, {
      service: trip.shortName?.trim() || route?.shortName?.trim() || route?.longName?.trim() || undefined,
      from: named(ordered[0]),
      to: named(ordered[ordered.length - 1]),
      calls: ordered.flatMap((stop) => (
        stop.latitude === undefined || stop.longitude === undefined
          ? []
          : [{ name: ktmbStationName(stop.name), latitude: stop.latitude, longitude: stop.longitude }]
      )),
    });
  }
  tripInfoCache.set(feed, info);
  return info;
}

/** Trains that are plausibly where they say, recently; one row per trip. */
export function liveTrainsFrom(
  vehicles: readonly RealtimeVehicle[],
  stops: readonly GtfsStop[],
  now = new Date(),
  trips: ReadonlyMap<string, TripInfo> = new Map(),
): LiveTrain[] {
  const byTrip = new Map<string, LiveTrain>();
  for (const vehicle of vehicles) {
    if (!vehicle.tripId || !vehicle.reportedAt) continue;
    const { latitude, longitude } = vehicle;
    if (latitude < SERVICE_AREA.minLat || latitude > SERVICE_AREA.maxLat || longitude < SERVICE_AREA.minLon || longitude > SERVICE_AREA.maxLon) continue;
    const age = now.getTime() - Date.parse(vehicle.reportedAt);
    if (!(age <= MAX_REPORT_AGE_MS)) continue;
    const previous = byTrip.get(vehicle.tripId);
    if (previous && previous.reportedAt >= vehicle.reportedAt) continue;
    const { calls, ...trip } = trips.get(vehicle.tripId) || {};
    const nearStation = nearestStation(vehicle, stops);
    const between = nearStation ? undefined : betweenCalls(vehicle, calls);
    byTrip.set(vehicle.tripId, {
      tripId: vehicle.tripId,
      label: vehicle.label,
      ...trip,
      nearStation,
      ...(between ? { between } : {}),
      reportedAt: vehicle.reportedAt,
    });
  }
  // Grouped by service, trains the static feed does not know last.
  return [...byTrip.values()].sort((a, b) => (
    Number(!a.service) - Number(!b.service)
    || (a.service || "").localeCompare(b.service || "")
    || (a.label || a.tripId).localeCompare(b.label || b.tripId)
  ));
}

let lastGood: LiveTrainsResponse | undefined;

/**
 * Throws only when there has never been a good answer; otherwise a failed
 * read hands back the previous one, whose `checkedAt` says how old it is,
 * without the trains whose own reports have gone stale since.
 */
export async function getKtmbLiveTrains(now = new Date()): Promise<LiveTrainsResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let bytes: Uint8Array;
    try {
      const response = await fetch(KTMB_VEHICLE_POSITIONS_URL, {
        signal: controller.signal,
        headers: { Accept: "*/*", "User-Agent": "TransitRail/1.0" },
      });
      if (!response.ok) throw new Error(`KTMB vehicle positions returned HTTP ${response.status}.`);
      bytes = new Uint8Array(await response.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
    const feed = decodeVehiclePositions(bytes);
    // The static feed only names places and ends; without it the trains are still live.
    const staticFeed = await loadMalaysiaKtmbFeed().catch(() => undefined);
    lastGood = {
      trains: liveTrainsFrom(feed.vehicles, staticFeed?.stops ?? [], now, staticFeed ? ktmbTripInfo(staticFeed) : undefined),
      checkedAt: now.toISOString(),
      source: KTMB_VEHICLE_POSITIONS_URL,
    };
    return lastGood;
  } catch (error) {
    if (!lastGood) throw error;
    // The previous answer, less any train whose report has since gone stale.
    const fresh = lastGood.trains.filter((train) => now.getTime() - Date.parse(train.reportedAt) <= MAX_REPORT_AGE_MS);
    return { ...lastGood, trains: fresh };
  }
}

// --- End of malaysiaLive.ts ---
