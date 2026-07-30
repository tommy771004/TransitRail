import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareSwissGtfsBatch,
  resetSwissGtfsFeedCache,
  searchSwissGtfs,
  SWISS_GTFS_CATALOG_URL,
} from "./swissGtfs";
import { germanyGtfsFixture } from "./gtfsZipFixture";

function stubCatalogAndFeed(feed = germanyGtfsFixture) {
  const zipUrl = "https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020/download/gtfs_fp2026_20260729.zip";
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === SWISS_GTFS_CATALOG_URL) {
      return new Response(`<a href="${zipUrl}">GTFS</a>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (String(input) === zipUrl) {
      return new Response(feed, {
        status: 200,
        headers: { "content-type": "application/zip" },
      });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchSwissGtfs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSwissGtfsFeedCache();
  });

  it("discovers the current ZIP from the public catalog and builds rows", async () => {
    stubCatalogAndFeed();
    const { status, body } = await searchSwissGtfs(
      "Berlin Hbf",
      "München Hbf",
      "2026-08-03",
    );

    expect(status).toBe(200);
    expect(body.source).toBe("OpenTransportData Swiss GTFS Static");
    expect(body.results[0]).toMatchObject({
      country: "switzerland",
      operator: "Swiss public transport operators",
      service: "100",
      departureTime: "23:45",
      arrivalTime: "04:10",
    });
  });

  it("returns a provider error when the catalog has no current ZIP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>No feed</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })));

    const { status, body } = await searchSwissGtfs(
      "Berlin Hbf",
      "Munich Hbf",
      "2026-08-03",
    );

    expect(status).toBe(502);
    expect(body.error).toBe("SWISS_GTFS_UNAVAILABLE");
    expect(body.results).toEqual([]);
  });

  it("reuses one prepared feed for multiple route queries", async () => {
    const fetchMock = stubCatalogAndFeed();
    const routes = [
      { origin: "Berlin Hbf", destination: "München Hbf" },
      { origin: "Frankfurt Hbf", destination: "Köln Hbf" },
    ];
    await prepareSwissGtfsBatch(routes, ["2026-08-03"]);

    const first = await searchSwissGtfs("Berlin Hbf", "München Hbf", "2026-08-03");
    const second = await searchSwissGtfs("Frankfurt Hbf", "Köln Hbf", "2026-08-03");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
