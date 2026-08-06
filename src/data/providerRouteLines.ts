import type { Country, TransitLine } from "../types";
import type { ScrapedRouteData } from "./scraped/timetableDay";

/** Markets whose station picker must start with a supported route. */
export const routeFirstStationCountries: readonly Country[] = [
  "belgium",
  "norway",
  "united_states",
];

const routeColors: Partial<Record<Country, string>> = {
  belgium: "#0055A4",
  norway: "#8B1D3D",
  united_states: "#2563EB",
};

/**
 * A small offline fallback keeps the route-first UI usable while a provider
 * route snapshot is being refreshed. The live snapshot path below adds every
 * stop it knows about; these definitions intentionally only promise endpoints.
 */
const fallbackRoutes: Partial<Record<Country, Array<{ origin: string; destination: string }>>> = {
  belgium: [
    { origin: "Brussels-Central", destination: "Antwerp-Central" },
    { origin: "Brussels-Luxemburg/Brussels-Luxembourg", destination: "Antwerp-Central" },
    { origin: "Ghent-Sint-Pieters", destination: "Brussels Airport - Zaventem" },
    { origin: "Brugge", destination: "Liège-Guillemins" },
    { origin: "Brussels-South/Brussels-Midi", destination: "Namur" },
  ],
  norway: [
    { origin: "Oslo S", destination: "Bergen stasjon" },
    { origin: "Oslo S", destination: "Trondheim S" },
    { origin: "Oslo S", destination: "Stavanger stasjon" },
    { origin: "Oslo lufthavn", destination: "Lillehammer" },
    { origin: "Trondheim S", destination: "Bodø stasjon" },
  ],
  united_states: [
    { origin: "Harvard", destination: "Logan International Airport" },
    { origin: "Park Street", destination: "Andrew" },
    { origin: "Park Street", destination: "Boston College" },
    { origin: "South Station", destination: "Harvard" },
  ],
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
  const result = route.results.find((candidate) => !date || candidate.date === date)
    || route.results[0];
  return uniqueStations([
    result?.origin || route.origin,
    ...(result?.stops || []),
    result?.destination || route.destination,
  ]);
}

function lineId(country: Country, origin: string, destination: string, index: number): string {
  return `${country}-route-${slugPart(origin)}-${slugPart(destination)}-${index + 1}`;
}

function snapshotLines(country: Country, routes: readonly ScrapedRouteData[], date?: string): TransitLine[] {
  return routes.map((route, index) => {
    const stations = representativeStations(route, date);
    const result = route.results.find((candidate) => !date || candidate.date === date)
      || route.results[0];
    return {
      id: lineId(country, route.origin, route.destination, index),
      // Use the same canonical endpoint spelling as the station buttons. Some
      // provider route definitions use a local spelling (e.g. Gent/Antwerpen),
      // while the live station catalogue returns the English station name.
      name: `${stations[0] || route.origin} → ${stations.at(-1) || route.destination}`,
      color: result?.lineColor || routeColors[country],
      stations: stations.map((name) => ({ name })),
    } satisfies TransitLine;
  }).filter((line) => line.stations.length >= 2);
}

function fallbackLines(country: Country): TransitLine[] {
  return (fallbackRoutes[country] || []).map((route, index) => ({
    id: lineId(country, route.origin, route.destination, index),
    name: `${route.origin} → ${route.destination}`,
    color: routeColors[country],
    stations: [{ name: route.origin }, { name: route.destination }],
  }));
}

/** Build the route cards used by the station picker for provider markets. */
export function getProviderRouteLines(
  country: Country,
  routes: readonly ScrapedRouteData[],
  date?: string,
): TransitLine[] {
  if (!routeFirstStationCountries.includes(country)) return [];
  const lines = snapshotLines(country, routes, date);
  return lines.length > 0 ? lines : fallbackLines(country);
}
