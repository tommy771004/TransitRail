import { describe, expect, it } from "vitest";
import { isServiceRegionCatalog, type ServiceRegionCatalog } from "./serviceRegionCatalog";

const fixture = (): ServiceRegionCatalog => {
  const line = { id: "l", name: "Line", stations: [{ name: "A" }, { name: "B" }] };
  return { country: "japan", serviceDate: "2026-09-08", lines: [line], regions: [{ id: "r", name: "Region", lines: [line] }], stations: ["A", "B"], coverage: { mode: "scraped", date: "2026-09-08", dateRange: { start: "2026-09-08", end: "2026-09-09", days: 2, liveOnly: false } } };
};
describe("service region runtime contract", () => {
  it("accepts all three coverage modes and a destination subset", () => {
    for (const mode of ["provider", "scraped", "catalog_only"] as const) {
      const catalog = fixture(); catalog.coverage.mode = mode; catalog.stations = ["B"];
      catalog.country = mode === "provider" ? "united_kingdom" : mode === "catalog_only" ? "china" : "japan";
      expect(isServiceRegionCatalog(catalog, { allowStationSubset: true })).toBe(true);
    }
  });
  it.each([
    (c: any) => { c.lines = [null]; },
    (c: any) => { c.lines.push(c.lines[0]); },
    (c: any) => { c.regions.push(c.regions[0]); },
    (c: any) => { c.lines[0].id = " "; },
    (c: any) => { c.lines[0].stations[0].name = ""; },
    (c: any) => { c.stations.push("missing"); },
    (c: any) => { c.lines[0].stations.push({ name: "missing" }); },
    (c: any) => { c.regions[0].lines = [{ ...c.lines[0], id: "missing" }]; },
    (c: any) => { c.serviceDate = c.coverage.date = "2026-02-30"; },
    (c: any) => { c.coverage.date = "2026-09-09"; },
    (c: any) => { c.coverage.dateRange.end = "2026-09-07"; },
    (c: any) => { c.coverage.covered = [null]; },
    (c: any) => { c.destinationsByOrigin = { A: ["missing"] }; },
  ])("rejects malformed structure and inconsistent references (%#)", mutate => {
    const c = fixture(); mutate(c); expect(isServiceRegionCatalog(c)).toBe(false);
  });
});
