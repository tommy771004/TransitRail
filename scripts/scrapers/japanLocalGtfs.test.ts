import { afterEach, describe, expect, it, vi } from "vitest";
import { JapanLocalGtfsScraper } from "./japan";
import { zipFixture } from "../../src/server/gtfsZipFixture";
import { KOTODEN_GTFS_RAIL, resetJapanGtfsFeedCache } from "../../src/server/japanGtfsJp";
import { findInRoutes } from "../../src/data/scraped/timetableDay";

const feed = zipFixture({
  "stops.txt": [
    "stop_id,stop_name,parent_station",
    "S1,高松築港,",
    "S2,瓦町,",
    "S3,琴電琴平,",
  ].join("\n"),
  "trips.txt": [
    "route_id,service_id,trip_id,trip_headsign",
    "R-KOTOHIRA,weekday,T-down,琴電琴平",
    "R-KOTOHIRA,weekday,T-up,高松築港",
    "R-KOTOHIRA,weekday,T-short,瓦町",
  ].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "T-down,06:00:00,06:00:00,S1,1",
    "T-down,06:06:00,06:06:00,S2,2",
    "T-down,07:00:00,07:00:00,S3,3",
    "T-up,08:00:00,08:00:00,S3,1",
    "T-up,08:54:00,08:54:00,S2,2",
    "T-up,09:00:00,09:00:00,S1,3",
    "T-short,06:30:00,06:30:00,S1,1",
    "T-short,06:36:00,06:36:00,S2,2",
  ].join("\n"),
  "calendar.txt": [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "weekday,1,1,1,1,1,0,0,20260101,20261231",
  ].join("\n"),
  "routes.txt": [
    "route_id,route_short_name,route_long_name,route_type",
    "R-KOTOHIRA,琴平線,高松築港 - 琴電琴平,2",
  ].join("\n"),
});

function scraperWithoutPersistence() {
  const scraper = new JapanLocalGtfsScraper(KOTODEN_GTFS_RAIL);
  // Persistence is the merge suite's subject; this one is about the route list.
  (scraper as unknown as { saveRoute: () => void }).saveRoute = () => {};
  return scraper;
}

afterEach(() => {
  delete process.env[KOTODEN_GTFS_RAIL.urlEnvVar];
  resetJapanGtfsFeedCache();
  vi.unstubAllGlobals();
});

describe("Japan local GTFS-JP scraper", () => {
  it("runs nothing at all when the operator's feed URL is not configured", async () => {
    const unconfigured = { ...KOTODEN_GTFS_RAIL, defaultUrl: undefined };
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const scraper = new JapanLocalGtfsScraper(unconfigured);
    (scraper as unknown as { saveRoute: () => void }).saveRoute = () => {};
    await expect(scraper.runAll("2026-08-19")).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the operator's stable feed URL when no override is configured", () => {
    expect(KOTODEN_GTFS_RAIL.defaultUrl).toBe(
      "https://www.kotoden.co.jp/publichtm/gtfs/gtfsdata/gtfs_kd.zip",
    );
  });

  it("takes its route list and station spellings from the feed, once across dates", async () => {
    process.env[KOTODEN_GTFS_RAIL.urlEnvVar] = "https://example.jp/kotoden/feed.zip";
    const fetcher = vi.fn(async (_input: string | URL | Request) => new Response(feed, {
      status: 200,
      headers: { "content-type": "application/zip" },
    }));
    vi.stubGlobal("fetch", fetcher);
    const scraper = scraperWithoutPersistence();

    // 2026-08-19 is a Wednesday, which the fixture's weekly calendar runs.
    const first = await scraper.runAll("2026-08-19");
    const second = await scraper.runAll("2026-08-20");

    expect(scraper.routes).toEqual([
      { origin: "高松築港", destination: "琴電琴平" },
      { origin: "琴電琴平", destination: "高松築港" },
      { origin: "高松築港", destination: "瓦町" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://example.jp/kotoden/feed.zip");
    expect(second.map((route) => route.date)).toEqual(["2026-08-20", "2026-08-20", "2026-08-20"]);

    expect(first.flatMap((route) => route.results)).toHaveLength(3);
    expect(findInRoutes(first, "高松築港", "瓦町", "2026-08-19", "japan")?.map((row) => row.departureTime))
      .toEqual(["06:00", "06:30"]);
    const down = first.find((route) => route.origin === "高松築港");
    expect(down?.results).toHaveLength(1);
    expect(down?.results[0]).toMatchObject({
      country: "japan",
      operator: "Takamatsu-Kotohira Electric Railroad (Kotoden)",
      service: "高松築港 - 琴電琴平",
      departureTime: "06:00",
      arrivalTime: "07:00",
      durationMinutes: 60,
      origin: "高松築港",
      destination: "琴電琴平",
      stops: ["高松築港", "瓦町", "琴電琴平"],
      legs: [
        expect.objectContaining({ origin: "高松築港", destination: "瓦町", departureTime: "06:00", arrivalTime: "06:06" }),
        expect.objectContaining({ origin: "瓦町", destination: "琴電琴平", departureTime: "06:06", arrivalTime: "07:00" }),
      ],
    });
    expect(down?.sourceMeta).toMatchObject({
      sourceId: "jp-kotoden-gtfs",
      sourceType: "official-gtfs",
      sourceTier: "A",
      verified: true,
    });
    expect(findInRoutes(down ? [down] : [], "瓦町", "琴電琴平", "2026-08-19", "japan")?.[0])
      .toMatchObject({ departureTime: "06:06", arrivalTime: "07:00" });
  });
});
