import { describe, expect, it, vi } from "vitest";
import { createOdptTimetableProvider } from "./odptTimetable";

const weekdayTrain = {
  "odpt:calendar": "odpt.Calendar:Weekday",
  "odpt:railway": "odpt.Railway:Toei.Oedo",
  "odpt:trainNumber": "1001A",
  "odpt:railDirection": "odpt.RailDirection:InnerLoop",
  "odpt:destinationStation": ["odpt.Station:Toei.Oedo.Tochomae"],
  "odpt:trainTimetableObject": [
    {
      "odpt:departureTime": "10:24",
      "odpt:departureStation": "odpt.Station:Toei.Oedo.Shinjuku",
    },
    {
      "odpt:arrivalTime": "10:33",
      "odpt:arrivalStation": "odpt.Station:Toei.Oedo.Roppongi",
    },
  ],
};

describe("ODPT scheduled timetable provider", () => {
  it("uses the token-free Toei public endpoint and builds real journeys", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify([
      weekdayTrain,
      { ...weekdayTrain, "odpt:calendar": "odpt.Calendar:SaturdayHoliday" },
    ]), { status: 200 }));
    const search = createOdptTimetableProvider({ fetcher });

    const response = await search("Shinjuku", "Roppongi", "2026-08-03");

    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toContain("api-public.odpt.org/api/v4");
    expect(String(fetcher.mock.calls[0][0])).not.toContain("consumerKey");
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      operator: "Toei Subway",
      departureTime: "10:24",
      arrivalTime: "10:33",
      durationMinutes: 9,
      service: "Toei Oedo Line",
    });
    expect(response.body.results[0].price).toBeUndefined();
    expect(response.body.results[0].realtime).toBeUndefined();
  });

  it("does not call Tokyo Metro when the scheduled job has no API key", async () => {
    const fetcher = vi.fn();
    const search = createOdptTimetableProvider({ fetcher, apiKey: "" });

    const response = await search("Shibuya", "Asakusa", "2026-08-03");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("ODPT_KEY_MISSING");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never reverses a train whose destination appears before the origin", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify([weekdayTrain]), { status: 200 }));
    const search = createOdptTimetableProvider({ fetcher });

    const response = await search("Roppongi", "Shinjuku", "2026-08-03");

    expect(response.status).toBe(404);
    expect(response.body.results).toEqual([]);
  });
});
