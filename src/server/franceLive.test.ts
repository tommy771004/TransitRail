import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeTripUpdates } from "./gtfsRealtime";
import { franceStationUic, franceTripStatuses, getFranceTripStatus, resetFranceTripStatusCache } from "./franceLive";
import { withFranceTripStatus } from "../hooks/useFranceTripStatus";
import type { TransitResult } from "../types";

// Seven entities from the official feed as served on 2026-10-15 at 08:07 UTC, bytes
// untouched: TGV 7829 (40 min late leaving Paris), TGV 6103 (on time, no delay field),
// TGV 5300 (late at Lyon), a cancelled TER, a TER skipping a stop, an added train, and
// an overnight Intercités that started on the 14th.
const feedBytes = new Uint8Array(readFileSync(new URL("./fixtures/sncf-trip-updates-2026-10-15.pb", import.meta.url)));
const PARIS_LYON = "87686006";
const MARSEILLE = "87751008";
const late7829 = "OCESN7829F1187_F:OGO:FR:Line::EB6C44B3-0091-46B2-94A4-A3CC5B1CA889::87686006:87751008:4:924:20261018";
const onTime6103 = "OCESN6103F1187_F:OUI:FR:Line::BAF1DE9A-72EC-4064-8BE9-C4EFF292CB6A::87686006:87751008:4:1057:20261015";

afterEach(() => {
  vi.unstubAllGlobals();
  resetFranceTripStatusCache();
});

describe("SNCF GTFS Realtime trip updates", () => {
  it("decodes the official feed with delays, predicted times and relationships", () => {
    const feed = decodeTripUpdates(feedBytes);
    expect(feed.feedTimestamp).toBe("2026-10-15T08:07:43.000Z");
    expect(feed.trips).toHaveLength(7);
    const late = feed.trips.find((trip) => trip.tripId === late7829);
    expect(late?.stops[0]).toMatchObject({ stopId: "StopPoint:OCEOUIGO-87686006", departureDelay: 2400, departureAt: "2026-10-15T04:43:00.000Z" });
    expect(feed.trips.map((trip) => trip.scheduleRelationship).sort()).toEqual([0, 0, 0, 0, 0, 1, 3]);
  });

  it("reads the station code from the route list's own spelling", () => {
    expect(franceStationUic("Paris Gare de Lyon")).toBe(PARIS_LYON);
    expect(franceStationUic("Marseille St-Charles")).toBe(MARSEILLE);
    expect(franceStationUic("Nowhere")).toBeUndefined();
  });

  it("states the delay at the passenger's own stations, and on time when SNCF gives a time and no delay", () => {
    const statuses = franceTripStatuses(decodeTripUpdates(feedBytes).trips, PARIS_LYON, MARSEILLE);
    expect(statuses).toEqual([
      { tripId: late7829, date: "2026-10-15", departureDelayMinutes: 40, arrivalDelayMinutes: 50 },
      { tripId: onTime6103, date: "2026-10-15", departureDelayMinutes: 0, arrivalDelayMinutes: 0 },
    ]);
  });

  it("uses the departure delay where a train both arrives and leaves late", () => {
    const [status] = franceTripStatuses(decodeTripUpdates(feedBytes).trips, "87723197");
    expect(status).toMatchObject({ date: "2026-10-15", departureDelayMinutes: 35 });
  });

  it("marks a cancellation without the placeholder delay its stops repeat", () => {
    const statuses = franceTripStatuses(decodeTripUpdates(feedBytes).trips, "87755009");
    const cancelled = statuses.find((status) => status.cancelled);
    expect(cancelled).toEqual({ tripId: expect.stringMatching(/^OCESN881677F/), date: "2026-10-15", cancelled: true });
  });

  it("marks a stop the train will not call at, without its placeholder delay", () => {
    const statuses = franceTripStatuses(decodeTripUpdates(feedBytes).trips, "87751776");
    expect(statuses).toEqual([{ tripId: expect.stringMatching(/^OCESN881611F/), date: "2026-10-15", originSkipped: true }]);
  });

  it("leaves added trains out, since no timetable row is theirs", () => {
    const statuses = franceTripStatuses(decodeTripUpdates(feedBytes).trips, MARSEILLE, PARIS_LYON);
    expect(statuses.some((status) => status.tripId.startsWith("OCESN6138F"))).toBe(false);
  });

  it("keeps an overnight train on the day it started", () => {
    const [status] = franceTripStatuses(decodeTripUpdates(feedBytes).trips, "87547000");
    expect(status).toMatchObject({ date: "2026-10-14", departureDelayMinutes: 10 });
  });
});

describe("France trip status endpoint", () => {
  const now = new Date("2026-10-15T08:08:00Z");
  const ok = () => new Response(feedBytes, { status: 200 });

  it("answers a station pair from one read of the feed", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const first = await getFranceTripStatus("Paris Gare de Lyon", "Marseille St-Charles", now);
    await getFranceTripStatus("Lyon Part-Dieu", undefined, new Date(now.getTime() + 30_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ checkedAt: now.toISOString(), feedTimestamp: "2026-10-15T08:07:43.000Z" });
    expect(first.trips).toHaveLength(2);
  });

  it("keeps the last good read when SNCF fails, and fails only without one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(getFranceTripStatus("Paris Gare de Lyon", undefined, now)).rejects.toThrow("HTTP 503");
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    await getFranceTripStatus("Paris Gare de Lyon", undefined, now);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const kept = await getFranceTripStatus("Paris Gare de Lyon", undefined, new Date(now.getTime() + 5 * 60_000));
    expect(kept.checkedAt).toBe(now.toISOString());
    expect(kept.trips).toHaveLength(2);
  });

  it("refuses a station without an SNCF code", async () => {
    await expect(getFranceTripStatus("Nowhere")).rejects.toBeInstanceOf(RangeError);
  });
});

describe("France rows learn their train's status", () => {
  const row = (tripId: string, date = "2026-10-15"): TransitResult => ({
    id: `${date}-fr-${tripId}`, country: "france", date, operator: "SNCF", service: "Train", departureTime: "06:03",
    origin: "Paris Gare de Lyon", destination: "Marseille St-Charles", direct: true, stops: [],
  });

  it("matches by stored row id and service day, leaving times as published", () => {
    const checkedAt = "2026-10-15T08:08:00.000Z";
    const [late, onTime, otherDay] = withFranceTripStatus(
      [row(late7829), row(onTime6103), row(late7829, "2026-10-16")],
      [
        { tripId: late7829, date: "2026-10-15", departureDelayMinutes: 40, arrivalDelayMinutes: 50 },
        { tripId: onTime6103, date: "2026-10-15", departureDelayMinutes: 0 },
      ],
      checkedAt,
    );
    expect(late.liveStatus).toEqual({ checkedAt, delayMinutes: 40, arrivalDelayMinutes: 50 });
    expect(late.departureTime).toBe("06:03");
    expect(late.realtime).toBeUndefined();
    expect(onTime.liveStatus).toEqual({ checkedAt, delayMinutes: 0 });
    expect(otherDay.liveStatus).toBeUndefined();
  });
});
