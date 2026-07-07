/**
 * Station + line catalog for each country. Shared by the API
 * (/api/transit/stations, /api/transit/lines — now a fallback) and by
 * scripts/generate-station-catalog.ts, which pre-renders these into static
 * public/catalog/<country>.json so the station menu never depends on the
 * serverless function being healthy.
 *
 * 8 countries are deterministic (bundled data); UK/US fetch TfL/MBTA live.
 */
import { japanRailLines, japanStations, koreaStations } from "../data/stations";
import { seoulSubwayLines, seoulSubwayStationNames } from "../data/seoulSubway";
import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
} from "../data/metroLines";
import { hongKongMtrLineCatalog, mtrInterchanges, hongKongStations } from "../data/hongKongMtr";
import { getTflLines, getTflStations } from "./tfl";
import { getMbtaLines, getMbtaStations } from "./mbta";
import { newCountryStationLists } from "../data/scraped/stations";
import type { TransitLine } from "../types";

export const CATALOG_COUNTRIES = [
  "japan", "korea", "china", "singapore", "thailand",
  "hong_kong", "united_kingdom", "united_states", "germany", "france",
] as const;

const staticLineSets: Record<string, TransitLine[]> = {
  singapore: singaporeMrtLines,
  thailand: thailandTransitLines,
  china: chinaRailLines,
  germany: germanyRailLines,
  france: franceRailLines,
};

function hongKongLines(): TransitLine[] {
  return hongKongMtrLineCatalog.map((line) => ({
    id: line.code,
    name: line.name,
    color: line.color,
    stations: line.stations.map((station) => {
      const others = (mtrInterchanges.get(station.name) || []).filter((code) => code !== line.code);
      const names = others
        .map((code) => hongKongMtrLineCatalog.find((entry) => entry.code === code)?.name)
        .filter((name): name is string => Boolean(name));
      return { name: station.name, interchanges: names.length > 0 ? names : undefined };
    }),
  }));
}

export async function getLinesForCountry(country: string): Promise<TransitLine[]> {
  if (country === "japan") return japanRailLines;
  if (country === "korea") return seoulSubwayLines;
  if (country === "hong_kong") return hongKongLines();
  if (staticLineSets[country]) return staticLineSets[country];
  if (country === "united_kingdom") {
    try { return await getTflLines(); } catch { return []; }
  }
  if (country === "united_states") {
    try { return await getMbtaLines(); } catch { return []; }
  }
  return [];
}

export async function getStationsForCountry(
  country: string,
  q?: string,
): Promise<{ stations: string[]; source?: string }> {
  let stations: string[] = [];
  let source: string | undefined;

  if (country === "japan") {
    stations = japanStations;
  } else if (country === "korea") {
    stations = Array.from(new Set([...koreaStations, ...seoulSubwayStationNames])).sort((a, b) => a.localeCompare(b));
  } else if (country === "hong_kong") {
    stations = hongKongStations;
  } else if (country === "united_kingdom") {
    stations = await getTflStations();
    source = "https://api.tfl.gov.uk";
  } else if (country === "united_states") {
    stations = await getMbtaStations();
    source = "https://api-v3.mbta.com";
  } else if (newCountryStationLists[country]) {
    const fromLines = (staticLineSets[country] || []).flatMap((line) => line.stations.map((s) => s.name));
    stations = Array.from(new Set([...newCountryStationLists[country], ...fromLines])).sort((a, b) => a.localeCompare(b));
  } else {
    throw new Error("Invalid country");
  }

  if (typeof q === "string" && q.trim().length > 0) {
    const queryVal = q.trim().toLowerCase();
    stations = stations.filter((station) => station.toLowerCase().includes(queryVal));
  }

  return { stations, source };
}

/** Combined catalog for one country — what a static public/catalog/<c>.json holds. */
export async function buildCatalog(
  country: string,
): Promise<{ country: string; stations: string[]; lines: TransitLine[]; source?: string }> {
  const [{ stations, source }, lines] = await Promise.all([
    getStationsForCountry(country),
    getLinesForCountry(country),
  ]);
  return { country, stations, lines, source };
}
