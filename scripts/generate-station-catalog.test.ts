import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServiceRegionCatalog } from "../src/server/catalog";
import { buildCatalogWithProviderFallback, generateStaticStationCatalogs } from "./generate-station-catalog";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const catalog = (serviceDate: string): ServiceRegionCatalog => ({
  country: "united_kingdom",
  serviceDate,
  regions: [],
  lines: [],
  stations: ["Waterloo Underground Station"],
  coverage: { mode: "provider" },
});

describe("static station catalog generation", () => {
  it("keeps the complete provider directory when it is available", async () => {
    const build = vi.fn().mockResolvedValue(catalog("2026-08-30"));

    await expect(buildCatalogWithProviderFallback("united_kingdom", build))
      .resolves.toEqual(catalog("2026-08-30"));
    expect(build).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ includeProvider: true }));
  });

  it("falls back to committed data when a live provider directory is unavailable", async () => {
    const build = vi.fn()
      .mockRejectedValueOnce(new Error("TfL rate limit exhausted"))
      .mockResolvedValueOnce(catalog("2026-08-30"));

    const result = await buildCatalogWithProviderFallback("united_kingdom", build);

    expect(result?.stations).toEqual(["Waterloo Underground Station"]);
    expect(build).toHaveBeenNthCalledWith(1, expect.objectContaining({
      country: "united_kingdom",
      includeProvider: true,
    }));
    expect(build).toHaveBeenNthCalledWith(2, expect.objectContaining({
      country: "united_kingdom",
      includeProvider: false,
    }));
  });

  it.each([
    new Error("TfL returned HTTP 429. Retry-After: 60."),
    new Error("Request failed with status code 429"),
    { status: 429 },
    { statusCode: 429 },
    { response: { status: 429 } },
  ])("skips a rate-limited provider without trying again: %s", async (error) => {
    const build = vi.fn().mockRejectedValue(error);
    await expect(buildCatalogWithProviderFallback("united_kingdom", build)).resolves.toBeNull();
    expect(build).toHaveBeenCalledOnce();
  });

  it("also skips a 429 from fallback but propagates other fallback failures", async () => {
    const build = vi.fn()
      .mockRejectedValueOnce(new Error("Directory unavailable"))
      .mockRejectedValueOnce(new Error("MBTA returned HTTP 429."));
    await expect(buildCatalogWithProviderFallback("united_states", build)).resolves.toBeNull();
    const invalid = vi.fn().mockRejectedValue(new Error("Invalid catalog 4290"));
    await expect(buildCatalogWithProviderFallback("united_states", invalid)).rejects.toThrow("Invalid catalog 4290");
  });

  it("preserves existing files, leaves absent files absent and continues after 429", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "transitrail-catalog-429-"));
    tempDirs.push(outDir);
    const previous = JSON.stringify(catalog("2026-08-29")) + "\n";
    writeFileSync(join(outDir, "united_kingdom.json"), previous);
    const build = vi.fn(async ({ country }) => {
      if (country !== "japan") throw new Error("Provider returned HTTP 429.");
      return { ...catalog("2026-08-30"), country: "japan" as const };
    });

    await expect(generateStaticStationCatalogs({
      countries: ["united_kingdom", "united_states", "japan"], outDir, build,
    })).resolves.toEqual({ generated: 1, skipped: 2 });
    expect(build).toHaveBeenCalledTimes(3);
    expect(readFileSync(join(outDir, "united_kingdom.json"), "utf8")).toBe(previous);
    expect(existsSync(join(outDir, "united_states.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(outDir, "japan.json"), "utf8")).serviceDate).toBe("2026-08-30");
  });
});
