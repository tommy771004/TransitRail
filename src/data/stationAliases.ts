/**
 * Alternate spellings that mean the same physical station as a timetable endpoint.
 *
 * Korea's station menu is the union of two naming systems: `koreaStations`
 * (Korail intercity, e.g. `Seoul (SNC)`) and `seoulSubwayStationNames` (Seoul
 * Metro, e.g. `Seoul Station`). Both land in the picker, so a user can pick the
 * subway label for a station whose timetables are filed under the Korail label
 * and get a 404 for a corridor that is fully covered.
 *
 * These are same-station identities only — never "near here" or "same city".
 * Mapping two genuinely different stations together would silently answer a
 * search with the wrong platform's departures.
 */
import type { Country } from "../types";
import { stationSearchKey } from "./stationKey";

/** Keyed by {@link stationSearchKey}(alias) → canonical timetable spelling. */
const aliasesByCountry: Partial<Record<Country, Record<string, string>>> = {
  korea: {
    // Seoul Metro Line 1/4 label for the Korail terminus (서울역).
    "seoul station": "Seoul (SNC)",
    // Operator code stripped — what tidyStationName() shows on route pages.
    seoul: "Seoul (SNC)",
    busan: "Busan (BSN)",
    // Busan Metro Line 1 label for the same terminus (부산역).
    "busan station": "Busan (BSN)",
  },
  thailand: {
    // BTS/MRT names for the same interchange complex.
    asok: "Sukhumvit",
    "si lom": "Sala Daeng",
    "chatuchak park": "Mo Chit",
    "phahon yothin": "Ha Yaek Lat Phrao",
  },
  hong_kong: {
    // MTR interchange complexes are labelled differently by line and by data
    // provider, but are one walkable station choice in the picker.
    "hong kong": "Central",
    "east tsim sha tsui": "Tsim Sha Tsui",
  },
};

/**
 * Canonical timetable spelling for `name`, or `name` unchanged when it is not
 * a known alias. Case-insensitive; safe to call on any user input.
 */
export function resolveStationAlias(country: Country | undefined, name: string): string {
  if (!country || !name) return name;
  return aliasesByCountry[country]?.[stationSearchKey(name)] ?? name;
}

/** Every alias spelling registered for a country's canonical station name. */
export function aliasesForStation(country: Country | undefined, canonical: string): string[] {
  if (!country) return [];
  const table = aliasesByCountry[country];
  if (!table) return [];
  const target = stationSearchKey(canonical);
  return Object.entries(table)
    .filter(([, value]) => stationSearchKey(value) === target)
    .map(([alias]) => alias);
}
