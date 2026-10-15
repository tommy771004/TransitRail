import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeVehiclePositions } from "./gtfsRealtime";
import type { GtfsFeed } from "./gtfs/feed";
import { betweenCalls, ktmbStationName, ktmbTripInfo, liveTrainsFrom, nearestStation } from "./malaysiaLive";
import { withKtmbLivePositions } from "../hooks/useKtmbLiveTrains";
import type { TransitResult } from "../types";

// The official feed as served on 2026-10-15 at 07:33 UTC: seven ETS trains,
// one of them reporting a point beside 0°, 0°.
const feedBytes = new Uint8Array(readFileSync(new URL("./fixtures/ktmb-vehicle-positions-2026-10-15.pb", import.meta.url)));
const fedAt = new Date("2026-10-15T07:33:03Z");

const stops = [
  { id: "19000", name: "KUALA LUMPUR", latitude: 3.13945, longitude: 101.69378 },
  { id: "19100", name: "KL SENTRAL", latitude: 3.13427, longitude: 101.68629 },
  { id: "16400", name: "TANJONG MALIM", latitude: 3.68380, longitude: 101.51830 },
];

describe("GTFS Realtime vehicle positions", () => {
  it("decodes the official KTMB feed", () => {
    const feed = decodeVehiclePositions(feedBytes);
    expect(feed.feedTimestamp).toBe("2026-10-15T07:33:03.000Z");
    expect(feed.vehicles).toHaveLength(7);
    expect(feed.vehicles[0]).toMatchObject({ tripId: "9130", label: "ETS309", reportedAt: "2026-10-15T07:32:42.000Z" });
    expect(feed.vehicles[0].latitude).toBeCloseTo(4.2463, 3);
  });

  it("drops trains reported outside the service area or too long ago", () => {
    const { vehicles } = decodeVehiclePositions(feedBytes);
    const live = liveTrainsFrom(vehicles, stops, fedAt);
    expect(live.map((train) => train.tripId)).not.toContain("9428");
    expect(live).toHaveLength(6);
    expect(liveTrainsFrom(vehicles, stops, new Date("2026-10-15T08:00:00Z"))).toEqual([]);
  });
});

describe("KTMB live trains", () => {
  it("names the station a train is at, and none between stations", () => {
    expect(nearestStation({ latitude: 3.1390, longitude: 101.6935 }, stops)).toBe("Kuala Lumpur");
    expect(nearestStation({ latitude: 3.4000, longitude: 101.6000 }, stops)).toBeUndefined();
  });

  it("spells station names the way passengers read them", () => {
    expect(ktmbStationName("SUNGAI BULOH")).toBe("Sungai Buloh");
    expect(ktmbStationName("KL SENTRAL")).toBe("KL Sentral");
    expect(ktmbStationName("JB SENTRAL")).toBe("JB Sentral");
  });

  it("marks only today's row for the train on the feed, leaving its times alone", () => {
    const row = (id: string): TransitResult => ({
      id, country: "malaysia", operator: "KTMB", service: "ETS", origin: "Kuala Lumpur", destination: "Rawang",
      departureTime: "15:06", arrivalTime: "15:44", durationMinutes: 38, direct: true, stops: [],
    });
    const [today, other, tomorrow] = withKtmbLivePositions(
      [row("2026-10-15-my-ktmb-9052"), row("2026-10-15-my-ktmb-9056"), row("2026-10-16-my-ktmb-9052")],
      "2026-10-15",
      [{ tripId: "9052", nearStation: "Kuala Lumpur", reportedAt: "2026-10-15T07:32:42.000Z" }],
    );
    expect(today.livePosition).toEqual({ nearStation: "Kuala Lumpur", reportedAt: "2026-10-15T07:32:42.000Z" });
    expect(today.realtime).toBeUndefined();
    expect(today.departureTime).toBe("15:06");
    expect(other.livePosition).toBeUndefined();
    expect(tomorrow.livePosition).toBeUndefined();
  });
});

describe("KTMB trip ends", () => {
  const feed: GtfsFeed = {
    stops: [
      { id: "19100", name: "KL SENTRAL" },
      { id: "19000", name: "KUALA LUMPUR" },
      { id: "10000", name: "BUTTERWORTH" },
    ],
    trips: new Map([["9130", { serviceId: "ets", routeId: "ETS" }]]),
    routes: new Map([["ETS", { shortName: "ETS", longName: "Electric Train Service Padang Besar - JB Sentral" }]]),
    stopTimes: "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n9130,,14:00:00,19000,2\n9130,19:30:00,,10000,12\n9130,,13:55:00,19100,1\n",
    activeDates: new Map(),
  };

  it("reads the service and both end stations from stop_times", () => {
    expect(ktmbTripInfo(feed).get("9130")).toMatchObject({ service: "ETS", from: "KL Sentral", to: "Butterworth" });
  });

  it("attaches them to the live train and lists trains in service order", () => {
    const [first, second] = liveTrainsFrom([
      { entityId: "1", tripId: "9326", label: "ETS305", latitude: 3.75, longitude: 101.44, reportedAt: "2026-10-15T07:32:42.000Z" },
      { entityId: "0", tripId: "9130", label: "ETS309", latitude: 4.25, longitude: 101.18, reportedAt: "2026-10-15T07:32:42.000Z" },
    ], feed.stops, fedAt, ktmbTripInfo(feed));
    expect(first).toMatchObject({ tripId: "9130", service: "ETS", to: "Butterworth" });
    expect(second).toMatchObject({ tripId: "9326" });
    expect(second.service).toBeUndefined();
  });
});

describe("Placing a train between its own calling points", () => {
  const calls = [
    { name: "KL Sentral", latitude: 3.1343, longitude: 101.6863 },
    { name: "Rawang", latitude: 3.3190, longitude: 101.5750 },
    { name: "Ipoh", latitude: 4.5975, longitude: 101.0901 },
  ];

  it("names the leg the train is on", () => {
    expect(betweenCalls({ latitude: 3.9, longitude: 101.35 }, calls)).toEqual(["Rawang", "Ipoh"]);
    expect(betweenCalls({ latitude: 3.22, longitude: 101.63 }, calls)).toEqual(["KL Sentral", "Rawang"]);
  });

  it("says nothing when the position does not fit the trip", () => {
    expect(betweenCalls({ latitude: 2.2, longitude: 102.25 }, calls)).toBeUndefined();
    expect(betweenCalls({ latitude: 3.9, longitude: 101.35 }, [])).toBeUndefined();
  });
});
