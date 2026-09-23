import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServiceRegionCatalog } from "./catalog";
import { getScrapedRoutes } from "../data/scraped";
import { firstJapanSnapshotDate } from "./catalogTestSupport";

// Apart from catalog.test.ts for the same reason as catalogJapanCoverage: each
// of these builds a whole market's catalog, and together with the integrity
// suite they kept one worker busy past the runner's one-minute RPC timeout.
let catalogDate = "2026-08-01";

beforeEach(() => {
  catalogDate = firstJapanSnapshotDate();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${catalogDate}T04:00:00.000Z`));
});

afterEach(async () => {
  vi.useRealTimers();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("destinations and coverage offered by the station picker", { timeout: 30_000 }, () => {
  it("offers destinations along the line from a station between a route's terminals", async () => {
    const catalog = await buildServiceRegionCatalog({
      country: "japan",
      date: catalogDate,
      includeProvider: false,
      includeDestinations: true,
    });
    const destinations = catalog.destinationsByOrigin!;

    // Ginza is no route file's terminal, yet every Ginza Line train stops there.
    expect(destinations.Ginza).toEqual(expect.arrayContaining(["Ueno", "Shibuya", "Asakusa"]));
    // Any station a timed train departs from must lead somewhere. A terminus
    // served in one direction only (Tokyo → Kyoto) rightly offers nothing.
    const departsFrom = new Set(getScrapedRoutes("japan").flatMap((route) => route.results
      .filter((row) => row.date === catalogDate)
      .flatMap((row) => [row.origin, ...(row.legs ?? [])
        .filter((leg) => leg.departureTime && leg.arrivalTime)
        .map((leg) => leg.origin)])));
    expect(catalog.stations.filter((station) => departsFrom.has(station) && destinations[station].length === 0)).toEqual([]);
  });

  it.each(["france", "germany"] as const)("offers %s only the stations its timetables answer", async (country) => {
    const catalog = await buildServiceRegionCatalog({ country, date: catalogDate, includeProvider: false });

    // Without the catalog gate the picker got no coverage list at all, so line-
    // map stations with no timetable (Arras, Freiburg Hbf) passed for origins.
    expect(catalog.coverage.covered?.length).toBeGreaterThan(0);
    expect(catalog.stations).toEqual(catalog.coverage.covered);
    expect(catalog.coverage).toMatchObject({ truthMode: "verified", provenance: "official" });
  });
});
