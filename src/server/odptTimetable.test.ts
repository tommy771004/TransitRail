import { describe, expect, it, vi } from "vitest";
import { createOdptTimetableProvider } from "./odptTimetable";

/** One Oedo run, timed at every station the way ODPT publishes it. */
const weekdayTrain = {
  "odpt:calendar": "odpt.Calendar:Weekday",
  "odpt:railway": "odpt.Railway:Toei.Oedo",
  "odpt:trainNumber": "1001A",
  "odpt:railDirection": "odpt.RailDirection:InnerLoop",
  "odpt:destinationStation": ["odpt.Station:Toei.Oedo.ShinjukuNishiguchi"],
  "odpt:trainTimetableObject": [
    {
      "odpt:departureTime": "10:00",
      "odpt:departureStation": "odpt.Station:Toei.Oedo.Hikarigaoka",
    },
    {
      "odpt:arrivalTime": "10:02",
      "odpt:departureTime": "10:03",
      "odpt:departureStation": "odpt.Station:Toei.Oedo.Nerimakasugacho",
      "odpt:arrivalStation": "odpt.Station:Toei.Oedo.Nerimakasugacho",
    },
    {
      "odpt:arrivalTime": "10:20",
      "odpt:departureTime": "10:21",
      "odpt:departureStation": "odpt.Station:Toei.Oedo.Roppongi",
      "odpt:arrivalStation": "odpt.Station:Toei.Oedo.Roppongi",
    },
    {
      "odpt:arrivalTime": "10:24",
      "odpt:arrivalStation": "odpt.Station:Toei.Oedo.ShinjukuNishiguchi",
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

    const response = await search("Hikarigaoka", "Shinjuku-nishiguchi", "2026-08-03");

    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toContain("api-public.odpt.org/api/v4");
    expect(String(fetcher.mock.calls[0][0])).not.toContain("consumerKey");
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      operator: "Toei Subway",
      departureTime: "10:00",
      arrivalTime: "10:24",
      durationMinutes: 24,
      service: "Toei Oedo Line",
    });
    expect(response.body.results[0].price).toBeUndefined();
    expect(response.body.results[0].realtime).toBeUndefined();
  });

  it("publishes a leg for every hop, so the stations between the terminals are searchable", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([weekdayTrain]), { status: 200 }));
    const search = createOdptTimetableProvider({ fetcher });

    const [result] = (await search("Hikarigaoka", "Shinjuku-nishiguchi", "2026-08-03")).body.results;

    expect(result.legs).toEqual([
      expect.objectContaining({
        lineName: "Toei Oedo Line",
        origin: "Hikarigaoka",
        destination: "Nerima-kasugacho",
        departureTime: "10:00",
        arrivalTime: "10:02",
        durationMinutes: 2,
      }),
      expect.objectContaining({
        origin: "Nerima-kasugacho",
        destination: "Roppongi",
        departureTime: "10:03",
        arrivalTime: "10:20",
        durationMinutes: 17,
      }),
      expect.objectContaining({
        origin: "Roppongi",
        destination: "Shinjuku-nishiguchi",
        departureTime: "10:21",
        arrivalTime: "10:24",
        durationMinutes: 3,
      }),
    ]);
  });

  it("names intermediate stops the way the line map does, not the way the id is spelled", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([weekdayTrain]), { status: 200 }));
    const search = createOdptTimetableProvider({ fetcher });

    const [result] = (await search("Hikarigaoka", "Shinjuku-nishiguchi", "2026-08-03")).body.results;

    // `Nerimakasugacho` is the feed's romaji; the picker offers the station as
    // `Nerima-kasugacho`, and search matches on the name.
    expect(result.stops).toEqual(["Hikarigaoka", "Nerima-kasugacho", "Roppongi", "Shinjuku-nishiguchi"]);
  });

  it("binds a configured station to its train whatever the id's casing", async () => {
    const camelCased = {
      ...weekdayTrain,
      "odpt:railway": "odpt.Railway:Toei.Asakusa",
      "odpt:trainTimetableObject": [
        {
          "odpt:departureTime": "06:10",
          "odpt:departureStation": "odpt.Station:Toei.Asakusa.NishiMagome",
        },
        {
          "odpt:arrivalTime": "06:45",
          "odpt:arrivalStation": "odpt.Station:Toei.Asakusa.Oshiage",
        },
      ],
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify([camelCased]), { status: 200 }));
    const search = createOdptTimetableProvider({ fetcher });

    const response = await search("Nishi-magome", "Oshiage", "2026-08-03");

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      origin: "Nishi-magome",
      destination: "Oshiage",
      departureTime: "06:10",
      arrivalTime: "06:45",
    });
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

    const response = await search("Shinjuku-nishiguchi", "Hikarigaoka", "2026-08-03");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("ODPT_ROUTE_NOT_FOUND");
    expect(response.body.results).toEqual([]);
  });
});
