import { afterEach, describe, expect, it, vi } from "vitest";
import { JapanOdptScraper, JapanJrCentralScraper } from "./japan";
import { japanJrCentralRoutes } from "./routes";
import { odptRoutes } from "../../src/data/odptRoutes";

const odptResult = {
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

describe("Japan ODPT scraper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not schedule token-gated Tokyo Metro routes when ODPT_API_KEY is missing", () => {
    vi.stubEnv("ODPT_API_KEY", "");
    const scraper = new JapanOdptScraper();

    // Derived, not a magic number: a hardcoded count breaks every time a route
    // is added, which says nothing about the token gate this test exists for.
    const toeiRoutes = odptRoutes.filter((route) => route.operator === "Toei");
    expect(scraper.routes).toHaveLength(toeiRoutes.length);
    for (const route of toeiRoutes) expect(scraper.routes).toContainEqual(route);
    expect(scraper.routes).not.toContainEqual(
      expect.objectContaining({ operator: "TokyoMetro" }),
    );
  });

  it("names the operator's own registered source per route", () => {
    vi.stubEnv("ODPT_API_KEY", "test-key");
    const scraper = new JapanOdptScraper();
    const toei = odptRoutes.find((route) => route.operator === "Toei")!;
    const tokyoMetro = odptRoutes.find((route) => route.operator === "TokyoMetro")!;

    expect(scraper.sourceIdFor(toei)).toBe("jp-odpt-toei");
    expect(scraper.sourceIdFor(tokyoMetro)).toBe("jp-odpt-tokyo-metro");
  });

  it("preserves the official rows ODPT returned", async () => {
    const provider = vi.fn(async () => ({ status: 200, body: { results: [odptResult], source: "ODPT" } }));
    const scraper = new JapanOdptScraper(provider);

    const data = await scraper.scrape({ origin: "Shinjuku", destination: "Roppongi" }, "2026-08-03");

    expect(provider).toHaveBeenCalledOnce();
    expect(data.results).toEqual([odptResult]);
  });

  it("fails the route rather than fabricating a subway timetable when ODPT is down", async () => {
    const scraper = new JapanOdptScraper(async () => ({
      status: 503,
      body: { results: [], error: "ODPT_SOURCE_UNAVAILABLE" },
    }));

    await expect(
      scraper.scrape({ origin: "Shinjuku", destination: "Roppongi" }, "2026-08-03"),
    ).rejects.toThrow(/ODPT_SOURCE_UNAVAILABLE/);
  });

  it("treats an empty 200 as a failure, not as a day with no service", async () => {
    const scraper = new JapanOdptScraper(async () => ({ status: 200, body: { results: [] } }));

    await expect(
      scraper.scrape({ origin: "Shinjuku", destination: "Roppongi" }, "2026-08-03"),
    ).rejects.toThrow(/no departures/);
  });
});

describe("Japan JR Central scraper", () => {
  const jrResult = {
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

  it("covers only the Tokaido pairs JR Central's search answers", () => {
    const scraper = new JapanJrCentralScraper();
    expect(scraper.routes).toEqual(japanJrCentralRoutes);
    // The generated Shinkansen and Yamanote routes are gone, not moved.
    expect(scraper.routes).not.toContainEqual({ origin: "Tokyo", destination: "Hakata" });
    expect(scraper.routes).not.toContainEqual({ origin: "Tokyo", destination: "Ikebukuro" });
  });

  it("preserves the official rows JR Central returned", async () => {
    const jrProvider = vi.fn(async () => ({
      status: 200,
      body: { results: [jrResult], source: "JR Central official journey search" },
    }));
    const scraper = new JapanJrCentralScraper(jrProvider);

    const data = await scraper.scrape({ origin: "Tokyo", destination: "Shin-Osaka" }, "2026-08-03");

    expect(jrProvider).toHaveBeenCalledWith("Tokyo", "Shin-Osaka", "2026-08-03");
    expect(data.results).toEqual([jrResult]);
  });

  it("fails the route rather than generating rows when JR Central is down", async () => {
    const scraper = new JapanJrCentralScraper(async () => ({
      status: 503,
      body: { results: [], error: "JR_CENTRAL_SOURCE_UNAVAILABLE" },
    }));

    await expect(
      scraper.scrape({ origin: "Tokyo", destination: "Shin-Osaka" }, "2026-08-03"),
    ).rejects.toThrow(/JR_CENTRAL_SOURCE_UNAVAILABLE/);
  });
});
