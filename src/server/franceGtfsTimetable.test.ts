import { afterEach, describe, expect, it, vi } from "vitest";
import { FRANCE_GTFS_URL, resetFranceGtfsFeedCache, searchFranceGtfs } from "./franceGtfs";
import { franceGtfsFixture as gtfsFixture } from "./gtfsZipFixture";

function stubFeed(bytes: Uint8Array = gtfsFixture) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === FRANCE_GTFS_URL) {
      return new Response(bytes, { status: 200, headers: { "content-type": "application/zip" } });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchFranceGtfs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetFranceGtfsFeedCache();
  });

  it("builds departures from the published calendar", async () => {
    stubFeed();
    const { status, body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");

    expect(status).toBe(200);
    expect(body.source).toBe("SNCF Open Data GTFS");
    expect(body.results).toHaveLength(3);
    expect(body.results.map((result) => result.departureTime)).toEqual(["07:34", "08:00", "23:50"]);
    expect(body.results[1]).toMatchObject({
      country: "france",
      operator: "SNCF",
      // route_type 101 + the train number from trip_headsign, not the internal
      // route code the feed puts in route_short_name.
      service: "TGV 6611",
      departureTime: "08:00",
      arrivalTime: "09:55",
      durationMinutes: 115,
      direct: true,
    });
  });

  // The curated snapshot repeated one invented fare across every departure;
  // SNCF's GTFS ships no fare_attributes, so emitting nothing is the honest
  // outcome and the route page renders without a price.
  it("names the service by brand and train number, never the internal route code", async () => {
    stubFeed();
    const { body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");
    const labels = body.results.map((result) => result.service);

    expect(labels).toEqual(["TER 17769", "TGV 6611", "TGV 6607"]);
    // "601A"/"K7" are route ids, meaningless to a passenger.
    expect(labels.join(" ")).not.toMatch(/601A|K7/);
    // A numeric trip_headsign is the train number, not a destination.
    for (const result of body.results) expect(result.headsign).toBeUndefined();
  });

  it("emits no fare, because the feed carries none", async () => {
    stubFeed();
    const { body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");

    for (const result of body.results) {
      expect(result.price).toBeUndefined();
      expect(result.currency).toBeUndefined();
    }
  });

  it("renders a service crossing midnight on the wall clock, with a real duration", async () => {
    stubFeed();
    const { body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");
    const overnight = body.results.find((result) => result.departureTime === "23:50");

    // 23:50 → 25:15 in GTFS terms.
    expect(overnight?.arrivalTime).toBe("01:15");
    expect(overnight?.durationMinutes).toBe(85);
  });

  it("drops a service the calendar cancels for that date", async () => {
    stubFeed();
    const { body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");

    expect(body.results.map((result) => result.id)).not.toContain("fr-trip-cancelled");
  });

  // The live run fell back on every date for this route because "Paris Gare de
  // l'Est" and the feed's "Paris Est" share no substring in either direction.
  it("resolves a station the feed names the operator's way", async () => {
    stubFeed();
    const { status, body } = await searchFranceGtfs("Paris Gare de l'Est", "Strasbourg", "2026-08-03");

    expect(status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      service: "TGV 2401",
      departureTime: "06:55",
      arrivalTime: "08:41",
      durationMinutes: 106,
    });
  });

  // Only 1-2 Paris → Marseille departures survived the live run, which tripped
  // the thin-content guard and deleted the page entirely.
  it("matches a station the feed spells out where the route list abbreviates", async () => {
    stubFeed();
    const { status, body } = await searchFranceGtfs("Paris Gare de Lyon", "Marseille St-Charles", "2026-08-03");

    expect(status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ service: "TGV 6171", departureTime: "07:14", durationMinutes: 246 });
  });

  it("does not match a different station that shares a word", async () => {
    stubFeed();
    const { status } = await searchFranceGtfs("Paris Gare du Nord", "Strasbourg", "2026-08-03");

    // Only Paris Est exists in the fixture; Nord must not borrow its stops.
    expect(status).toBe(404);
  });

  it("reports no service for a date the feed does not cover, so the scrape falls back", async () => {
    stubFeed();
    const { status, body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2027-01-01");

    expect(status).toBe(404);
    expect(body.error).toBe("NO_SERVICE");
    expect(body.results).toEqual([]);
  });

  it("reports the download failure rather than throwing into the scraper", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const { status, body } = await searchFranceGtfs("Paris Gare de Lyon", "Lyon Part-Dieu", "2026-08-03");

    expect(status).toBe(502);
    expect(body.error).toBe("SNCF_GTFS_UNAVAILABLE");
    expect(body.results).toEqual([]);
  });
});
