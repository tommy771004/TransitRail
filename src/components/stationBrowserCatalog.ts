import type { TransitLine } from "../types";
import type { StationCoverage } from "../data/stationCoverage";
import type { ServiceRegion } from "../server/catalog";

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
  const key = requestKey(request);
  const existing = requests.get(key);
  if (existing) return existing;
  const pending = fetcher(`/api/transit/catalog?${key}`, { headers: request.headers })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data: data as StationBrowserCatalogPayload })))
    .catch(() => ({ ok: false, data: {} as StationBrowserCatalogPayload }));
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
