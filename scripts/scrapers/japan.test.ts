import { afterEach, describe, expect, it, vi } from "vitest";
import { JapanScraper } from "./japan";

describe("Japan scheduled source routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not schedule token-gated Tokyo Metro routes when ODPT_API_KEY is missing", () => {
    vi.stubEnv("ODPT_API_KEY", "");
    const scraper = new JapanScraper();

    expect(scraper.routes).toHaveLength(29);
    expect(scraper.routes).toContainEqual({
      origin: "Shinjuku",
      destination: "Roppongi",
      operator: "Toei",
      railway: "odpt.Railway:Toei.Oedo",
      lineName: "Toei Oedo Line",
      lineColor: "#b6007a",
      originStation: "odpt.Station:Toei.Oedo.Shinjuku",
      destinationStation: "odpt.Station:Toei.Oedo.Roppongi",
    });
    expect(scraper.routes).not.toContainEqual(
      expect.objectContaining({ operator: "TokyoMetro" }),
    );
  });

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

  it("uses JR Central for configured Tokaido Shinkansen routes", async () => {
    const odptProvider = vi.fn();
    const result = {
      id: "2026-08-03-jp-jr-central-nozomi-1-0600",
      country: "japan" as const,
      date: "2026-08-03",
      operator: "JR Central",
      service: "Nozomi 1",
      departureTime: "06:00",
      arrivalTime: "08:22",
      durationMinutes: 142,
      origin: "Tokyo",
      destination: "Shin-Osaka",
      direct: true,
      stops: ["Tokyo", "Shin-Osaka"],
    };
    const jrProvider = vi.fn(async () => ({
      status: 200,
      body: { results: [result], source: "JR Central official journey search" },
    }));
    const scraper = new JapanScraper(odptProvider, jrProvider);
    const data = await scraper.scrape({ origin: "Tokyo", destination: "Shin-Osaka" }, "2026-08-03");
    expect(odptProvider).not.toHaveBeenCalled();
    expect(jrProvider).toHaveBeenCalledWith("Tokyo", "Shin-Osaka", "2026-08-03");
    expect(data.results).toEqual([result]);
    expect(data.source).toBe("JR Central official journey search");
  });

  it("does not overwrite a Tokaido route with generated rows when JR Central fails", async () => {
    const scraper = new JapanScraper(vi.fn(), async () => ({
      status: 503,
      body: { results: [], error: "JR_CENTRAL_SOURCE_UNAVAILABLE" },
    }));

    await expect(
      scraper.scrape({ origin: "Tokyo", destination: "Shin-Osaka" }, "2026-08-03"),
    ).rejects.toThrow(/JR_CENTRAL_SOURCE_UNAVAILABLE/);
  });
});
