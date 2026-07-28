import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceDayAdvisoryForWatch } from "./serviceDayWatch";

describe("serviceDayAdvisoryForWatch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns explicit unavailable coverage for unsupported markets without fetching", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("unsupported market must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);

    const advisory = await serviceDayAdvisoryForWatch({
      origin: "Tokyo",
      destination: "Kyoto",
      country: "japan",
      serviceDate: "2026-08-03",
    });

    expect(advisory).toEqual(expect.objectContaining({
      coverage: "unavailable",
      serviceDate: "2026-08-03",
      timezone: "Asia/Tokyo",
      risk: "unavailable",
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
