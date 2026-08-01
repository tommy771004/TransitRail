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
import type { Country } from "../types";
import { stationSearchKey } from "./stationKey";
import { resolveStationAlias } from "./stationAliases";
import { getCountryCapability } from "./countryCapability";
import { providerDateValue } from "./countries";
import {
  classifyTimetable,
  isVerifiableTimetable,
  timetableSliceForDate,
  type TimetableAuthenticityOptions,
} from "./timetableAuthenticity";
import { findInRoutes, type ScrapedRouteData } from "./scraped/timetableDay";

/**
 * How a country's searchable stations are bounded.
 * - `scraped`: finite, enumerable from the committed route files.
 * - `provider`: a live journey planner answers arbitrary pairs — the menu is
 *   the contract and nothing can be pre-declared uncovered.
 * - `catalog_only`: station list without timetables at all (Malaysia).
 */
export type CoverageMode = "scraped" | "provider" | "catalog_only";

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
  message?: string;
  sourceUrl?: string;
}

/**
 * The metro integrity rollout is intentionally scoped away from the existing
 * long-distance rail markets. China/Germany/France/Belgium/Norway/Switzerland
 * keep their HSR/intercity presentation until that data contract is reviewed;
 * mixed Japan/Korea stay strict so the verified metro catalogs do not expose
 * their synthetic/curated rail snapshots as metro coverage.
 */
const INTERCITY_AUTHENTICITY_EXEMPT_COUNTRIES = new Set<Country>([
  "china",
  "germany",
  "france",
  "belgium",
  "norway",
  "switzerland",
]);

export function usesStrictTimetableGate(country?: Country): boolean {
  return country !== undefined && !INTERCITY_AUTHENTICITY_EXEMPT_COUNTRIES.has(country);
}

function authenticityOptions(country?: Country): TimetableAuthenticityOptions {
  if (!country || !getCountryCapability(country).liveOnly) return {};
  return {
    realtimeTodayOnly: true,
    today: providerDateValue(country),
  };
}

/** Route slices that are safe to expose as searchable timetable data. */
export function verifiableRoutesForDate(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): ScrapedRouteData[] {
  const options = authenticityOptions(country);
  return routes.flatMap((route) => {
    const rows = timetableSliceForDate(route, date);
    const authenticity = classifyTimetable(
      { ...route, results: rows },
      date,
      options,
    );
    if (!isVerifiableTimetable(authenticity)) return [];
    return [{ ...route, results: rows }];
  });
}

/**
 * Routes exposed to the app's bounded station/search graph. Intercity data is
 * deliberately left on its existing contract; the other configured markets
 * are rejected when their dated slice is indicative/stale.
 */
export function searchableRoutesForDate(
  routes: readonly ScrapedRouteData[],
  country?: Country,
  date?: string,
): ScrapedRouteData[] {
  if (usesStrictTimetableGate(country)) {
    return verifiableRoutesForDate(routes, country, date);
  }
  return routes.flatMap((route) => {
    const rows = timetableSliceForDate(route, date);
    return rows.length > 0 ? [{ ...route, results: rows }] : [];
  });
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
      for (const stop of result.stops || []) add(stop);
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
  const verified = searchableRoutesForDate(routes, country, date);
  const candidates = coveredEndpointNames(verified, country, date);
  return candidates
    .filter((destination) => stationSearchKey(resolveStationAlias(country, destination)) !== stationSearchKey(resolveStationAlias(country, origin)))
    .filter((destination) => findInRoutes(verified, origin, destination, date, country)?.length);
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
