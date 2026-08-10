import { describe, expect, it } from "vitest";
import {
  buildMbtaBrowserResults,
  mbtaNoRouteHorizon,
  parseMbtaTimeRange,
  sameMbtaServiceDate,
  type MbtaBrowserJourneySummary,
} from "./mbtaBrowser";

describe("MBTA official Trip Planner browser scraper", () => {
  it("parses MBTA 12-hour ranges, including the omitted meridiem around noon", () => {
    expect(parseMbtaTimeRange("9:06 – 10:02 am")).toEqual({
      departureTime: "09:06",
      arrivalTime: "10:02",
    });
    expect(parseMbtaTimeRange("11:45 – 12:40 pm")).toEqual({
      departureTime: "11:45",
      arrivalTime: "12:40",
    });
  });

  it("keeps only available, rail-backed itineraries returned by the page", () => {
    const samples: MbtaBrowserJourneySummary[] = [
      {
        departureTime: "09:06",
        arrivalTime: "09:51",
        durationMinutes: 46,
        services: ["Green Line B Branch"],
        modes: ["subway"],
        price: 2.4,
        unavailable: true,
      },
      {
        departureTime: "09:06",
        arrivalTime: "10:02",
        durationMinutes: 55,
        services: ["Red Line", "Bus 86"],
        modes: ["subway", "bus"],
        price: 2.4,
      },
      {
        departureTime: "09:06",
        arrivalTime: "10:02",
        durationMinutes: 55,
        services: ["Red Line", "Bus 86"],
        modes: ["subway", "bus"],
        price: 2.4,
      },
      {
        departureTime: "09:15",
        arrivalTime: "10:05",
        services: ["Bus 57"],
        modes: ["bus"],
      },
    ];

    const results = buildMbtaBrowserResults(
      "Park Street",
      "Boston College",
      "2026-08-13",
      samples,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      country: "united_states",
      date: "2026-08-13",
      service: "Red Line + Bus 86",
      trainType: "subway + bus",
      departureTime: "09:06",
      arrivalTime: "10:02",
      price: 2.4,
      currency: "USD",
      direct: false,
      realtime: false,
    });
    expect(results[0].warning).toMatch(/includes a bus or walking transfer/);
    expect(results[0].id).toMatch(/^2026-08-13-us-mbta-browser-0906-1002-/);
  });

  it("does not stamp an after-midnight result with the previous query date", () => {
    const journeys: MbtaBrowserJourneySummary[] = [
      {
        departureTime: "23:18",
        arrivalTime: "23:59",
        services: ["Green Line B Branch"],
        modes: ["subway"],
      },
      {
        departureTime: "00:42",
        arrivalTime: "01:48",
        services: ["Orange Line", "Green Line B Branch"],
        modes: ["subway"],
      },
    ];

    expect(sameMbtaServiceDate("23:00", journeys)).toEqual([journeys[0]]);
  });

  it("uses the official no-route search window to cross a service gap", () => {
    expect(mbtaNoRouteHorizon(
      "No transit routes found within 2 hours of 1:15 am. Routes may be available at other times.",
    )).toBe(120);
    expect(mbtaNoRouteHorizon("No transit routes found within 30 minutes.")).toBe(30);
  });
});
