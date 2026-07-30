import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GERMANY_GTFS_URL,
  resetGermanyGtfsFeedCache,
  searchGermanyGtfs,
} from "./germanyGtfs";
import { germanyGtfsFixture } from "./gtfsZipFixture";

function stubFeed(bytes: Uint8Array = germanyGtfsFixture) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === GERMANY_GTFS_URL) {
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "application/zip" },
      });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchGermanyGtfs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetGermanyGtfsFeedCache();
  });

  it("builds timetable rows from a weekly calendar without date exceptions", async () => {
    stubFeed();
    const { status, body } = await searchGermanyGtfs(
      "Berlin Hbf",
      "Munich Hbf",
      "2026-08-03",
    );

    expect(status).toBe(200);
    expect(body.source).toBe("gtfs.de Long Distance Rail Germany");
    expect(body.results).toEqual([
      expect.objectContaining({
        id: "de-berlin-munich",
        country: "germany",
        operator: "DB / German rail operators",
        service: "ICE 100",
        departureTime: "23:45",
        arrivalTime: "04:10",
        durationMinutes: 265,
        origin: "Berlin Hbf",
        destination: "Munich Hbf",
        direct: true,
      }),
    ]);
    expect(body.results[0].price).toBeUndefined();
    expect(body.results[0].currency).toBeUndefined();
  });

  it("maps English route-list station names to the German feed names", async () => {
    stubFeed();
    const { status, body } = await searchGermanyGtfs(
      "Frankfurt Hbf",
      "Cologne Hbf",
      "2026-08-03",
    );

    expect(status).toBe(200);
    expect(body.results[0]).toMatchObject({
      service: "ICE 200",
      departureTime: "07:10",
      arrivalTime: "08:20",
    });
  });

  it("returns a provider error for a failed feed download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const { status, body } = await searchGermanyGtfs(
      "Berlin Hbf",
      "Munich Hbf",
      "2026-08-03",
    );

    expect(status).toBe(502);
    expect(body.error).toBe("GERMANY_GTFS_UNAVAILABLE");
    expect(body.results).toEqual([]);
  });
});
