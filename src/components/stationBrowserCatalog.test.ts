import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStationBrowserCatalog, resetStationBrowserCatalogCache, resolveCatalogSelection } from "./stationBrowserCatalog";

afterEach(resetStationBrowserCatalogCache);

const catalog = (country = "japan", serviceDate = "2026-08-08", station = "Tokyo") => {
  const line = { id: "line", name: "Line", stations: [{ name: station }, { name: "B" }] };
  return { country, serviceDate, regions: [{ id: "region", name: "Region", lines: [line] }], lines: [line], stations: [station, "B"], coverage: { mode: country === "united_kingdom" ? "provider" : "scraped", date: serviceDate }, destinationsByOrigin: { [station]: ["B"] } };
};

describe("station browser catalog hydration", () => {
  it("shares one request for a stable country/date/origin context", async () => {
    const fetcher = vi.fn(async () => Response.json(catalog()));
    const request = { country: "japan", date: "2026-08-08", headers: {} };

    const [first, second] = await Promise.all([
      loadStationBrowserCatalog(request, fetcher),
      loadStationBrowserCatalog(request, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data.stations).toEqual(["Tokyo", "B"]);
    expect(second).toEqual(first);
  });

  it("uses a new request only when date or origin coverage changes", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", origin: "Tokyo", headers: {} }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not pin a transient failure in the browser-session cache", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(Response.json(catalog("united_kingdom", "2026-08-19", "Recovered Station")));
    const request = { country: "united_kingdom", date: "2026-08-19", headers: {} };

    expect((await loadStationBrowserCatalog(request, fetcher)).ok).toBe(false);
    const recovered = await loadStationBrowserCatalog(request, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(recovered.ok).toBe(true);
    expect(recovered.data.stations).toEqual(["Recovered Station", "B"]);
  });

  it("restores a valid line and resets an invalid selection to the first region", () => {
    const regions = [
      { id: "north", name: "North", lines: [{ id: "n1", name: "N1", stations: [{ name: "A" }, { name: "B" }] }] },
      { id: "south", name: "South", lines: [{ id: "s1", name: "S1", stations: [{ name: "C" }, { name: "D" }] }] },
    ];
    expect(resolveCatalogSelection(regions, "s1")).toEqual({ regionId: "south", lineId: "s1" });
    expect(resolveCatalogSelection(regions, "gone")).toEqual({ regionId: "north", lineId: "n1" });
  });

  it("uses only verified destinations in a matching static fallback", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 502 })).mockResolvedValueOnce(Response.json(catalog()));
    const result = await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", origin: "Tokyo", headers: {} }, fetcher);
    expect(result.ok).toBe(true);
    expect(result.data.stations).toEqual(["B"]);
    expect(fetcher.mock.calls[1][0]).toBe("/catalog/japan.json");
  });
  it.each([catalog("japan", "2026-08-07"), catalog("korea"), { ...catalog(), lines: [null] }])("rejects a mismatched or malformed fallback", async data => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 502 })).mockResolvedValueOnce(Response.json(data));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
  });
  it.each([400, 404, 429, 200])("does not use fallback for status %s with invalid JSON", async status => {
    const fetcher = vi.fn(async () => new Response("broken", { status }));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("safely rejects corrupt static JSON", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response("broken"));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
  });
  it("keeps provider pairs unbounded in a matching fallback", async () => {
    const data = catalog("united_kingdom");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json(data));
    const result = await loadStationBrowserCatalog({ country: "united_kingdom", date: data.serviceDate, origin: "Tokyo", headers: {} }, fetcher);
    expect(result.data.stations).toEqual(data.stations);
  });
  it("offers no unverified destinations when an older artifact lacks pairs", async () => {
    const data = { ...catalog(), destinationsByOrigin: undefined };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json(data));
    const result = await loadStationBrowserCatalog({ country: "japan", date: data.serviceDate, origin: "Tokyo", headers: {} }, fetcher);
    expect(result.data.stations).toEqual([]);
  });
});
