import type { Country } from "../types";
import { countryOptions } from "../data/countries";

export const seoCountryPathMap: Record<Country, string> = {
  japan: "/japan",
  korea: "/korea",
  china: "/china",
  singapore: "/singapore",
  malaysia: "/malaysia",
  thailand: "/thailand",
  hong_kong: "/hong-kong",
  united_kingdom: "/united-kingdom",
  united_states: "/united-states",
  germany: "/germany",
  france: "/france",
  belgium: "/belgium",
  norway: "/norway",
  switzerland: "/switzerland",
};

const pathCountryMap: Record<string, Country> = {
  "/japan": "japan",
  "/korea": "korea",
  "/china": "china",
  "/singapore": "singapore",
  "/malaysia": "malaysia",
  "/thailand": "thailand",
  "/hong-kong": "hong_kong",
  "/hong_kong": "hong_kong",
  "/united-kingdom": "united_kingdom",
  "/united_kingdom": "united_kingdom",
  "/united-states": "united_states",
  "/united_states": "united_states",
  "/germany": "germany",
  "/france": "france",
  "/belgium": "belgium",
  "/norway": "norway",
  "/switzerland": "switzerland",
};

export function countryFromPath(pathname: string): Country | undefined {
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  const country = pathCountryMap[normalizedPath];
  return country && countryOptions.includes(country) ? country : undefined;
}

/**
 * The canonical path the SPA declares for the URL it was loaded at, or null
 * when the URL names no indexable page.
 *
 * It names the page, never the search state. Deriving it from the search form
 * made the homepage declare `/united-states?timeMode=all_day&date=<today>` for
 * any visitor (Googlebot included) whose timezone picked that market — a new,
 * dated canonical every day, so Google indexed neither. The homepage stays "/"
 * whatever market is selected; a market path collapses to its prerendered
 * index page, which declares the same trailing-slash canonical. Any other path
 * reaching the SPA fallback is a soft 404 and must not be indexed.
 */
export function canonicalPathFor(pathname: string): string | null {
  if (pathname.replace(/\/+$/, "") === "") return "/";
  const country = countryFromPath(pathname);
  return country ? `${seoCountryPathMap[country]}/` : null;
}
