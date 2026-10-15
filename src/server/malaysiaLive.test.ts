import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeVehiclePositions } from "./gtfsRealtime";
import { ktmbStationName, liveTrainsFrom, nearestStation } from "./malaysiaLive";
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
