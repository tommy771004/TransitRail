import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MALAYSIA_KTMB_GTFS_URL,
  resetMalaysiaKtmbGtfsFeedCache,
  searchMalaysiaKtmbGtfs,
} from "./malaysiaGtfs";
import { zipFixture } from "./gtfsZipFixture";

const fixture = zipFixture({
  "stops.txt": ["stop_id,stop_name", "rawang,Rawang", "kuala,Kuala Lumpur"].join("\n"),
  "trips.txt": ["route_id,service_id,trip_id,trip_short_name", "komuter,weekday,rawang-kl,KD 12"].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "rawang-kl,07:10:00,07:10:00,rawang,1",
    "rawang-kl,07:58:00,07:58:00,kuala,2",
  ].join("\n"),
  "calendar.txt": [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "weekday,1,1,1,1,1,0,0,20260101,20261231",
  ].join("\n"),
  "routes.txt": ["route_id,route_short_name,route_long_name", "komuter,KTM Komuter,Rawang - Kuala Lumpur"].join("\n"),
});

function stubFeed() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) !== MALAYSIA_KTMB_GTFS_URL) throw new Error(`Unexpected request: ${String(input)}`);
    return new Response(fixture, { status: 200, headers: { "content-type": "application/zip" } });
  }));
}

describe("searchMalaysiaKtmbGtfs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMalaysiaKtmbGtfsFeedCache();
  });

  it("returns exact departures only on service dates published by KTMB GTFS", async () => {
    stubFeed();
    const onService = await searchMalaysiaKtmbGtfs("Rawang", "Kuala Lumpur", "2026-08-03");
    const outsideCalendar = await searchMalaysiaKtmbGtfs("Rawang", "Kuala Lumpur", "2027-08-03");

    expect(onService.status).toBe(200);
    expect(onService.body.results).toEqual([expect.objectContaining({
      country: "malaysia",
      departureTime: "07:10",
      arrivalTime: "07:58",
      origin: "Rawang",
      destination: "Kuala Lumpur",
    })]);
    expect(outsideCalendar).toMatchObject({ status: 404, body: { error: "NO_SERVICE", results: [] } });
  });
});
