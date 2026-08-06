import type { Country, TransitLine } from "../types";
import type { ScrapedRouteData } from "./scraped/timetableDay";

/** Provider markets whose line catalog is built from verified route snapshots. */
export const snapshotRouteCountries: readonly Country[] = [
  "belgium",
  "norway",
  "united_states",
];

const routeColors: Partial<Record<Country, string>> = {
  belgium: "#0055A4",
  norway: "#8B1D3D",
  united_states: "#2563EB",
};

function slugPart(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "route";
}

function uniqueStations(names: string[]): string[] {
  const seen = new Set<string>();
  const stations: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    stations.push(trimmed);
  }
  return stations;
}

function representativeStations(route: ScrapedRouteData, date?: string): string[] {
  const result = route.results.find((candidate) => !date || candidate.date === date);
  if (!result) return [];
  return uniqueStations([
    result.origin || route.origin,
    ...(result?.stops || []),
    result.destination || route.destination,
  ]);
}

function lineId(country: Country, origin: string, destination: string, index: number): string {
  return `${country}-route-${slugPart(origin)}-${slugPart(destination)}-${index + 1}`;
}

function snapshotLines(country: Country, routes: readonly ScrapedRouteData[], date?: string): TransitLine[] {
  return routes.map((route, index): TransitLine | undefined => {
    const stations = representativeStations(route, date);
    const result = route.results.find((candidate) => !date || candidate.date === date);
    if (!result || stations.length < 2) return undefined;
    return {
      id: lineId(country, route.origin, route.destination, index),
      // Use the same canonical endpoint spelling as the station buttons. Some
      // provider route definitions use a local spelling (e.g. Gent/Antwerpen),
      // while the live station catalogue returns the English station name.
      name: `${stations[0] || route.origin} → ${stations.at(-1) || route.destination}`,
      color: result.lineColor || routeColors[country],
      stations: stations.map((name) => ({ name })),
    } satisfies TransitLine;
  }).filter((line): line is TransitLine => Boolean(line));
}

/** Build the route cards used by the station picker for provider markets. */
export function getProviderRouteLines(
  country: Country,
  routes: readonly ScrapedRouteData[],
  date?: string,
): TransitLine[] {
  if (!snapshotRouteCountries.includes(country)) return [];
  return snapshotLines(country, routes, date);
}

/** Preserve live provider lines while adding verified snapshot route cards. */
export function mergeCatalogLines(
  providerLines: readonly TransitLine[],
  snapshotLines: readonly TransitLine[],
): TransitLine[] {
  const seen = new Set(providerLines.map((line) => line.id));
  return [
    ...providerLines,
    ...snapshotLines.filter((line) => {
      if (seen.has(line.id)) return false;
      seen.add(line.id);
      return true;
    }),
  ];
}
