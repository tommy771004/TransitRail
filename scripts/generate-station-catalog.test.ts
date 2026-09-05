import { describe, expect, it, vi } from "vitest";
import type { ServiceRegionCatalog } from "../src/server/catalog";
import { buildCatalogWithProviderFallback } from "./generate-station-catalog";

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

    expect(result.stations).toEqual(["Waterloo Underground Station"]);
    expect(build).toHaveBeenNthCalledWith(1, expect.objectContaining({
      country: "united_kingdom",
      includeProvider: true,
    }));
    expect(build).toHaveBeenNthCalledWith(2, expect.objectContaining({
      country: "united_kingdom",
      includeProvider: false,
    }));
  });
});
