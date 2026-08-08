import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStationBrowserCatalog, resetStationBrowserCatalogCache, resolveCatalogSelection } from "./stationBrowserCatalog";

afterEach(resetStationBrowserCatalogCache);

describe("station browser catalog hydration", () => {
  it("shares one request for a stable country/date/origin context", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ stations: ["Tokyo"] }), { status: 200 }));
    const request = { country: "japan", date: "2026-08-08", headers: {} };

    const [first, second] = await Promise.all([
      loadStationBrowserCatalog(request, fetcher),
      loadStationBrowserCatalog(request, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data.stations).toEqual(["Tokyo"]);
    expect(second).toEqual(first);
  });

  it("uses a new request only when date or origin coverage changes", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", origin: "Tokyo", headers: {} }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("restores a valid line and resets an invalid selection to the first region", () => {
    const regions = [
      { id: "north", name: "North", lines: [{ id: "n1", name: "N1", stations: [{ name: "A" }, { name: "B" }] }] },
      { id: "south", name: "South", lines: [{ id: "s1", name: "S1", stations: [{ name: "C" }, { name: "D" }] }] },
    ];
    expect(resolveCatalogSelection(regions, "s1")).toEqual({ regionId: "south", lineId: "s1" });
    expect(resolveCatalogSelection(regions, "gone")).toEqual({ regionId: "north", lineId: "n1" });
  });
});
