/**
 * Which menu stations search can actually answer for.
 *
 * The station picker and the timetable data are built from two different
 * graphs: the picker offers every station on a country's line map (Seoul's 305
 * subway stations, Singapore's 145 MRT stations), while
 * {@link findInRoutes} only ever matches names that appear as an endpoint in
 * `src/data/scraped/<country>/*.json` (Korea: 8). A pair that the line map says
 * is a trivial two-stop ride can therefore 404, which is what
 * `Cheongnyangni → Seoul Station` did.
 *
 * Search still never synthesizes a schedule for the gap — this module just
 * makes the gap describable, so the picker can mark the dead stations and the
 * no-data response can name the one that is missing.
 */
import type { Country, TimetableProvenance, TimetableTruthMode } from "../types";
import { stationSearchKey } from "./stationKey";
import { resolveStationAlias } from "./stationAliases";
import { getCountryCapability } from "./countryCapability";
import {
  searchableRoutesForContext,
  usesStrictCatalogGate,
} from "./searchabilityPolicy";
import type { SearchabilityRejectionReason } from "./searchabilityPolicy";
import type { ScrapedRouteData } from "./scraped/timetableDay";

export { usesStrictCatalogGate } from "./searchabilityPolicy";

/**
 * How a country's searchable stations are bounded.
 * - `scraped`: finite, enumerable from the committed route files.
 * - `provider`: a live journey planner answers arbitrary pairs — the menu is
 *   the contract and nothing can be pre-declared uncovered.
 * - `catalog_only`: station list without timetables at all (Malaysia).
 */
export type CoverageMode = "scraped" | "provider" | "catalog_only";

/** Translation keys for catalogue states. The API sends a semantic state, not UI copy. */
export type StationCatalogMessageKey =
  | "stations.invalid_country"
  | "stations.unavailable"
  | "stations.catalog_only_no_timetable"
  | "stations.no_registered_timetable_source"
  | "stations.no_verified_timetable_for_date"
  | "stations.no_verified_timetable_current"
  | "stations.no_verified_searchable_lines_for_date"
  | "stations.no_verified_destinations_for_origin";

/** Station coverage for one country, as served to the picker. */
export interface StationCoverage {
  mode: CoverageMode;
  /**
   * Menu names search can resolve. `undefined` for `provider` mode, where the
   * set is unbounded — distinct from an empty array, which means nothing works.
   */
  covered?: string[];
  /** Date-conditioned destinations for the selected origin, when requested. */
  destinations?: string[];
  date?: string;
  dateRange?: {
    start: string;
    end: string;
    days: number;
    liveOnly: boolean;
  };
  /** Semantic UI state; translate this in the client for the active locale. */
  messageKey?: StationCatalogMessageKey;
  sourceUrl?: string;
  provenance?: TimetableProvenance | "unknown";
  truthMode?: TimetableTruthMode;
  reason?: SearchabilityRejectionReason;
}

/** Route slices that are safe to expose as searchable timetable data. */
export function verifiableRoutesForDate(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): ScrapedRouteData[] {
  if (!country) return routes.map((route) => ({ ...route }));
  return searchableRoutesForContext(routes, {
    country,
    serviceDay: date,
  }).routes.filter((route) => route.truthMode === "verified");
}

/**
 * Routes exposed to the app's bounded station/search graph. Every market is
 * held to the same bar: a dated slice that no registered official source
 * vouches for is not exposed, whatever kind of service the country runs.
 */
export function searchableRoutesForDate(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): ScrapedRouteData[] {
  if (!country) {
    return routes.flatMap((route) => {
      const rows = date
        ? route.results.filter((result) => (result.date || "").trim() === date.trim())
        : route.results;
      return rows.length > 0 ? [{ ...route, results: rows }] : [];
    });
  }
  return searchableRoutesForContext(routes, { country, serviceDay: date }).routes;
}

export function coverageModeFor(country: Country): CoverageMode {
  const { search } = getCountryCapability(country);
  if (search.kind === "catalog_only") return "catalog_only";
  // `provider_then_scraped` (Switzerland) still answers arbitrary pairs live,
  // so its menu is not bounded by the snapshot files.
  if (search.kind === "provider" || search.kind === "provider_then_scraped") return "provider";
  return "scraped";
}

/**
 * Search keys usable as a journey endpoint.
 *
 * Both the file-level origin/destination and each result's own origin/
 * destination count, because {@link findInRoutes} matches on either (a
 * mixed-destination snapshot file resolves via the result level). Transfer
 * chaining only ever links endpoints already in this set, so it adds no names.
 *
 * Intermediate `stops` are deliberately NOT endpoints. A train calling at a
 * station does not make that station searchable — `findInRoutes` matches
 * origin/destination and never reads `stops`, so counting them here would offer
 * names the picker can hand to a search that must answer nothing. Japan has 11
 * such stations today (Kuramae, Asakusabashi, …) and China 3. If they should
 * become searchable, the fix is in the matcher, not in this set.
 */
export function coveredStationKeys(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): Set<string> {
  const keys = new Set<string>();
  const add = (name: string | undefined) => {
    if (name) keys.add(stationSearchKey(resolveStationAlias(country, name)));
  };
  for (const route of searchableRoutesForDate(routes, country, date)) {
    add(route.origin);
    add(route.destination);
    for (const result of route.results || []) {
      add(result.origin);
      add(result.destination);
    }
  }
  return keys;
}

/**
 * True when `name` resolves to a timetable endpoint, following same-station
 * aliases so a menu spelling counts as covered when the data files it under a
 * different naming system.
 */
export function hasCoverage(
  keys: ReadonlySet<string>,
  name: string,
  country?: Country,
): boolean {
  return keys.has(stationSearchKey(resolveStationAlias(country, name)));
}

/**
 * Menu names that appear as a timetable endpoint, in menu order.
 * Returns menu spellings (not the scraped ones) so the result can be handed
 * straight back to the picker and to search.
 */
export function coveredMenuStations(
  menu: readonly string[],
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): string[] {
  const keys = coveredStationKeys(routes, country, date);
  return menu.filter((station) => hasCoverage(keys, station, country));
}

/**
 * Distinct station names usable as a journey endpoint, sorted for display.
 * Uses the scraped spellings, so every name is guaranteed to resolve even when
 * no static menu exists for the country.
 */
export function coveredEndpointNames(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): string[] {
  const byKey = new Map<string, string>();
  const add = (name: string | undefined) => {
    if (!name) return;
    const key = stationSearchKey(resolveStationAlias(country, name));
    if (!byKey.has(key)) byKey.set(key, name);
  };
  for (const route of searchableRoutesForDate(routes, country, date)) {
    add(route.origin);
    add(route.destination);
    for (const result of route.results || []) {
      add(result.origin);
      add(result.destination);
      for (const stop of result.stops || []) add(stop);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

/** Menu names with no timetable data behind them, in menu order. */
export function uncoveredMenuStations(
  menu: readonly string[],
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): string[] {
  const keys = coveredStationKeys(routes, country, date);
  return menu.filter((station) => !hasCoverage(keys, station, country));
}

/** Destinations that the same oracle can actually resolve from `origin`. */
export function reachableDestinations(
  routes: readonly ScrapedRouteData[],
  origin: string,
  country: Country,
  date: string,
): string[] {
  return searchableRoutesForContext(routes, {
    country,
    serviceDay: date,
    origin,
  }).reachableDestinations;
}

/** True when `name` can be used as a journey endpoint under `coverage`. */
export function isStationCovered(
  coverage: StationCoverage | undefined,
  name: string,
  country?: Country,
): boolean {
  // No coverage list (provider mode, or coverage not computed) means unbounded.
  if (!coverage?.covered) return true;
  const key = stationSearchKey(resolveStationAlias(country, name));
  return coverage.covered.some((station) => stationSearchKey(resolveStationAlias(country, station)) === key);
}
