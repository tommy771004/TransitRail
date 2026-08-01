/**
 * Station + line catalog for each country. Shared by the API
 * (/api/transit/stations, /api/transit/lines — now a fallback) and by
 * scripts/generate-station-catalog.ts, which pre-renders these into static
 * public/catalog/<country>.json so the station menu never depends on the
 * serverless function being healthy.
 *
 * Static station menus come from {@link getStaticMenuStations} so the offline
 * audit and the live menu cannot drift. UK/US/Belgium still fetch providers.
 */
import { japanRailLines } from "../data/stations";
import { seoulSubwayLines } from "../data/seoulSubway";
import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
  switzerlandRailLines,
} from "../data/metroLines";
import { hongKongMtrLineCatalog, mtrInterchanges } from "../data/hongKongMtr";
import { getStaticMenuStations } from "../data/stationIdentity";
import {
  coverageModeFor,
  hasCoverage,
  usesStrictTimetableGate,
  type StationCoverage,
} from "../data/stationCoverage";
import {
  getScrapedCoverageNames,
  getScrapedReachableStations,
} from "../data/scraped";
import { stationSearchKey } from "../data/stationKey";
import { resolveStationAlias } from "../data/stationAliases";
import { countryOptions, searchDateRange } from "../data/countries";
import { getTflLines, getTflStations } from "./tfl";
import { getMbtaLines, getMbtaStations } from "./mbta";
import { getBelgiumStations } from "./belgium";
import { getMalaysiaStations, MALAYSIA_STATION_CATALOG_SOURCE } from "./malaysia";
import type { Country, TransitLine } from "../types";

export const CATALOG_COUNTRIES = countryOptions;

export const officialTimetableUrls: Partial<Record<Country, string>> = {
  japan: "https://www.jreast.co.jp/e/",
  korea: "https://english.seoulmetro.co.kr/",
  singapore: "https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html",
  thailand: "https://metro.bemplc.co.th/Fare-Calculation?lang=en",
  hong_kong: "https://www.mtr.com.hk/en/customer/main/index.html",
  united_kingdom: "https://tfl.gov.uk/plan-a-journey",
  united_states: "https://www.mbta.com/schedules",
  germany: "https://www.gtfs.de/",
  france: "https://www.sncf.com/en",
  china: "https://www.12306.cn/en/index.html",
  belgium: "https://www.belgiantrain.be/en",
  norway: "https://www.entur.no/",
  switzerland: "https://opentransportdata.swiss/en/",
  malaysia: MALAYSIA_STATION_CATALOG_SOURCE,
};

const staticLineSets: Record<string, TransitLine[]> = {
  singapore: singaporeMrtLines,
  thailand: thailandTransitLines,
  china: chinaRailLines,
  germany: germanyRailLines,
  france: franceRailLines,
  switzerland: switzerlandRailLines,
};

function isJapanMetroLine(line: TransitLine): boolean {
  return line.id.startsWith("toei-") || line.id.startsWith("tokyo-metro-");
}

function japanIntercityStationKeys(): Set<string> {
  return new Set(
    japanRailLines
      .filter((line) => !isJapanMetroLine(line))
      .flatMap((line) => line.stations.map((station) => stationSearchKey(station.name))),
  );
}

function shouldFilterCatalogByAuthenticity(country: string): boolean {
  // Japan is mixed: hide its unsupported metro directory above, but preserve
  // the existing Shinkansen catalog until long-distance data gets its own audit.
  return usesStrictTimetableGate(country as Country) && country !== "japan";
}

function hongKongLines(): TransitLine[] {
  return hongKongMtrLineCatalog.map((line) => ({
    id: line.code,
    name: line.name,
    color: line.color,
    stations: line.stations.map((station) => {
      const interchangeKey = stationSearchKey(resolveStationAlias("hong_kong", station.name));
      const others = (mtrInterchanges.get(interchangeKey) || []).filter((code) => code !== line.code);
      const names = others
        .map((code) => hongKongMtrLineCatalog.find((entry) => entry.code === code)?.name)
        .filter((name): name is string => Boolean(name));
      return { name: station.name, interchanges: names.length > 0 ? names : undefined };
    }),
  }));
}

function filterLinesByVerifiedCoverage(
  country: string,
  lines: TransitLine[],
  date?: string,
): TransitLine[] {
  if (!shouldFilterCatalogByAuthenticity(country)) return lines;
  const covered = new Set(
    getScrapedCoverageNames(country as Country, date)
      .map((station) => stationSearchKey(resolveStationAlias(country as Country, station))),
  );
  const filtered = lines
    .map((line) => ({
      ...line,
      stations: line.stations.filter((station) => covered.has(
        stationSearchKey(resolveStationAlias(country as Country, station.name)),
      )),
    }))
    .filter((line) => line.stations.length >= 2);
  return filtered;
}

export async function getLinesForCountry(country: string, date?: string): Promise<TransitLine[]> {
  let lines: TransitLine[];
  if (country === "japan") lines = japanRailLines.filter((line) => !isJapanMetroLine(line));
  else if (country === "korea") lines = seoulSubwayLines;
  else if (country === "hong_kong") lines = hongKongLines();
  else if (staticLineSets[country]) lines = staticLineSets[country];
  else if (country === "united_kingdom") {
    try { lines = await getTflLines(); } catch { lines = []; }
  } else if (country === "united_states") {
    try { lines = await getMbtaLines(); } catch { lines = []; }
  } else {
    lines = [];
  }

  if (shouldFilterCatalogByAuthenticity(country)) {
    return filterLinesByVerifiedCoverage(country, lines, date);
  }
  return lines;
}

/**
 * Which of `stations` search can actually answer for.
 *
 * Only `scraped` countries have a finite, enumerable set — the picker there
 * offers a whole line map while the timetables cover a handful of corridors,
 * so the menu alone over-promises. Live-provider menus stay unbounded.
 */
export function getStationCoverage(
  country: string,
  stations: readonly string[],
  date?: string,
  origin?: string,
): StationCoverage | undefined {
  if (!countryOptions.includes(country as Country)) return undefined;
  const mode = coverageModeFor(country as Country);
  if (mode !== "scraped" || !shouldFilterCatalogByAuthenticity(country)) {
    return { mode, dateRange: searchDateRange(country as Country) };
  }
  const resolvedCountry = country as Country;
  const names = getScrapedCoverageNames(resolvedCountry, date);
  const keys = new Set(names.map((name) => stationSearchKey(resolveStationAlias(resolvedCountry, name))));
  const coverage: StationCoverage = {
    mode,
    covered: stations.filter((station) => hasCoverage(keys, station, resolvedCountry)),
    date,
    dateRange: searchDateRange(resolvedCountry),
  };
  if (coverage.covered.length === 0) {
    coverage.message = date
      ? "No verified timetable data is available for this country on the selected date."
      : "No verified timetable data is currently available for this country.";
    coverage.sourceUrl = officialTimetableUrls[resolvedCountry];
  }
  if (origin && date) {
    coverage.destinations = getScrapedReachableStations(resolvedCountry, origin, date);
    if (coverage.destinations.length === 0) {
      coverage.message = "No verified destinations are reachable from this station on the selected date.";
      coverage.sourceUrl = officialTimetableUrls[resolvedCountry];
    }
  }
  return coverage;
}

export async function getStationsForCountry(
  country: string,
  q?: string,
  date?: string,
  origin?: string,
): Promise<{ stations: string[]; source?: string; coverage?: StationCoverage }> {
  let stations: string[] = [];
  let source: string | undefined;

  if (country === "malaysia") {
    stations = getMalaysiaStations();
    source = MALAYSIA_STATION_CATALOG_SOURCE;
  } else if (country === "united_kingdom") {
    stations = await getTflStations();
    source = "https://api.tfl.gov.uk";
  } else if (country === "united_states") {
    stations = await getMbtaStations();
    source = "https://api-v3.mbta.com";
  } else if (country === "belgium") {
    stations = await getBelgiumStations();
    source = "https://api.irail.be";
  } else {
    const staticMenu = getStaticMenuStations(country);
    if (!staticMenu) {
      throw new Error("Invalid country");
    }
    stations = staticMenu;
    if (country === "japan") {
      const intercityKeys = japanIntercityStationKeys();
      stations = stations.filter((station) => intercityKeys.has(stationSearchKey(station)));
    }
    if (country === "norway") {
      source = "Entur National Stop Register / Geocoder";
    }
  }

  // Coverage is computed against the whole menu, before `q` narrows it, so the
  // covered set stays a stable lookup table rather than shifting per keystroke.
  const coverage = getStationCoverage(country, stations, date, origin);

  if (coverage?.mode === "scraped" && shouldFilterCatalogByAuthenticity(country)) {
    if (origin && date) {
      const destinationKeys = new Set(
        (coverage.destinations || [])
          .map((station) => stationSearchKey(resolveStationAlias(country as Country, station))),
      );
      stations = stations.filter((station) => destinationKeys.has(
        stationSearchKey(resolveStationAlias(country as Country, station)),
      ));
    } else {
      stations = stations.filter((station) => hasCoverage(
        new Set((coverage.covered || []).map((covered) => stationSearchKey(covered))),
        station,
        country as Country,
      ));
    }
  }

  if (typeof q === "string" && q.trim().length > 0) {
    const queryVal = q.trim().toLowerCase();
    stations = stations.filter((station) => station.toLowerCase().includes(queryVal));
  }

  return { stations, source, coverage };
}

/** Combined catalog for one country — what a static public/catalog/<c>.json holds. */
export async function buildCatalog(country: string): Promise<{
  country: string;
  stations: string[];
  lines: TransitLine[];
  source?: string;
  coverage?: StationCoverage;
}> {
  const [{ stations, source, coverage }, lines] = await Promise.all([
    getStationsForCountry(country),
    getLinesForCountry(country),
  ]);
  return { country, stations, lines, source, coverage };
}
