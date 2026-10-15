// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Decodes the vehicle-position, trip-update and alert parts of a GTFS
// Realtime feed. The schema is the subset of the official gtfs-realtime.proto this app
// reads, with the spec's own field numbers; everything else in a feed is skipped.

import protobuf from "protobufjs";

const root = protobuf.Root.fromJSON({
  nested: {
    transit_realtime: {
      nested: {
        FeedMessage: { fields: { header: { type: "FeedHeader", id: 1 }, entity: { rule: "repeated", type: "FeedEntity", id: 2 } } },
        FeedHeader: { fields: { gtfsRealtimeVersion: { type: "string", id: 1 }, timestamp: { type: "uint64", id: 3 } } },
        FeedEntity: {
          fields: {
            id: { type: "string", id: 1 },
            isDeleted: { type: "bool", id: 2 },
            tripUpdate: { type: "TripUpdate", id: 3 },
            vehicle: { type: "VehiclePosition", id: 4 },
            alert: { type: "Alert", id: 5 },
          },
        },
        TripUpdate: {
          fields: {
            trip: { type: "TripDescriptor", id: 1 },
            stopTimeUpdate: { rule: "repeated", type: "StopTimeUpdate", id: 2 },
            timestamp: { type: "uint64", id: 4 },
            delay: { type: "int32", id: 5 },
          },
        },
        StopTimeUpdate: {
          fields: {
            stopSequence: { type: "uint32", id: 1 },
            arrival: { type: "StopTimeEvent", id: 2 },
            departure: { type: "StopTimeEvent", id: 3 },
            stopId: { type: "string", id: 4 },
            scheduleRelationship: { type: "uint32", id: 5 },
          },
        },
        StopTimeEvent: { fields: { delay: { type: "int32", id: 1 }, time: { type: "int64", id: 2 } } },
        Alert: {
          fields: {
            activePeriod: { rule: "repeated", type: "TimeRange", id: 1 },
            informedEntity: { rule: "repeated", type: "EntitySelector", id: 5 },
            cause: { type: "uint32", id: 6 },
            effect: { type: "uint32", id: 7 },
            headerText: { type: "TranslatedString", id: 10 },
            descriptionText: { type: "TranslatedString", id: 11 },
          },
        },
        TimeRange: { fields: { start: { type: "uint64", id: 1 }, end: { type: "uint64", id: 2 } } },
        EntitySelector: {
          fields: {
            agencyId: { type: "string", id: 1 },
            routeId: { type: "string", id: 2 },
            trip: { type: "TripDescriptor", id: 4 },
            stopId: { type: "string", id: 5 },
          },
        },
        TranslatedString: { fields: { translation: { rule: "repeated", type: "Translation", id: 1 } } },
        Translation: { fields: { text: { type: "string", id: 1 }, language: { type: "string", id: 2 } } },
        VehiclePosition: {
          fields: {
            trip: { type: "TripDescriptor", id: 1 },
            position: { type: "Position", id: 2 },
            currentStopSequence: { type: "uint32", id: 3 },
            currentStatus: { type: "uint32", id: 4 },
            timestamp: { type: "uint64", id: 5 },
            stopId: { type: "string", id: 7 },
            vehicle: { type: "VehicleDescriptor", id: 8 },
            occupancyStatus: { type: "uint32", id: 9 },
          },
        },
        TripDescriptor: {
          fields: {
            tripId: { type: "string", id: 1 },
            startTime: { type: "string", id: 2 },
            startDate: { type: "string", id: 3 },
            scheduleRelationship: { type: "uint32", id: 4 },
            routeId: { type: "string", id: 5 },
            directionId: { type: "uint32", id: 6 },
          },
        },
        Position: {
          fields: {
            latitude: { type: "float", id: 1 },
            longitude: { type: "float", id: 2 },
            bearing: { type: "float", id: 3 },
            speed: { type: "float", id: 5 },
          },
        },
        VehicleDescriptor: { fields: { id: { type: "string", id: 1 }, label: { type: "string", id: 2 } } },
      },
    },
  },
});

const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

export interface RealtimeVehicle {
  entityId: string;
  tripId?: string;
  routeId?: string;
  startDate?: string;
  vehicleId?: string;
  label?: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  /** Metres per second, as the spec defines it. */
  speed?: number;
  stopId?: string;
  /** When the vehicle reported this position, as an instant. */
  reportedAt?: string;
}

export interface RealtimeVehicleFeed {
  feedTimestamp?: string;
  vehicles: RealtimeVehicle[];
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const instant = (value: unknown) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
};

/** Vehicles with a usable position; deleted entities and missing coordinates are dropped. */
export function decodeVehiclePositions(bytes: Uint8Array): RealtimeVehicleFeed {
  const message = FeedMessage.toObject(FeedMessage.decode(bytes), { longs: String, defaults: false }) as {
    header?: { timestamp?: string };
    entity?: Array<{ id?: string; isDeleted?: boolean; vehicle?: Record<string, any> }>;
  };
  const vehicles = (message.entity || []).flatMap((entity): RealtimeVehicle[] => {
    const vehicle = entity.vehicle;
    const position = vehicle?.position;
    if (entity.isDeleted || !vehicle || !position) return [];
    const { latitude, longitude } = position;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return [];
    return [{
      entityId: entity.id || "",
      tripId: text(vehicle.trip?.tripId),
      routeId: text(vehicle.trip?.routeId),
      startDate: text(vehicle.trip?.startDate),
      vehicleId: text(vehicle.vehicle?.id),
      label: text(vehicle.vehicle?.label),
      latitude,
      longitude,
      bearing: Number.isFinite(position.bearing) ? position.bearing : undefined,
      speed: Number.isFinite(position.speed) ? position.speed : undefined,
      stopId: text(vehicle.stopId),
      reportedAt: instant(vehicle.timestamp),
    }];
  });
  return { feedTimestamp: instant(message.header?.timestamp), vehicles };
}

/** TripDescriptor.ScheduleRelationship values this app acts on. */
export const TRIP_ADDED = 1;
export const TRIP_CANCELED = 3;
/** StopTimeUpdate.ScheduleRelationship: the train will not call here. */
export const STOP_SKIPPED = 1;

export interface RealtimeStopUpdate {
  stopId?: string;
  stopSequence?: number;
  /** Seconds late (negative: early), as the provider states it; absent when not stated. */
  arrivalDelay?: number;
  departureDelay?: number;
  /** Predicted instants, when the provider gives times instead of (or as well as) delays. */
  arrivalAt?: string;
  departureAt?: string;
  skipped: boolean;
}

export interface RealtimeTripUpdate {
  tripId: string;
  /** YYYYMMDD, the service day the update belongs to. */
  startDate?: string;
  scheduleRelationship: number;
  stops: RealtimeStopUpdate[];
  updatedAt?: string;
}

export interface RealtimeAlert {
  id: string;
  cause?: number;
  effect?: number;
  header?: Record<string, string>;
  description?: Record<string, string>;
  tripIds: string[];
  stopIds: string[];
  activePeriods: Array<{ start?: string; end?: string }>;
}

const delaySeconds = (event: unknown) => {
  const value = (event as { delay?: unknown } | undefined)?.delay;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

function decodeEntities(bytes: Uint8Array) {
  const message = FeedMessage.toObject(FeedMessage.decode(bytes), { longs: String, defaults: false }) as {
    header?: { timestamp?: string };
    entity?: Array<{ id?: string; isDeleted?: boolean; tripUpdate?: Record<string, any>; alert?: Record<string, any> }>;
  };
  return { feedTimestamp: instant(message.header?.timestamp), entities: (message.entity || []).filter((entity) => !entity.isDeleted) };
}

/** Trip updates that name their trip; stop updates keep the provider's own stop ids. */
export function decodeTripUpdates(bytes: Uint8Array): { feedTimestamp?: string; trips: RealtimeTripUpdate[] } {
  const { feedTimestamp, entities } = decodeEntities(bytes);
  const trips = entities.flatMap((entity): RealtimeTripUpdate[] => {
    const update = entity.tripUpdate;
    const tripId = text(update?.trip?.tripId);
    if (!update || !tripId) return [];
    return [{
      tripId,
      startDate: text(update.trip?.startDate),
      scheduleRelationship: Number(update.trip?.scheduleRelationship) || 0,
      stops: (update.stopTimeUpdate || []).map((stop: Record<string, any>): RealtimeStopUpdate => ({
        stopId: text(stop.stopId),
        stopSequence: typeof stop.stopSequence === "number" ? stop.stopSequence : undefined,
        arrivalDelay: delaySeconds(stop.arrival),
        departureDelay: delaySeconds(stop.departure),
        arrivalAt: instant(stop.arrival?.time),
        departureAt: instant(stop.departure?.time),
        skipped: Number(stop.scheduleRelationship) === STOP_SKIPPED,
      })),
      updatedAt: instant(update.timestamp),
    }];
  });
  return { feedTimestamp, trips };
}

function translations(value: unknown): Record<string, string> | undefined {
  const list = (value as { translation?: Array<{ text?: string; language?: string }> } | undefined)?.translation || [];
  const entries = list.flatMap((item) => (text(item.text) ? [[item.language || "", item.text!.trim()] as const] : []));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function decodeAlerts(bytes: Uint8Array): { feedTimestamp?: string; alerts: RealtimeAlert[] } {
  const { feedTimestamp, entities } = decodeEntities(bytes);
  const alerts = entities.flatMap((entity): RealtimeAlert[] => {
    const alert = entity.alert;
    if (!alert) return [];
    const informed: Array<Record<string, any>> = alert.informedEntity || [];
    return [{
      id: entity.id || "",
      cause: typeof alert.cause === "number" ? alert.cause : undefined,
      effect: typeof alert.effect === "number" ? alert.effect : undefined,
      header: translations(alert.headerText),
      description: translations(alert.descriptionText),
      tripIds: informed.flatMap((item) => (text(item.trip?.tripId) ? [item.trip.tripId.trim()] : [])),
      stopIds: informed.flatMap((item) => (text(item.stopId) ? [item.stopId.trim()] : [])),
      activePeriods: (alert.activePeriod || []).map((period: Record<string, unknown>) => ({ start: instant(period.start), end: instant(period.end) })),
    }];
  });
  return { feedTimestamp, alerts };
}

// --- End of gtfsRealtime.ts ---
