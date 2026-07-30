import { afterEach, describe, expect, it, vi } from "vitest";
import { searchTflJourney } from "./tfl";
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
});
