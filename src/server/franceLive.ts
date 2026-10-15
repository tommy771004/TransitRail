// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: How today's SNCF trains are running, from the official GTFS Realtime
// trip-update feed on transport.data.gouv.fr: a delay or a cancellation at the
// passenger's own stations. Realtime trip ids are the static SNCF GTFS ids, so a
// timetable row finds its own train. Nothing here moves a departure time.

import { decodeTripUpdates, TRIP_CANCELED, type RealtimeTripUpdate } from "./gtfsRealtime";
import { FRANCE_REGISTER_IDS } from "./franceGtfs";

export const FRANCE_TRIP_UPDATES_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates";
/** SNCF refreshes the feed every two minutes; a read inside this is reused. */
const CACHE_MS = 60_000;

export interface FranceTripStatus {
  tripId: string;
  /** YYYY-MM-DD, the service day of the update. */
  date: string;
  cancelled?: boolean;
  /** Minutes late leaving the origin (negative: early); absent when SNCF gives no time there. */
  departureDelayMinutes?: number;
  arrivalDelayMinutes?: number;
  /** The train runs but will not call at this station. */
  originSkipped?: boolean;
  destinationSkipped?: boolean;
}

export interface FranceTripStatusResponse {
  trips: FranceTripStatus[];
  checkedAt: string;
  feedTimestamp?: string;
  source: string;
}

/** "StopArea:OCE87686006" → "87686006". */
export function franceStationUic(station: string): string | undefined {
  const id = FRANCE_REGISTER_IDS[station]?.[0];
  return id?.match(/(\d{8})$/)?.[1];
}

/** "StopPoint:OCETGV INOUI-87686006" → "87686006". */
const stopUic = (stopId: string | undefined) => stopId?.match(/(\d{8})$/)?.[1];

/**
 * SNCF states a delay only when there is one; a stop with a predicted time and
 * no delay is on time. A stop with neither says nothing.
 */
function delayMinutes(delay: number | undefined, at: string | undefined) {
  if (typeof delay === "number") return Math.round(delay / 60);
  return at ? 0 : undefined;
}

const isoDate = (yyyymmdd: string | undefined) => (
  yyyymmdd && /^\d{8}$/.test(yyyymmdd) ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` : undefined
);

/**
 * The trips calling at the origin, with what SNCF says about the origin and
 * destination. A cancelled trip carries no delay: its stops repeat a placeholder.
 * Added trains are not in the timetable, so they have no row to annotate.
 */
export function franceTripStatuses(updates: readonly RealtimeTripUpdate[], originUic: string, destinationUic?: string): FranceTripStatus[] {
  return updates.flatMap((update): FranceTripStatus[] => {
    const date = isoDate(update.startDate);
    if (!date) return [];
    const originIndex = update.stops.findIndex((stop) => stopUic(stop.stopId) === originUic);
    const destinationIndex = destinationUic ? update.stops.findIndex((stop) => stopUic(stop.stopId) === destinationUic) : -1;
    const origin = update.stops[originIndex];
    const destination = destinationIndex > originIndex ? update.stops[destinationIndex] : undefined;
    // A train ending at the origin, or calling at the destination first, is not one to board here.
    const boards = origin && (origin.skipped || origin.departureAt !== undefined || origin.departureDelay !== undefined)
      && (destinationIndex < 0 || destinationIndex > originIndex);
    if (update.scheduleRelationship === TRIP_CANCELED) {
      // The stop list says where it would have called; a bare cancellation is kept by id alone.
      return boards || update.stops.length === 0 ? [{ tripId: update.tripId, date, cancelled: true }] : [];
    }
    if (update.scheduleRelationship !== 0 || !boards) return [];
    const status: FranceTripStatus = { tripId: update.tripId, date };
    if (origin.skipped) status.originSkipped = true;
    else {
      const minutes = delayMinutes(origin.departureDelay ?? origin.arrivalDelay, origin.departureAt ?? origin.arrivalAt);
      if (minutes !== undefined) status.departureDelayMinutes = minutes;
    }
    if (destination?.skipped) status.destinationSkipped = true;
    else if (destination) {
      const minutes = delayMinutes(destination.arrivalDelay ?? destination.departureDelay, destination.arrivalAt ?? destination.departureAt);
      if (minutes !== undefined) status.arrivalDelayMinutes = minutes;
    }
    return [status];
  });
}

let cached: { at: number; feedTimestamp?: string; trips: RealtimeTripUpdate[] } | undefined;

async function readTripUpdates(now: Date) {
  if (cached && now.getTime() - cached.at < CACHE_MS) return cached;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let bytes: Uint8Array;
    try {
      const response = await fetch(FRANCE_TRIP_UPDATES_URL, {
        signal: controller.signal,
        headers: { Accept: "application/x-protobuf, */*", "User-Agent": "TransitRail/1.0" },
      });
      if (!response.ok) throw new Error(`SNCF trip updates returned HTTP ${response.status}.`);
      bytes = new Uint8Array(await response.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
    const feed = decodeTripUpdates(bytes);
    cached = { at: now.getTime(), feedTimestamp: feed.feedTimestamp, trips: feed.trips };
    return cached;
  } catch (error) {
    // The previous read stands, and its feed timestamp says how old it is.
    if (!cached) throw error;
    return cached;
  }
}

/** Throws only for an unknown station or when there has never been a good read. */
export async function getFranceTripStatus(origin: string, destination?: string, now = new Date()): Promise<FranceTripStatusResponse> {
  const originUic = franceStationUic(origin);
  if (!originUic) throw new RangeError(`No UIC code for ${origin}.`);
  const destinationUic = destination ? franceStationUic(destination) : undefined;
  const feed = await readTripUpdates(now);
  return {
    trips: franceTripStatuses(feed.trips, originUic, destinationUic),
    checkedAt: new Date(feed.at).toISOString(),
    feedTimestamp: feed.feedTimestamp,
    source: FRANCE_TRIP_UPDATES_URL,
  };
}

export function resetFranceTripStatusCache() {
  cached = undefined;
}

// --- End of franceLive.ts ---
