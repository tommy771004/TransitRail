import { afterEach, describe, expect, it, vi } from "vitest";
import type { TransitSituation } from "../types";

const belgium = vi.fn<() => Promise<TransitSituation[]>>();
vi.mock("./railSituations", () => ({
  getBelgiumSituations: () => belgium(),
  getJapanSituations: async () => [],
  getNorwaySituations: async () => [],
}));
vi.mock("./swissSituations", () => ({ getSwissSituations: async () => [] }));

afterEach(() => { vi.unstubAllGlobals(); });

describe("situation feed", () => {
  it("keeps a feed's last notices when one refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response));
    const { loadSituations } = await import("./situations");
    const notice: TransitSituation = { id: "be-1", country: "belgium", title: "Bruges / Brugge", source: "SNCB-NMBS" };

    belgium.mockResolvedValueOnce([notice]);
    expect(await loadSituations()).toEqual([notice]);

    belgium.mockRejectedValueOnce(new Error("timeout"));
    expect(await loadSituations()).toEqual([notice]);

    belgium.mockResolvedValueOnce([]);
    expect(await loadSituations()).toEqual([]);
  });
});
