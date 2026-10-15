// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Where KTMB trains are right now, from the official data.gov.my GTFS
// Realtime vehicle-position feed, placed at the nearest KTMB station from the
// static feed. Realtime trip ids are the static trip ids, so a timetable row can
// find its own train. Nothing here moves a departure time.

import type { GtfsStop } from "./gtfs/feed";
import { decodeVehiclePositions, type RealtimeVehicle } from "./gtfsRealtime";
import { loadMalaysiaKtmbFeed } from "./malaysiaGtfs";

export const KTMB_VEHICLE_POSITIONS_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb";

/** Peninsular Malaysia plus the Woodlands shuttle; the feed has reported points near 0°, 0°. */
const SERVICE_AREA = { minLat: 1.0, maxLat: 7.0, minLon: 99.5, maxLon: 104.5 };
/** A report older than this no longer says where the train is. */
const MAX_REPORT_AGE_MS = 10 * 60_000;
/** Farther than this from every station, the train is between stations. */
const NEAR_STATION_KM = 2;

export interface LiveTrain {
  tripId: string;
  label?: string;
  /** Nearest station within reach, in the passenger-facing spelling. */
  nearStation?: string;
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

/** Trains that are plausibly where they say, recently; one row per trip. */
export function liveTrainsFrom(vehicles: readonly RealtimeVehicle[], stops: readonly GtfsStop[], now = new Date()): LiveTrain[] {
  const byTrip = new Map<string, LiveTrain>();
  for (const vehicle of vehicles) {
    if (!vehicle.tripId || !vehicle.reportedAt) continue;
    const { latitude, longitude } = vehicle;
    if (latitude < SERVICE_AREA.minLat || latitude > SERVICE_AREA.maxLat || longitude < SERVICE_AREA.minLon || longitude > SERVICE_AREA.maxLon) continue;
    const age = now.getTime() - Date.parse(vehicle.reportedAt);
    if (!(age <= MAX_REPORT_AGE_MS)) continue;
    const previous = byTrip.get(vehicle.tripId);
    if (previous && previous.reportedAt >= vehicle.reportedAt) continue;
    byTrip.set(vehicle.tripId, {
      tripId: vehicle.tripId,
      label: vehicle.label,
      nearStation: nearestStation(vehicle, stops),
      reportedAt: vehicle.reportedAt,
    });
  }
  return [...byTrip.values()];
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
    // Stations only name the place; without them the trains are still live.
    const stops = await loadMalaysiaKtmbFeed().then((static_) => static_.stops).catch(() => []);
    lastGood = { trains: liveTrainsFrom(feed.vehicles, stops, now), checkedAt: now.toISOString(), source: KTMB_VEHICLE_POSITIONS_URL };
    return lastGood;
  } catch (error) {
    if (!lastGood) throw error;
    // The previous answer, less any train whose report has since gone stale.
    const fresh = lastGood.trains.filter((train) => now.getTime() - Date.parse(train.reportedAt) <= MAX_REPORT_AGE_MS);
    return { ...lastGood, trains: fresh };
  }
}

// --- End of malaysiaLive.ts ---
