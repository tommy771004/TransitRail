import { describe, expect, it, vi } from "vitest";
import { JapanScraper } from "./japan";

describe("Japan scheduled source routing", () => {
  it("uses ODPT for configured subway routes and preserves official results", async () => {
    const result = {
      id: "2026-08-03-jp-odpt-test",
      country: "japan" as const,
      date: "2026-08-03",
      operator: "Toei Subway",
      service: "Toei Oedo Line",
      departureTime: "10:24",
      arrivalTime: "10:33",
      durationMinutes: 9,
      origin: "Shinjuku",
      destination: "Roppongi",
      direct: true,
      stops: ["Shinjuku", "Roppongi"],
    };
    const provider = vi.fn(async () => ({ status: 200, body: { results: [result], source: "ODPT" } }));
    const scraper = new JapanScraper(provider);

    const data = await scraper.scrape({ origin: "Shinjuku", destination: "Roppongi" }, "2026-08-03");

    expect(provider).toHaveBeenCalledOnce();
    expect(data.results).toEqual([result]);
    expect(data.source).toBe("ODPT");
  });

  it("does not fabricate a subway snapshot when ODPT is unavailable", async () => {
    const scraper = new JapanScraper(async () => ({
      status: 503,
      body: { results: [], error: "ODPT_SOURCE_UNAVAILABLE" },
    }));

    await expect(
      scraper.scrape({ origin: "Shinjuku", destination: "Roppongi" }, "2026-08-03"),
    ).rejects.toThrow(/ODPT_SOURCE_UNAVAILABLE/);
  });

  it("keeps existing JR routes on their current local generator", async () => {
    const provider = vi.fn();
    const scraper = new JapanScraper(provider);
    const data = await scraper.scrape({ origin: "Tokyo", destination: "Shin-Osaka" }, "2026-08-03");
    expect(provider).not.toHaveBeenCalled();
    expect(data.results.length).toBeGreaterThan(0);
  });
});
