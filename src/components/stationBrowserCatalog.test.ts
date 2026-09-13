import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStationBrowserCatalog, resetStationBrowserCatalogCache, resolveCatalogSelection, STATION_CATALOG_API_TIMEOUT_MS } from "./stationBrowserCatalog";

afterEach(() => { resetStationBrowserCatalogCache(); vi.useRealTimers(); });

const catalog = (country = "japan", serviceDate = "2026-08-08", station = "Tokyo") => {
  const line = { id: "line", name: "Line", stations: [{ name: station }, { name: "B" }] };
  return { country, serviceDate, regions: [{ id: "region", name: "Region", lines: [line] }], lines: [line], stations: [station, "B"], coverage: { mode: country === "united_kingdom" ? "provider" : "scraped", date: serviceDate }, destinationsByOrigin: { [station]: ["B"] } };
};

describe("station browser catalog hydration", () => {
  it("shares one request for a stable country/date/origin context", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(catalog()));
    const request = { country: "japan", date: "2026-08-08", headers: {} };

    const [first, second] = await Promise.all([
      loadStationBrowserCatalog(request, fetcher),
      loadStationBrowserCatalog(request, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data.stations).toEqual(["Tokyo", "B"]);
    expect(second).toEqual(first);
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/japan.json");
  });

  it("uses a new request only when date or origin coverage changes", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", headers: {} }, fetcher);
    await loadStationBrowserCatalog({ country: "japan", date: "2026-08-09", origin: "Tokyo", headers: {} }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(6);
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

  it("uses only verified destinations in a matching static catalog", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(catalog()));
    const result = await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", origin: "Tokyo", headers: {} }, fetcher);
    expect(result.ok).toBe(true);
    expect(result.data.stations).toEqual(["B"]);
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/japan.json");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([catalog("japan", "2026-08-07"), catalog("korea"), { ...catalog(), lines: [null] }])("rejects a mismatched or malformed fallback", async data => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(data)).mockResolvedValueOnce(new Response("", { status: 502 }));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
  });
  it.each([400, 404, 429, 200])("returns failure when both static and API reads fail with status %s", async status => {
    const fetcher = vi.fn(async () => new Response("broken", { status }));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("safely rejects corrupt static JSON", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response("broken"));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(false);
  });
  it("keeps provider pairs unbounded in a matching fallback", async () => {
    const data = catalog("united_kingdom");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(data));
    const result = await loadStationBrowserCatalog({ country: "united_kingdom", date: data.serviceDate, origin: "Tokyo", headers: {} }, fetcher);
    expect(result.data.stations).toEqual(data.stations);
  });
  it("offers no unverified destinations when an older artifact lacks pairs", async () => {
    const data = { ...catalog(), destinationsByOrigin: undefined };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(data));
    const result = await loadStationBrowserCatalog({ country: "japan", date: data.serviceDate, origin: "Tokyo", headers: {} }, fetcher);
    expect(result.data.stations).toEqual([]);
  });
});


describe("static catalog applicability and timeouts", () => {
  const request = { country: "united_kingdom", date: "2026-08-09", origin: "Tokyo", headers: { "X-Test": "audit" } };
  const providerCatalog = () => ({
    ...catalog("united_kingdom"),
    coverage: { mode: "provider", date: "2026-08-08", dateRange: { start: "2026-08-08", end: "2026-08-10", days: 3, liveOnly: false } },
  });

  it.each(["2026-08-08", "2026-08-09", "2026-08-10"])("uses provider JSON within its valid range on %s without contacting the API", async date => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(providerCatalog()));
    const result = await loadStationBrowserCatalog({ ...request, date }, fetcher);
    expect(result.ok).toBe(true);
    expect(result.data.stations).toEqual(["Tokyo", "B"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/united_kingdom.json");
  });

  it.each(["2026-08-07", "2026-08-11"])("queries the API outside the provider range on %s", async date => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(providerCatalog()))
      .mockResolvedValueOnce(Response.json(catalog("united_kingdom", date)));
    expect((await loadStationBrowserCatalog({ ...request, date }, fetcher)).ok).toBe(true);
    expect(fetcher.mock.calls[1][0]).toBe(`/api/transit/catalog?country=united_kingdom&date=${date}&origin=Tokyo`);
    expect(fetcher.mock.calls[1][1].headers).toEqual(request.headers);
  });

  it.each([
    { ...providerCatalog(), coverage: { mode: "provider", date: "2026-08-08" } },
    { ...providerCatalog(), country: "japan", coverage: { ...providerCatalog().coverage, mode: "scraped" } },
    { ...providerCatalog(), coverage: { ...providerCatalog().coverage, dateRange: { start: "2026-08-10", end: "2026-08-08", days: -1, liveOnly: false } } },
  ])("does not relax exact dates for scraped coverage, a missing range, or an invalid range", async data => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(data))
      .mockResolvedValueOnce(Response.json(catalog(data.country, request.date)));
    const result = await loadStationBrowserCatalog({ ...request, country: data.country }, fetcher);
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([null, "broken", { ...catalog(), lines: [null] }, catalog("korea")])("queries the API after missing, corrupt, malformed or wrong-country JSON", async data => {
    const fetcher = vi.fn().mockResolvedValueOnce(data === null ? new Response("", { status: 404 }) : typeof data === "string" ? new Response(data) : Response.json(data))
      .mockResolvedValueOnce(Response.json(catalog()));
    expect((await loadStationBrowserCatalog({ country: "japan", date: "2026-08-08", headers: {} }, fetcher)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["headers", "body"])("bounds stalled API %s, aborts it and allows a real retry", async phase => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockImplementationOnce(async (_, init) => {
        signal = init?.signal as AbortSignal;
        if (phase === "headers") return new Promise<Response>(() => {});
        return { ok: true, json: () => new Promise(() => {}) } as Response;
      });
    const pending = loadStationBrowserCatalog(request, fetcher);
    await vi.advanceTimersByTimeAsync(STATION_CATALOG_API_TIMEOUT_MS);
    expect((await pending).ok).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    fetcher.mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json(catalog("united_kingdom", request.date)));
    expect((await loadStationBrowserCatalog(request, fetcher)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("bounds a stalled static file before trying the API", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(Response.json(catalog("united_kingdom", request.date)));
    const pending = loadStationBrowserCatalog(request, fetcher);
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).ok).toBe(true);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not mutate shared JSON when filtering a destination request", async () => {
    const data = catalog();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => data }) as Response);
    const base = { country: "japan", date: data.serviceDate, headers: {} };
    expect((await loadStationBrowserCatalog({ ...base, origin: "Tokyo" }, fetcher)).data.stations).toEqual(["B"]);
    expect((await loadStationBrowserCatalog(base, fetcher)).data.stations).toEqual(["Tokyo", "B"]);
    expect(data.coverage).not.toHaveProperty("destinations");
  });
});
