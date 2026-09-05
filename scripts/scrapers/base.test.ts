import { describe, expect, it } from "vitest";
import { stationSlug } from "./base";
import { DownloadScraper } from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";

const routes: ScrapedRoute[] = [
  { origin: "A", destination: "B" },
  { origin: "C", destination: "D" },
  { origin: "E", destination: "F" },
  { origin: "G", destination: "H" },
];

describe("BaseScraper route concurrency", () => {
  it("keeps non-Latin station names distinct instead of collapsing them to an empty slug", () => {
    expect(stationSlug("Liège-Guillemins")).toBe("li-ge-guillemins");
    expect(stationSlug("高松築港")).toBe("高松築港");
    expect(stationSlug("琴電琴平")).toBe("琴電琴平");
    expect(`${stationSlug("高松築港")}-${stationSlug("琴電琴平")}.json`)
      .not.toBe(`${stationSlug("瓦町")}-${stationSlug("琴電志度")}.json`);
  });

  it("limits independent routes to the scraper's declared concurrency", async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    class ConcurrentScraper extends DownloadScraper {
      readonly name = "concurrency test";
      readonly country = "malaysia" as const;
      readonly sourceId = "my-ktmb-gtfs" as const;
      readonly routes = routes;
      protected readonly routeConcurrency = 2;

      async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 15));
        inFlight -= 1;
        return { origin: route.origin, destination: route.destination, date, scrapedAt: "2026-08-11T00:00:00.000Z", source: "", results: [] };
      }
    }

    const scraper = new ConcurrentScraper();
    // Persistence is covered by the merge suite; this test isolates scheduling.
    (scraper as unknown as { saveRoute: () => void }).saveRoute = () => {};
    await scraper.runAll("2026-08-11");

    expect(peakInFlight).toBe(2);
  });
});
