/**
 * Station identity for menu ↔ search agreement.
 *
 * Search matches English names via {@link stationSearchKey}. The station picker
 * and offline audit must use the same static menu membership; live-provider
 * menus (UK/US/Belgium) return null from {@link getStaticMenuStations}.
 */
import { japanStations, koreaStations } from "./stations";
import { seoulSubwayStationNames } from "./seoulSubway";
import { hongKongMtrLines, hongKongStations } from "./hongKongMtr";
import { newCountryStationLists } from "./scraped/stations";
import { norwayFeaturedStations } from "./norway";
import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
  switzerlandRailLines,
} from "./metroLines";
import type { TransitLine } from "../types";
import { stationSearchKey } from "./stationKey";

export { stationSearchKey } from "./stationKey";

export function isStationInMenu(menu: readonly string[], name: string): boolean {
  const key = stationSearchKey(name);
  return menu.some((station) => stationSearchKey(station) === key);
}

/** Line graphs that contribute station names into the static menu union. */
const staticLineSets: Record<string, TransitLine[]> = {
  singapore: singaporeMrtLines,
  thailand: thailandTransitLines,
  china: chinaRailLines,
  germany: germanyRailLines,
  france: franceRailLines,
  switzerland: switzerlandRailLines,
};

function uniqueSorted(names: string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

/**
 * Offline station menu for a country.
 * @returns station English names, or `null` when the menu is live (TfL/MBTA/iRail)
 *          and cannot be verified without calling the provider.
 */
export function getStaticMenuStations(country: string): string[] | null {
  if (country === "japan") {
    return japanStations;
  }
  if (country === "korea") {
    return uniqueSorted([...koreaStations, ...seoulSubwayStationNames]);
  }
  if (country === "hong_kong") {
    return hongKongStations;
  }
  if (country === "norway") {
    return norwayFeaturedStations;
  }
  if (country === "united_kingdom" || country === "united_states" || country === "belgium") {
    return null;
  }
  if (newCountryStationLists[country]) {
    const fromLines = (staticLineSets[country] || []).flatMap((line) =>
      line.stations.map((s) => s.name),
    );
    return uniqueSorted([...newCountryStationLists[country], ...fromLines]);
  }
  // malaysia and unknown: no pure static list in this module
  return null;
}

/**
 * Route endpoints that are missing from the menu (empty when menu is live/null).
 * Labels are human-readable for audit scripts.
 */
export function missingRouteEndpoints(
  menu: readonly string[] | null,
  origin: string,
  destination: string,
): string[] {
  if (!menu) return [];
  const missing: string[] = [];
  if (!isStationInMenu(menu, origin)) missing.push(`origin "${origin}"`);
  if (!isStationInMenu(menu, destination)) missing.push(`destination "${destination}"`);
  return missing;
}

/** MTR Next Train station codes keyed by {@link stationSearchKey}(English name). */
const hongKongNameToCode: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const line of hongKongMtrLines) {
    for (const station of line.stations) {
      const key = stationSearchKey(station.name);
      // Same station code appears on multiple lines; first write wins (codes agree).
      if (!map.has(key)) map.set(key, station.code);
    }
  }
  return map;
})();

const hongKongCodeToName: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const line of hongKongMtrLines) {
    for (const station of line.stations) {
      const codeKey = station.code.toUpperCase();
      if (!map.has(codeKey)) map.set(codeKey, station.name);
    }
  }
  return map;
})();

/** MTR Next Train station code for an English station name. */
export function getHongKongStationCode(name: string): string | undefined {
  return hongKongNameToCode.get(stationSearchKey(name));
}

/** Canonical English menu name for an MTR station code. */
export function getHongKongStationName(code: string): string | undefined {
  if (!code) return undefined;
  return hongKongCodeToName.get(code.toUpperCase().trim());
}

/**
 * Provider station code for live APIs.
 * Only Hong Kong is wired today; other countries return undefined.
 */
export function getProviderStationCode(country: string, name: string): string | undefined {
  if (country === "hong_kong") return getHongKongStationCode(name);
  return undefined;
}

/** Canonical English name for a provider station code (HK MTR today). */
export function getProviderStationName(country: string, code: string): string | undefined {
  if (country === "hong_kong") return getHongKongStationName(code);
  return undefined;
}
