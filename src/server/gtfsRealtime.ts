// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Decodes the vehicle-position part of a GTFS Realtime feed. The schema is
// the subset of the official gtfs-realtime.proto this app reads, with the spec's own
// field numbers; everything else in a feed is skipped by the decoder.

import protobuf from "protobufjs";

const root = protobuf.Root.fromJSON({
  nested: {
    transit_realtime: {
      nested: {
        FeedMessage: { fields: { header: { type: "FeedHeader", id: 1 }, entity: { rule: "repeated", type: "FeedEntity", id: 2 } } },
        FeedHeader: { fields: { gtfsRealtimeVersion: { type: "string", id: 1 }, timestamp: { type: "uint64", id: 3 } } },
        FeedEntity: { fields: { id: { type: "string", id: 1 }, isDeleted: { type: "bool", id: 2 }, vehicle: { type: "VehiclePosition", id: 4 } } },
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

// --- End of gtfsRealtime.ts ---
