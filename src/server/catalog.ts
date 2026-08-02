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
import { decideSearchability } from "../data/searchabilityPolicy";
import {
  coverageModeFor,
  hasCoverage,
  usesStrictCatalogGate,
  type StationCoverage,
} from "../data/stationCoverage";
import { authenticityOptionsFor, classifyTimetable, isVerifiableTimetable } from "../data/timetableAuthenticity";
import {
  findScrapedResults,
  getArtifactLineNames,
  getScrapedCoverageNames,
  getScrapedRoutes,
  getScrapedReachableStations,
  getScrapedSearchabilitySummary,
} from "../data/scraped";
import { getCountryCapability } from "../data/countryCapability";
import { stationSearchKey } from "../data/stationKey";
import { resolveStationAlias } from "../data/stationAliases";
import { addDateValueDays, countryOptions, searchDateRange, type SearchDateRange } from "../data/countries";
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

/**
 * Japan's metro is admitted line by line, as each one gets real data.
 *
 * Every Tokyo subway line used to be a fixed-headway generation, so the menu
 * dropped all of them wholesale. The four Toei lines come from the ODPT public
 * feed and classify as `scraped`, and a station users cannot pick is a station
 * the timetable cannot serve — so admit what a verified timetable can answer
 * for, and leave the rest hidden until their source arrives.
 */
function japanVerifiedMetroKeys(date?: string): Set<string> {
  return new Set(
    getScrapedCoverageNames("japan", date)
      .map((station) => stationSearchKey(resolveStationAlias("japan", station))),
  );
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

function offeredDateRange(country: Country): SearchDateRange {
  const range = searchDateRange(country);
  // `provider_then_scraped` is trimmed too: its guaranteed answer is the
  // committed data, and the provider on top is optional. Switzerland offered 14
  // days while its OJP adapter returned 501 for every one of them (no
  // SWISS_OJP_TOKEN configured), so days 8-14 fell through to a snapshot that
  // only covers 7 — the picker invited a date that answered "unsupported
  // route". A deployment that does configure the token answers further ahead
  // than this trim allows; raising the floor there means committing more days
  // of data, not widening the offer past what is guaranteed.
  const { search } = getCountryCapability(country);
  const boundedByCommittedData = coverageModeFor(country) === "scraped"
    || search.kind === "provider_then_scraped";
  if (!boundedByCommittedData) return range;

  // Walk back from the last policy day to the newest one that verifies. Uses
  // the same coverage call the menu does, so "has data" cannot mean one thing
  // here and another there.
  let end = range.end;
  while (end >= range.start && getScrapedCoverageNames(country, end).length === 0) {
    end = addDateValueDays(end, -1);
  }
  if (end < range.start) return { ...range, end: range.start, days: 1 };

  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86_400_000) + 1;
  return { ...range, end, days };
}

/** One journey the committed data can actually answer, and what serves it. */
interface AnswerablePair {
  origin: string;
  destination: string;
  /** Line names the serving rows claim, split on chained ` → ` segments. */
  services: string[];
}

/**
 * Every journey a market's committed routes can answer for one service day.
 *
 * Computed once per request. The obvious implementation — ask
 * `findScrapedResults` for each candidate pair — costs a full search per pair
 * (~330ms on the Korean artifacts), which made the line catalogue take tens of
 * seconds. The route rows already state their endpoints and service, so read
 * them directly.
 */
function answerablePairs(country: Country, date: string): AnswerablePair[] {
  const pairs: AnswerablePair[] = [];
  for (const route of getScrapedRoutes(country)) {
    // Ask the market's own policy, not a private bar. China runs entirely on
    // curated snapshots and permits them; Japan does not. Re-deciding that here
    // would put a second, disagreeing answer next to the one search uses.
    if (!decideSearchability({ country, serviceDay: date, source: route }).searchable) continue;
    const byPair = new Map<string, Set<string>>();
    for (const result of route.results) {
      if (result.date !== date) continue;
      const key = `${result.origin}\u0000${result.destination}`;
      const services = byPair.get(key) ?? new Set<string>();
      // TfL joins a multi-line journey with " + " and a chained result with
      // " → ". Both mean the journey really runs on each named line.
      for (const segment of (result.service ?? "").split(/→|\+/)) {
        const name = segment.trim();
        if (name) services.add(name);
      }
      byPair.set(key, services);
    }
    for (const [key, services] of byPair) {
      const [origin, destination] = key.split("\u0000");
      pairs.push({ origin, destination, services: [...services] });
    }
  }
  return pairs;
}

/**
 * Whether a line is backed by timetable data of its own.
 *
 * Two signals, because neither alone is right:
 *
 * - The line is named by verified rows — by an artifact run's `line`, or by a
 *   route's `service`. Sufficient on its own, and the only signal that works
 *   for a live-provider market: the Elizabeth line has real data, but its
 *   journeys end on other lines, so no pair test would ever admit it.
 * - A verified pair with both ends on the line, where the rows serving it do
 *   not name a *different* line. Needed for intercity, whose `service` is a
 *   train name ("Nozomi 101") matching no line — and the "different line" guard
 *   is what stops Tokyo Metro Ginza riding in on Toei Asakusa's Asakusa ↔
 *   Nihombashi journey.
 */
function lineHasOwnTimetable(
  country: Country,
  line: TransitLine,
  pairs: readonly AnswerablePair[],
  otherLineNames: ReadonlySet<string>,
  verifiedServiceNames: ReadonlySet<string>,
): boolean {
  if (verifiedServiceNames.has(line.name)) return true;

  const onLine = new Set(line.stations.map((station) =>
    stationSearchKey(resolveStationAlias(country, station.name))));
  return pairs.some((pair) =>
    onLine.has(stationSearchKey(resolveStationAlias(country, pair.origin)))
    && onLine.has(stationSearchKey(resolveStationAlias(country, pair.destination)))
    && !pair.services.some((service) => otherLineNames.has(service)));
}

/**
 * Drop lines the committed data cannot answer for.
 *
 * A line in the picker that no timetable can serve is the same defect as an
 * unreachable station: it invites a selection that must fail. Applied to every
 * market, not only the strict-gate ones — an intercity line whose rows are all
 * generated is no more answerable than a metro one.
 */
function filterLinesToAnswerable(country: Country, lines: TransitLine[], date?: string): TransitLine[] {
  // With no service day there is nothing to evaluate against; leave the
  // catalogue whole rather than guessing which day the caller meant.
  if (!date) return lines;

  // Artifact-backed lines name themselves in their runs; route-backed ones name
  // themselves in `service`. Both are O(rows) reads.
  const verifiedServiceNames = getArtifactLineNames(country, date);
  const pairs = answerablePairs(country, date);
  for (const pair of pairs) for (const service of pair.services) verifiedServiceNames.add(service);

  const allNames = new Set(lines.map((line) => line.name));
  return lines.filter((line) => {
    const others = new Set([...allNames].filter((name) => name !== line.name));
    return lineHasOwnTimetable(country, line, pairs, others, verifiedServiceNames);
  });
}

function filterLinesByVerifiedCoverage(
  country: string,
  lines: TransitLine[],
  date?: string,
): TransitLine[] {
  if (!usesStrictCatalogGate(country as Country)) return lines;
  const resolvedCountry = country as Country;
  const covered = new Set(
    getScrapedCoverageNames(resolvedCountry, date)
      .map((station) => stationSearchKey(resolveStationAlias(resolvedCountry, station))),
  );
  const summary = getScrapedSearchabilitySummary(resolvedCountry, date);
  if (!summary.searchable) return [];

  const filtered = lines
    .map((line) => ({
      ...line,
      stations: line.stations.filter((station) => covered.has(
        stationSearchKey(resolveStationAlias(resolvedCountry, station.name)),
      )),
    }))
    // Only the station trim lives here. Whether the line is answerable at all
    // is decided once, in filterLinesToAnswerable — running a second pair test
    // here dropped the Elizabeth line, whose journeys legitimately end on
    // another line, before that rule could admit it by name.
    .filter((line) => line.stations.length >= 2);
  return filtered;
}

export async function getLinesForCountry(country: string, date?: string): Promise<TransitLine[]> {
  let lines: TransitLine[];
  if (country === "japan") lines = japanRailLines;
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

  if (usesStrictCatalogGate(country as Country)) {
    lines = filterLinesByVerifiedCoverage(country, lines, date);
  }
  return filterLinesToAnswerable(country as Country, lines, date);
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
  if (mode !== "scraped" || !usesStrictCatalogGate(country as Country)) {
    return { mode, dateRange: offeredDateRange(country as Country) };
  }
  const resolvedCountry = country as Country;
  const names = getScrapedCoverageNames(resolvedCountry, date);
  const keys = new Set(names.map((name) => stationSearchKey(resolveStationAlias(resolvedCountry, name))));
  const coverage: StationCoverage = {
    mode,
    covered: stations.filter((station) => hasCoverage(keys, station, resolvedCountry)),
    date,
    dateRange: offeredDateRange(resolvedCountry),
  };
  if ((coverage.covered ?? []).length === 0) {
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
      const verifiedKeys = japanVerifiedMetroKeys(date);
      stations = stations.filter((station) => {
        const key = stationSearchKey(station);
        return intercityKeys.has(key) || verifiedKeys.has(key);
      });
    }
    if (country === "korea") {
      // Korea files two separate networks: Seoul Metro and Incheon Transit.
      // The static menu is built from the Seoul station list plus Korail, so a
      // second operator's stations are searchable but unpickable until they are
      // unioned in here. Adding whatever the committed artifacts can answer for
      // keeps the menu and the data one set, and a third network needs no edit.
      const menuKeys = new Set(stations.map((station) => stationSearchKey(station)));
      for (const station of getScrapedCoverageNames("korea", date)) {
        if (!menuKeys.has(stationSearchKey(station))) {
          menuKeys.add(stationSearchKey(station));
          stations = [...stations, station];
        }
      }
      stations = [...stations].sort((left, right) => left.localeCompare(right));
    }
    if (country === "norway") {
      source = "Entur National Stop Register / Geocoder";
    }
  }

  // Coverage is computed against the whole menu, before `q` narrows it, so the
  // covered set stays a stable lookup table rather than shifting per keystroke.
  let coverage = getStationCoverage(country, stations, date, origin);

  if (coverage?.mode === "scraped" && usesStrictCatalogGate(country as Country)) {
    const summary = getScrapedSearchabilitySummary(country as Country, date);
    coverage = {
      ...coverage,
      provenance: summary.provenance,
      truthMode: summary.truthMode,
      reason: summary.reason,
    };
  }

  if (coverage?.mode === "scraped" && usesStrictCatalogGate(country as Country)) {
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
