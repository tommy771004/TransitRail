import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";
import { getLinesForCountry } from "./catalog";

// Follow the committed rolling window, while parser details stay pinned to
// immutable official workbook fixtures in scripts/lib/korailTimetable.test.ts.
const snapshot = JSON.parse(readFileSync(new URL("../data/scraped/korea/seoul-busan.json", import.meta.url), "utf8"));
const date = snapshot.results[0].date as string;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${date}T04:00:00Z`));
});
afterEach(() => vi.useRealTimers());

describe("registered Korail snapshots reach search and catalog", { timeout: 20_000 }, () => {
  it("answers operator aliases in both directions with official rows", async () => {
    for (const [origin, destination] of [["Seoul Station", "Busan (BSN)"], ["Busan Station", "Seoul (SNC)"], ["Yongsan", "Mokpo"]]) {
      const { statusCode, payload } = await runTransitSearch({ country: "korea", origin, destination, date });
      expect(statusCode).toBe(200);
      expect(payload.results.length).toBeGreaterThan(0);
      expect(payload.results.every((result) => result.operator === "Korail" && result.date === date && result.provenance === "official")).toBe(true);
      expect(payload.results.some((result) => result.tags?.includes("reverse"))).toBe(false);
    }
  });
  it("adds Korail corridors while retaining the subway catalog", async () => {
    const lines = await getLinesForCountry("korea", date, false);
    expect(lines.some((line) => line.id.startsWith("korea-route-korail-") && line.stations.some((station) => station.name === "Busan"))).toBe(true);
    expect(lines.some((line) => !line.id.startsWith("korea-route-korail-"))).toBe(true);
  });
});
