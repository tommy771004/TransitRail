import { afterEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";

const originStop = "place-asmnl";
const destinationStop = "place-jfk";

function schedule(
  id: string,
  tripId: string,
  stopId: string,
  stopSequence: number,
  departureTime: string,
  arrivalTime: string,
) {
  return {
    id,
    type: "schedule",
    attributes: {
      departure_time: departureTime,
      arrival_time: arrivalTime,
      direction_id: 0,
      stop_sequence: stopSequence,
      pickup_type: 0,
      drop_off_type: 0,
    },
    relationships: {
      trip: { data: { id: tripId, type: "trip" } },
      route: { data: { id: "Red", type: "route" } },
      stop: { data: { id: stopId, type: "stop" } },
      service: { data: { id: "service-weekday", type: "service" } },
    },
  };
}

function mbtaIncluded(scheduleType = "Weekday") {
  return [
    {
      id: "Red",
      type: "route",
      attributes: { short_name: "Red", long_name: "Red Line", color: "DA291C" },
    },
    {
      id: "trip-morning",
      type: "trip",
      attributes: { headsign: "Alewife" },
      relationships: { service: { data: { id: "service-weekday", type: "service" } } },
    },
    {
      id: "trip-evening",
      type: "trip",
      attributes: { headsign: "Alewife" },
      relationships: { service: { data: { id: "service-weekday", type: "service" } } },
    },
    { id: originStop, type: "stop", attributes: { name: "Ashmont", latitude: 42.28, longitude: -71.06 } },
    { id: destinationStop, type: "stop", attributes: { name: "JFK/UMass", latitude: 42.32, longitude: -71.05 } },
    {
      id: "service-weekday",
      type: "service",
      attributes: {
        valid_days: [1, 2, 3, 4, 5],
        schedule_type: scheduleType,
        added_dates: [],
        removed_dates: [],
      },
    },
  ];
}

function prediction(
  id: string,
  tripId: string,
  stopId: string,
  stopSequence: number,
  departureTime: string,
  arrivalTime: string,
) {
  return {
    id,
    type: "prediction",
    attributes: {
      departure_time: departureTime,
      arrival_time: arrivalTime,
      direction_id: 0,
      stop_sequence: stopSequence,
      trip_headsign: "Alewife",
    },
    relationships: {
      trip: { data: { id: tripId, type: "trip" } },
      route: { data: { id: "Red", type: "route" } },
      stop: { data: { id: stopId, type: "stop" } },
    },
  };
}

function installMbtaFixtures(
  failSchedules = false,
  failPredictions = false,
  scheduleType = "Weekday",
  emptyPredictions = false,
) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname === "/stops") {
      return new Response(JSON.stringify({
        data: [
          { id: originStop, type: "stop", attributes: { name: "Ashmont" } },
          { id: destinationStop, type: "stop", attributes: { name: "JFK/UMass" } },
        ],
      }), { status: 200 });
    }

    if (url.pathname === "/schedules") {
      if (failSchedules) {
        return new Response(JSON.stringify({ errors: [{ detail: "fixture MBTA secret" }] }), { status: 503 });
      }
      if (url.searchParams.get("include") === "trip,route,stop,service") {
        return new Response(JSON.stringify({ errors: [{ detail: "service include is not supported" }] }), { status: 400 });
      }
      const stopId = url.searchParams.get("filter[stop]");
      const serviceDate = url.searchParams.get("filter[date]") || "2026-08-03";
      const data = stopId === originStop
        ? [
            schedule("schedule-morning-origin", "trip-morning", originStop, 1, `${serviceDate}T08:00:00-04:00`, `${serviceDate}T08:00:00-04:00`),
            schedule("schedule-evening-origin", "trip-evening", originStop, 1, `${serviceDate}T22:45:00-04:00`, `${serviceDate}T22:45:00-04:00`),
          ]
        : [
            schedule("schedule-morning-destination", "trip-morning", destinationStop, 3, `${serviceDate}T08:25:00-04:00`, `${serviceDate}T08:25:00-04:00`),
            schedule("schedule-evening-destination", "trip-evening", destinationStop, 3, `${serviceDate}T23:10:00-04:00`, `${serviceDate}T23:10:00-04:00`),
          ];
      return new Response(JSON.stringify({ data, included: mbtaIncluded(scheduleType) }), { status: 200 });
    }

    if (url.pathname === "/predictions") {
      if (failPredictions) {
        return new Response(JSON.stringify({ errors: [{ detail: "fixture MBTA secret" }] }), { status: 503 });
      }
      // What MBTA actually serves outside service hours: HTTP 200, no rows.
      if (emptyPredictions) {
        return new Response(JSON.stringify({ data: [], included: [] }), { status: 200 });
      }
      const stopId = url.searchParams.get("filter[stop]");
      const serviceDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const data = stopId === originStop
        ? [prediction("prediction-origin", "trip-live", originStop, 1, `${serviceDate}T22:00:00-04:00`, `${serviceDate}T22:00:00-04:00`)]
        : [prediction("prediction-destination", "trip-live", destinationStop, 3, `${serviceDate}T22:25:00-04:00`, `${serviceDate}T22:25:00-04:00`)];
      return new Response(JSON.stringify({ data, included: mbtaIncluded(scheduleType) }), { status: 200 });
    }

    if (url.pathname === "/routes") {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }

    if (url.pathname === "/services") {
      return new Response(JSON.stringify({
        data: [{
          id: "service-weekday",
          type: "service",
          attributes: {
            valid_days: [1, 2, 3, 4, 5],
            schedule_type: scheduleType,
            added_dates: [],
            removed_dates: [],
          },
        }],
      }), { status: 200 });
    }

    throw new Error(`Unexpected MBTA fixture request: ${url}`);
  }));
}

describe("runTransitSearch MBTA service-day advisory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns future-date schedule journeys and a weekday first/last advisory", async () => {
    installMbtaFixtures();

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: "2026-08-03",
      time: "22:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results).toHaveLength(2);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      serviceDate: "2026-08-03",
      timezone: "America/New_York",
      serviceDayType: "weekday",
      firstDeparture: "08:00",
      lastDeparture: "22:45",
      risk: "approaching",
      minutesToLastDeparture: 45,
      source: "https://api-v3.mbta.com",
    }));
  });

  it("keeps today's realtime results while adding the schedule advisory", async () => {
    installMbtaFixtures();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: today,
      time: "22:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results[0]?.realtime).toBe(true);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      serviceDate: today,
      firstDeparture: "08:00",
      lastDeparture: "22:45",
      risk: "approaching",
      minutesToLastDeparture: 45,
    }));
  });

  it("uses the operator's Saturday schedule type for a selected date", async () => {
    installMbtaFixtures(false, false, "Saturday");

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: "2026-08-01",
      time: "10:00",
    });

    expect(result.payload.serviceDayAdvisory?.serviceDayType).toBe("saturday");
  });

  it("keeps today's realtime results and marks the last good advisory stale", async () => {
    installMbtaFixtures(true);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: today,
      time: "22:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results[0]?.realtime).toBe(true);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "stale",
      firstDeparture: "08:00",
      lastDeparture: "22:45",
      risk: "approaching",
      minutesToLastDeparture: 45,
    }));
    expect(result.payload.message).toBeUndefined();
  });

  it("falls back to today's schedules when MBTA has no predictions to give", async () => {
    // The 22:00 UTC scrape can land outside Boston service hours, when MBTA
    // answers 200 with zero predictions. The schedules for that same date are
    // real data and must be returned rather than dropped, which previously
    // pushed the scraper onto a curated snapshot.
    installMbtaFixtures(false, false, "Weekday", true);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: today,
      time: "22:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results).toHaveLength(2);
    expect(result.payload.results.every((entry) => entry.realtime !== true)).toBe(true);
    expect(result.payload.message).toBeUndefined();
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      firstDeparture: "08:00",
      lastDeparture: "22:45",
    }));
  });

  it("returns a safe generic error when MBTA predictions fail", async () => {
    installMbtaFixtures(false, true);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const result = await runTransitSearch({
      origin: "Ashmont",
      destination: "JFK/UMass",
      country: "united_states",
      date: today,
      time: "22:00",
    });

    expect(result.statusCode).toBe(502);
    expect(result.payload.message).toBe("Transit data is temporarily unavailable. Please try again later.");
  });
});
