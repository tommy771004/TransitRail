import { afterEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";

function journey(startDateTime: string, arrivalDateTime: string) {
  return {
    startDateTime,
    arrivalDateTime,
    duration: 20,
    legs: [
      {
        departureTime: startDateTime,
        arrivalTime: arrivalDateTime,
        duration: 20,
        mode: { name: "Tube" },
        departurePoint: { commonName: "Green Park" },
        arrivalPoint: { commonName: "Oxford Circus" },
        routeOptions: [{ lineIdentifier: { id: "victoria", name: "Victoria" } }],
        path: { stopPoints: [{ name: "Oxford Circus" }] },
      },
    ],
  };
}

function installLondonFixtures(
  lastStart = "2026-07-29T22:45:00Z",
  failServiceDay = false,
  failJourney = false,
) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname.startsWith("/StopPoint/Search/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop() || "");
      return new Response(JSON.stringify({
        matches: [{
          id: query === "Green Park" ? "940GZZLUGPK" : "940GZZLUOXC",
          name: query,
        }],
      }), { status: 200 });
    }

    if (url.pathname.startsWith("/Journey/JourneyResults/")) {
      const adjustment = url.searchParams.get("adjustment");
      if (failServiceDay && adjustment) {
        return new Response(JSON.stringify({ error: "fixture provider failure" }), { status: 503 });
      }
      if (failJourney && !adjustment) {
        return new Response(JSON.stringify({ error: "fixture provider secret" }), { status: 503 });
      }
      const selected = adjustment === "TripFirst"
        ? journey("2026-07-29T04:30:00Z", "2026-07-29T04:50:00Z")
        : adjustment === "TripLast"
          ? journey(lastStart, "2026-07-29T23:05:00Z")
          : journey("2026-07-29T08:00:00Z", "2026-07-29T08:20:00Z");
      return new Response(JSON.stringify({ journeys: [selected] }), { status: 200 });
    }

    if (url.pathname.startsWith("/Line/Mode/")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    throw new Error(`Unexpected TfL fixture request: ${url}`);
  }));
}

describe("runTransitSearch service-day advisory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns London's first and last complete journeys with a safe risk state", async () => {
    installLondonFixtures();

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-07-29",
      time: "22:30",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results).toHaveLength(1);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      serviceDate: "2026-07-29",
      timezone: "Europe/London",
      serviceDayType: "weekday",
      firstDeparture: "05:30",
      lastDeparture: "23:45",
      risk: "safe",
      minutesToLastDeparture: 75,
      source: "https://api.tfl.gov.uk",
    }));
  });

  it("marks a search within fifteen minutes of the final journey as critical", async () => {
    installLondonFixtures();

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-07-29",
      time: "23:30",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      risk: "critical",
      minutesToLastDeparture: 15,
    }));
  });

  it("keeps a post-midnight last departure on the originating service day", async () => {
    installLondonFixtures("2026-07-29T23:30:00Z");

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-07-29",
      time: "23:45",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      serviceDate: "2026-07-29",
      lastDeparture: "00:30",
      minutesToLastDeparture: 45,
      risk: "approaching",
    }));
  });

  it("classifies Saturday service in the transit market timezone", async () => {
    installLondonFixtures();

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-08-01",
      time: "10:00",
    });

    expect(result.payload.serviceDayAdvisory?.serviceDayType).toBe("saturday");
  });

  it("keeps ordinary journeys available when the service-day supplement fails", async () => {
    installLondonFixtures("2026-07-29T22:45:00Z", true);

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-08-02",
      time: "22:30",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results).toHaveLength(1);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "unavailable",
      risk: "unavailable",
      serviceDate: "2026-08-02",
    }));
    expect(result.payload.message).toBeUndefined();
  });

  it("labels a previously valid service-day advisory as stale during a later outage", async () => {
    installLondonFixtures();
    await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-07-29",
      time: "22:30",
    });

    installLondonFixtures("2026-07-29T22:45:00Z", true);
    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-07-29",
      time: "22:30",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "stale",
      firstDeparture: "05:30",
      lastDeparture: "23:45",
      risk: "safe",
    }));
  });

  it("returns a safe generic error when the ordinary provider journey fails", async () => {
    installLondonFixtures("2026-07-29T22:45:00Z", false, true);

    const result = await runTransitSearch({
      origin: "Green Park",
      destination: "Oxford Circus",
      country: "united_kingdom",
      date: "2026-09-01",
      time: "10:00",
    });

    expect(result.statusCode).toBe(502);
    expect(result.payload.message).toBe("Transit data is temporarily unavailable. Please try again later.");
    expect(result.payload.message).not.toContain("fixture provider secret");
  });
});
