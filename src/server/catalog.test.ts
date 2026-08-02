import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLinesForCountry, getStationsForCountry } from "./catalog";

const DATE = "2026-08-01";

// The catalog is date-conditioned, so a suite pinned to a fixed service day has
// to pin the clock with it or it starts returning empty menus the next morning.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${DATE}T04:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("station and line catalog integrity scope", () => {
  it("removes Tokyo metro lines while retaining the existing Shinkansen directory", async () => {
    const lines = await getLinesForCountry("japan", "2026-08-01");
    const stations = await getStationsForCountry("japan", undefined, "2026-08-01");

    expect(lines.every((line) => !line.id.startsWith("toei-") && !line.id.startsWith("tokyo-metro-"))).toBe(true);
    expect(lines.some((line) => line.id === "tokaido-shinkansen")).toBe(true);
    expect(stations.stations).toContain("Tokyo");
    expect(stations.stations).not.toContain("Roppongi");
  });

  it("keeps the existing intercity directory outside the metro gate", async () => {
    const lines = await getLinesForCountry("china", "2026-08-01");
    const stations = await getStationsForCountry("china", undefined, "2026-08-01");

    expect(lines).toHaveLength(6);
    expect(stations.stations).toContain("Beijing South");
    expect(stations.stations).toContain("Shanghai Hongqiao");
  });

  it("carries the Seoul artifact's verified policy fact into station and line discovery", async () => {
    const lines = await getLinesForCountry("korea", "2026-08-01");
    const stations = await getStationsForCountry("korea", undefined, "2026-08-01");

    expect(lines.length).toBeGreaterThan(0);
    expect(stations.coverage).toMatchObject({ truthMode: "verified", provenance: "official" });
    expect(stations.stations).toContain("Seoul Station");
  });

  it("offers only the dates the committed data can answer", async () => {
    // The policy window moves with the clock every day; the data only moves
    // when the scrape runs. A day after the last scrape, the final policy day
    // has nothing behind it — the picker must not offer it.
    vi.setSystemTime(new Date("2026-08-02T04:00:00.000Z"));
    const stations = await getStationsForCountry("japan", undefined, undefined);
    const range = stations.coverage?.dateRange;

    expect(range?.start).toBe("2026-08-02");
    expect(range?.end).toBe("2026-08-07");
    expect(range?.days).toBe(6);
  });

  it("does not trim a live-provider market to committed rows", async () => {
    // Boston answers a date from the provider, so its window is a capability,
    // not an inventory, and must keep its full length.
    vi.setSystemTime(new Date("2026-08-02T04:00:00.000Z"));
    const stations = await getStationsForCountry("united_states", undefined, undefined);

    expect(stations.coverage?.dateRange?.days).toBe(7);
  });
});
