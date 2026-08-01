import { describe, expect, it } from "vitest";
import { getLinesForCountry, getStationsForCountry } from "./catalog";

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
});
