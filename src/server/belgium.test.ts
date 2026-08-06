import { afterEach, describe, expect, it, vi } from "vitest";
import { searchBelgiumJourney } from "./belgium";

const STATIONS = {
  station: [
    { id: "BE.NMBS.BRUGGE", name: "Brugge", standardname: "Brugge" },
    { id: "BE.NMBS.LIEGE", name: "Liège-Guillemins", standardname: "Liège-Guillemins" },
  ],
};

const CONNECTIONS = {
  connection: [{
    id: "IC504",
    // 04:58 → 07:02 in Europe/Brussels on 2026-08-06: 124 minutes.
    departure: {
      station: "Brugge",
      stationinfo: { name: "Brugge", locationX: "3.216726", locationY: "51.197226" },
      time: String(Date.parse("2026-08-06T02:58:00Z") / 1000),
      vehicle: "IC504",
      vehicleinfo: { shortname: "IC 504", type: "IC" },
    },
    arrival: {
      station: "Liège-Guillemins",
      stationinfo: { name: "Liège-Guillemins", locationX: "5.566695", locationY: "50.62455" },
      time: String(Date.parse("2026-08-06T05:02:00Z") / 1000),
    },
    // iRail has returned a stale value here; it is 121 minutes, not the
    // 124-minute elapsed time represented by the endpoint timestamps.
    duration: "7260",
  }],
};

describe("searchBelgiumJourney", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses endpoint elapsed time when iRail duration disagrees", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      const body = calls <= 2 ? STATIONS : CONNECTIONS;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const response = await searchBelgiumJourney("Brugge", "Liège-Guillemins", "2026-08-06");

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      departureTime: "04:58",
      arrivalTime: "07:02",
      durationMinutes: 124,
    });
  });
});
