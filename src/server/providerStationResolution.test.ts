import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTflStationResolutionCache, searchTflJourney } from "./tfl";
import { searchMbtaJourney } from "./mbta";

/**
 * Both cases come straight from the first scrape run that logged its fallback
 * reasons:
 *
 *   scraper.provider.fallback · united_kingdom · TfL · HTTP 400 ·
 *     TfL could not resolve one or both station names ·
 *     {"origin":"Paddington Station","destination":"Liverpool Street Station"}
 *   scraper.provider.fallback · united_states · MBTA · HTTP 400 ·
 *     MBTA could not resolve one or both station names ·
 *     {"origin":"Harvard","destination":"Logan International Airport"}
 *
 * Neither was a rate limit. Both were names the provider does not use.
 */

afterEach(() => vi.unstubAllGlobals());

describe("TfL station resolution", () => {
  // Resolution is memoized for a long-lived process, and every case here counts
  // the lookups its own stub receives.
  beforeEach(() => resetTflStationResolutionCache());

  /** TfL's word-based search finds nothing for a "Station" suffix the network
   *  does not use, but resolves the bare name. */
  function installTflSearch(searched: string[]) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith("/StopPoint/Search/")) {
        const query = decodeURIComponent(url.pathname.replace("/StopPoint/Search/", ""));
        searched.push(query);
        const matches = /^(paddington|liverpool street)$/i.test(query)
          ? [{ id: `940GZZLU${query.replace(/\s/g, "").toUpperCase()}`, name: `${query} Underground Station` }]
          : [];
        return new Response(JSON.stringify({ matches }), { status: 200 });
      }
      if (url.pathname.startsWith("/Journey/JourneyResults/")) {
        return new Response(JSON.stringify({ journeys: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));
  }

  it("retries without a Station suffix the network does not use", async () => {
    const searched: string[] = [];
    installTflSearch(searched);

    const { body } = await searchTflJourney("Paddington Station", "Liverpool Street Station", "2026-08-03");

    expect(searched).toContain("Paddington Station");
    expect(searched).toContain("paddington");
    // The old failure mode: resolution gave up and reported a 400.
    expect(body.error).not.toBe("Station not found");
  });

  it("does not spend a second request when the raw name already resolves", async () => {
    const searched: string[] = [];
    installTflSearch(searched);

    await searchTflJourney("Paddington", "Liverpool Street", "2026-08-03");

    expect(searched).toEqual(["Paddington", "Liverpool Street"]);
  });

  it("retries a HUB interchange with a child Underground StopPoint", async () => {
    const searched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith("/StopPoint/Search/")) {
        const query = decodeURIComponent(url.pathname.replace("/StopPoint/Search/", ""));
        searched.push(query);
        const normalized = query.toLowerCase();
        if (normalized === "paddington") return new Response(JSON.stringify({ matches: [{ id: "HUBPAD", name: "Paddington" }] }), { status: 200 });
        if (normalized === "liverpool street") return new Response(JSON.stringify({ matches: [{ id: "HUBLST", name: "Liverpool Street" }] }), { status: 200 });
        if (normalized === "paddington underground station") return new Response(JSON.stringify({ matches: [{ id: "940GZZLUPAC", name: "Paddington Underground Station" }] }), { status: 200 });
        if (normalized === "liverpool street underground station") return new Response(JSON.stringify({ matches: [{ id: "940GZZLULVT", name: "Liverpool Street Underground Station" }] }), { status: 200 });
      }
      if (url.pathname.startsWith("/Journey/JourneyResults/")) {
        return new Response(JSON.stringify({ journeys: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    const { status, body } = await searchTflJourney("Paddington", "Liverpool Street", "2026-08-03");

    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(searched).toContain("paddington Underground Station");
    expect(searched).toContain("liverpool street Underground Station");
  });
});

describe("MBTA station resolution", () => {
  function installMbtaStops() {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/stops") {
        // MBTA's real catalogue: the Blue Line stop for Boston Logan is
        // "Airport". Nothing in it contains "Logan".
        return new Response(JSON.stringify({
          data: [
            { id: "place-harsq", type: "stop", attributes: { name: "Harvard" } },
            { id: "place-aport", type: "stop", attributes: { name: "Airport" } },
          ],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [], included: [] }), { status: 200 });
    }));
  }

  it("resolves the airport by the name travellers use", async () => {
    installMbtaStops();

    const { body } = await searchMbtaJourney("Harvard", "Logan International Airport", "2026-08-03");

    expect(body.error).not.toBe("Station not found");
  });

  it("still rejects a station the network genuinely does not serve", async () => {
    installMbtaStops();

    const { status, body } = await searchMbtaJourney("Harvard", "Gatwick Airport", "2026-08-03");

    expect(status).toBe(400);
    expect(body.results).toEqual([]);
  });

  it("joins Harvard to the airport terminal through South Station", async () => {
    const service = {
      id: "service-weekday",
      type: "service",
      attributes: { schedule_type: "Weekday" },
    };
    const included = [
      { id: "Red", type: "route", attributes: { short_name: "Red", long_name: "Red Line" } },
      { id: "741", type: "route", attributes: { short_name: "SL1", long_name: "Logan Airport Terminals - South Station" } },
      { id: "red-trip", type: "trip", attributes: { headsign: "Ashmont" }, relationships: { service: { data: { id: service.id } } } },
      { id: "sl1-trip", type: "trip", attributes: { headsign: "Logan Airport" }, relationships: { service: { data: { id: service.id } } } },
      { id: "place-harsq", type: "stop", attributes: { name: "Harvard" } },
      { id: "place-sstat", type: "stop", attributes: { name: "South Station" } },
      { id: "17091", type: "stop", attributes: { name: "Terminal A" } },
    ];
    const schedule = (id: string, trip: string, stop: string, sequence: number, time: string) => ({
      id,
      type: "schedule",
      attributes: { departure_time: `${time}-04:00`, arrival_time: `${time}-04:00`, stop_sequence: sequence },
      relationships: {
        trip: { data: { id: trip } },
        route: { data: { id: trip === "red-trip" ? "Red" : "741" } },
        stop: { data: { id: stop } },
      },
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/stops") {
        return new Response(JSON.stringify({ data: [
          { id: "place-harsq", attributes: { name: "Harvard" } },
          { id: "place-sstat", attributes: { name: "South Station" } },
        ] }), { status: 200 });
      }
      if (url.pathname === "/schedules") {
        const stop = url.searchParams.get("filter[stop]");
        const data = stop === "place-harsq"
          ? [schedule("h1", "red-trip", "place-harsq", 1, "2026-08-03T08:00:00")]
          : stop === "place-sstat"
            ? [schedule("r1", "red-trip", "place-sstat", 5, "2026-08-03T08:12:00"), schedule("s1", "sl1-trip", "place-sstat", 1, "2026-08-03T08:20:00")]
            : [schedule("a1", "sl1-trip", "17091", 10, "2026-08-03T08:38:00")];
        return new Response(JSON.stringify({ data, included }), { status: 200 });
      }
      if (url.pathname === "/services") {
        return new Response(JSON.stringify({ data: [service] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [], included: [] }), { status: 200 });
    }));

    const { status, body } = await searchMbtaJourney("Harvard", "Logan International Airport", "2026-08-03");

    expect(status).toBe(200);
    expect(body.results[0]).toMatchObject({
      direct: false,
      transferStations: ["South Station"],
      service: "Red → SL1",
    });
    expect(body.results[0]?.legs).toHaveLength(2);
  });
});
