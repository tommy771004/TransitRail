import type { TransitLine } from "../types";
import type { StationCoverage } from "../data/stationCoverage";
import type { ServiceRegion } from "../server/catalog";
import { isServiceRegionCatalog } from "../data/serviceRegionCatalog";
import { configuredCountryOptions, providerDateValue } from "../data/countries";
import type { Country } from "../types";

export interface StationBrowserCatalogPayload {
  regions?: ServiceRegion[];
  lines?: TransitLine[];
  stations?: string[];
  stationSource?: string;
  coverage?: StationCoverage;
}

export interface StationBrowserCatalogRequest {
  country: string;
  date?: string;
  origin?: string;
  headers: Record<string, string>;
}

const requests = new Map<string, Promise<{ ok: boolean; data: StationBrowserCatalogPayload }>>();

function requestKey({ country, date, origin }: StationBrowserCatalogRequest): string {
  return new URLSearchParams({
    country,
    ...(date ? { date } : {}),
    ...(origin ? { origin } : {}),
  }).toString();
}

/** One shared, cacheable operation for a stable station-browser context. */
export function loadStationBrowserCatalog(
  request: StationBrowserCatalogRequest,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; data: StationBrowserCatalogPayload }> {
  if (!configuredCountryOptions.includes(request.country as Country)) return Promise.resolve({ ok: false, data: {} });
  const serviceDate = request.date || providerDateValue(request.country as Country);
  const key = requestKey({ ...request, date: serviceDate });
  const existing = requests.get(key);
  if (existing) return existing;
  const pending = (async () => {
    let response: Response;
    let fallback = false;
    try {
      response = await fetcher(`/api/transit/catalog?${key}`, { headers: request.headers });
      fallback = response.status >= 500 && response.status <= 599;
    } catch {
      fallback = true;
    }
    if (fallback) response = await fetcher(`/catalog/${request.country}.json`);
    if (!response!.ok) return { ok: false, data: {} };
    const data: unknown = await response!.json();
    if (!isServiceRegionCatalog(data, { country: request.country, serviceDate, allowStationSubset: !fallback && Boolean(request.origin) })) return { ok: false, data: {} };
    if (fallback && request.origin && data.coverage.mode !== "provider") {
      const destinations = Object.hasOwn(data.destinationsByOrigin ?? {}, request.origin)
        ? data.destinationsByOrigin![request.origin] : [];
      data.stations = data.stations.filter(station => destinations.includes(station));
      data.coverage = { ...data.coverage, destinations: data.stations };
      if (!data.stations.length) data.coverage.messageKey = "stations.no_verified_destinations_for_origin";
    }
    return { ok: true, data };
  })()
    .then((result) => {
      if (!result.ok) requests.delete(key);
      return result;
    })
    .catch(() => {
      requests.delete(key);
      return { ok: false, data: {} as StationBrowserCatalogPayload };
    });
  requests.set(key, pending);
  return pending;
}

/** Test-only cache reset; production state lives for the browser session. */
export function resetStationBrowserCatalogCache() {
  requests.clear();
}

/** Restore a still-valid line, otherwise choose the first browsable region/line. */
export function resolveCatalogSelection(regions: readonly ServiceRegion[], lineId?: string) {
  const restored = regions.find((region) => region.lines.some((line) => line.id === lineId));
  const region = restored || regions[0];
  return {
    regionId: region?.id || "",
    lineId: lineId && region?.lines.some((line) => line.id === lineId)
      ? lineId
      : region?.lines[0]?.id || "",
  };
}
