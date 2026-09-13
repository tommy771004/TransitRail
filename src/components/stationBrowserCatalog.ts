import type { TransitLine } from "../types";
import type { StationCoverage } from "../data/stationCoverage";
import type { ServiceRegion } from "../server/catalog";
import { isCalendarDate, isServiceRegionCatalog } from "../data/serviceRegionCatalog";
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

export const STATION_CATALOG_API_TIMEOUT_MS = 8_000;
const STATIC_CATALOG_TIMEOUT_MS = 3_000;

/** Bound the whole read, including a stalled response body, and release the connection. */
async function fetchCatalogJson(fetcher: typeof fetch, url: string, timeoutMs: number, headers?: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { headers, signal: controller.signal });
        if (!response.ok) throw new Error("Station catalog unavailable");
        return await response.json();
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Station catalog timed out"));
        }, timeoutMs);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

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
  if (!isCalendarDate(serviceDate)) return Promise.resolve({ ok: false, data: {} });
  const key = requestKey({ ...request, date: serviceDate });
  const existing = requests.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const snapshot = await fetchCatalogJson(fetcher, `/catalog/${request.country}.json`, STATIC_CATALOG_TIMEOUT_MS);
    if (isServiceRegionCatalog(snapshot, { country: request.country })) {
      const range = snapshot.coverage.dateRange;
      // A provider directory is reusable within its published range. Verified
      // snapshot pairs remain tied to one exact service day, never a timetable fallback.
      const applicable = snapshot.serviceDate === serviceDate || (
        snapshot.coverage.mode === "provider" && range !== undefined
        && range.start <= serviceDate && serviceDate <= range.end
      );
      if (applicable) {
        if (request.origin && snapshot.coverage.mode !== "provider") {
          const destinations = Object.hasOwn(snapshot.destinationsByOrigin ?? {}, request.origin)
            ? snapshot.destinationsByOrigin![request.origin] : [];
          const stations = snapshot.stations.filter(station => destinations.includes(station));
          return { ok: true, data: { ...snapshot, stations, coverage: {
            ...snapshot.coverage, destinations: stations,
            ...(!stations.length ? { messageKey: "stations.no_verified_destinations_for_origin" as const } : {}),
          } } };
        }
        return { ok: true, data: snapshot };
      }
    }
    const data = await fetchCatalogJson(fetcher, `/api/transit/catalog?${key}`, STATION_CATALOG_API_TIMEOUT_MS, request.headers);
    if (!isServiceRegionCatalog(data, { country: request.country, serviceDate, allowStationSubset: Boolean(request.origin) })) return { ok: false, data: {} };
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
