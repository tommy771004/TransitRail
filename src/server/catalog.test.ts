import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServiceRegionCatalog, getLinesForCountry, getStationsForCountry } from "./catalog";
import { getScrapedCoverageNames, getScrapedRoutes } from "../data/scraped";
import { getProviderRouteLines } from "../data/providerRouteLines";
import { addDateValueDays, searchDateRange } from "../data/countries";

let catalogDate = "2026-08-01";

function firstJapanSnapshotDate(): string {
  return [...new Set(
    getScrapedRoutes("japan").flatMap((route) => route.results.map((result) => result.date)),
  )].filter((date): date is string => Boolean(date)).sort()[0] || "2026-08-01";
}

// The catalog is date-conditioned, so a suite pinned to a fixed service day has
// to pin the clock with it or it starts returning empty menus the next morning.
beforeEach(() => {
  catalogDate = firstJapanSnapshotDate();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${catalogDate}T04:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("station and line catalog integrity scope", () => {
  it("builds a stable date-qualified metro and intercity hierarchy without pair searches", async () => {
    const catalog = await buildServiceRegionCatalog({
      country: "japan",
      date: catalogDate,
      includeProvider: false,
    });

    expect(catalog.serviceDate).toBe(catalogDate);
    expect(catalog.regions.map((region) => region.id)).toEqual([
      "tokyo-urban",
      "japan-intercity",
    ]);
    expect(catalog.lines).toEqual(catalog.regions.flatMap((region) => region.lines));
    expect(catalog.regions.every((region) => region.lines.every((line) => line.stations.length >= 2))).toBe(true);
    expect(catalog.stations).toEqual(expect.arrayContaining(["Tokyo", "Roppongi"]));
  });

  it("does not turn source-context-only markets into searchable catalogue entries", async () => {
    for (const country of ["singapore", "malaysia", "china"] as const) {
      const catalog = await buildServiceRegionCatalog({ country, date: catalogDate, includeProvider: false });
      expect(catalog.regions).toEqual([]);
      expect(catalog.lines).toEqual([]);
      expect(catalog.stations).toEqual([]);
      expect(catalog.message).toMatch(/timetable|source/i);
    }
  });

  it("uses the artifact-backed Korean network in the same hierarchy", async () => {
    const catalog = await buildServiceRegionCatalog({ country: "korea", date: catalogDate, includeProvider: false });
    expect(catalog.regions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "seoul-capital" }),
    ]));
    expect(catalog.stations).toContain("Seoul Station");
  });

  it("exposes verified Toei and Shinkansen lines while hiding unverified Tokyo Metro lines", async () => {
    const lines = await getLinesForCountry("japan", catalogDate);
    const stations = await getStationsForCountry("japan", undefined, catalogDate);

    expect(lines.some((line) => line.id.startsWith("toei-"))).toBe(true);
    expect(lines.every((line) => !line.id.startsWith("tokyo-metro-"))).toBe(true);
    expect(lines.some((line) => line.id === "tokaido-shinkansen")).toBe(true);
    expect(stations.stations).toContain("Tokyo");
    expect(stations.stations).toContain("Roppongi");
    expect(stations.stations).not.toContain("Shibuya");
  });

  it("keeps the static intercity directory without promising dated timetable coverage", async () => {
    const lines = await getLinesForCountry("china");
    const datedLines = await getLinesForCountry("china", catalogDate);
    const stations = await getStationsForCountry("china", undefined, catalogDate);

    expect(lines).toHaveLength(6);
    expect(datedLines).toHaveLength(0);
    expect(stations.stations).toContain("Beijing South");
    expect(stations.stations).toContain("Shanghai Hongqiao");
  });

  it("carries the Seoul artifact's verified policy fact into station and line discovery", async () => {
    const lines = await getLinesForCountry("korea", catalogDate);
    const stations = await getStationsForCountry("korea", undefined, catalogDate);

    expect(lines.length).toBeGreaterThan(0);
    expect(stations.coverage).toMatchObject({ truthMode: "verified", provenance: "official" });
    expect(stations.stations).toContain("Seoul Station");
  });

  it("exposes snapshot-backed route catalogs for Belgium, Norway, and the United States", async () => {
    const expectedCounts = {
      belgium: 5,
      norway: 5,
      united_states: 4,
    } as const;

    for (const country of Object.keys(expectedCounts) as Array<keyof typeof expectedCounts>) {
      const routeLines = getProviderRouteLines(country, getScrapedRoutes(country));
      expect(routeLines).toHaveLength(expectedCounts[country]);
      expect(routeLines.every((line) => line.name.includes(" → "))).toBe(true);
    }

    for (const [country, expectedCount] of Object.entries(expectedCounts) as Array<[
      keyof typeof expectedCounts,
      number,
    ]>) {
      const lines = await getLinesForCountry(country);
      expect(lines.length).toBeGreaterThan(0);
      if (country !== "united_states") {
        expect(lines).toHaveLength(expectedCount);
        expect(lines.every((line) => line.name.includes(" → "))).toBe(true);
      } else {
        expect(lines.map((line) => line.id)).toEqual(expect.arrayContaining(
          getProviderRouteLines(country, getScrapedRoutes(country)).map((line) => line.id),
        ));
      }
      expect(lines.every((line) => line.stations.length >= 2)).toBe(true);
    }
  });

  it("offers only the dates the committed data can answer", async () => {
    // The policy window moves with the clock every day; the data only moves
    // when the scrape runs. A day after the last scrape, the final policy day
    // has nothing behind it — the picker must not offer it.
    //
    // Derived from the committed data rather than pinned to a date: the scrape
    // legitimately extends the window, and a hardcoded end date fails on that
    // without saying anything about the trim this test exists for.
    const clockDate = addDateValueDays(firstJapanSnapshotDate(), -4);
    vi.setSystemTime(new Date(`${clockDate}T04:00:00.000Z`));
    const stations = await getStationsForCountry("japan", undefined, undefined);
    const range = stations.coverage?.dateRange;
    const snapshotDates = [...new Set(
      getScrapedRoutes("japan").flatMap((route) => route.results.map((result) => result.date)),
    )].filter((date): date is string => Boolean(date)).sort();
    const policyRange = searchDateRange("japan", new Date(`${clockDate}T04:00:00.000Z`));
    const answerableDates = snapshotDates.filter((date) => (
      date >= policyRange.start && date <= policyRange.end
    ));

    expect(range?.start).toBe(answerableDates[0]);
    expect(range?.end).toBe(answerableDates.at(-1));
    expect(range?.days).toBe(answerableDates.length);
    expect(getScrapedCoverageNames("japan", range?.end).length).toBeGreaterThan(0);
  });

  it("trims a provider-then-scraped market to what its snapshots guarantee", async () => {
    // Switzerland's OJP adapter answers only when SWISS_OJP_TOKEN is set; the
    // guaranteed answer is the committed snapshot, so the offer must not run
    // past it. It advertised 14 days while days 8-14 answered "unsupported
    // route".
    vi.setSystemTime(new Date(`${addDateValueDays(firstJapanSnapshotDate(), -4)}T04:00:00.000Z`));
    const stations = await getStationsForCountry("switzerland", undefined, undefined);

    expect(stations.coverage?.dateRange?.days).toBeLessThanOrEqual(7);
  });

  it("does not trim a live-provider market to committed rows", async () => {
    // Boston answers a date from the provider, so its window is a capability,
    // not an inventory, and must keep its full length.
    vi.setSystemTime(new Date(`${addDateValueDays(firstJapanSnapshotDate(), -4)}T04:00:00.000Z`));
    const stations = await getStationsForCountry("united_states", undefined, undefined);

    expect(stations.coverage?.dateRange?.days).toBe(7);
  });

  it("does not use fallback snapshot pairs to hide provider-market destinations", async () => {
    const date = [...new Set(
      getScrapedRoutes("united_states").flatMap((route) => route.results.map((result) => result.date)),
    )].filter((value): value is string => Boolean(value)).sort().at(-1)!;
    const full = await buildServiceRegionCatalog({
      country: "united_states",
      date,
      includeProvider: false,
    });
    const fromSouthStation = await buildServiceRegionCatalog({
      country: "united_states",
      date,
      origin: "South Station",
      includeProvider: false,
    });

    expect(fromSouthStation.stations).toEqual(full.stations);
    expect(fromSouthStation.message).toBeUndefined();
  });
});
