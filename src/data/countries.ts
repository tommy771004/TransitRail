import type { Country, ServiceDayCoverage } from "../types";
import { norwayFeaturedStations } from "./norway";

export const countryFlags: Record<string, string> = {
  japan: "🇯🇵",
  korea: "🇰🇷",
  singapore: "🇸🇬",
  malaysia: "🇲🇾",
  thailand: "🇹🇭",
  hong_kong: "🇭🇰",
  united_kingdom: "🇬🇧",
  united_states: "🇺🇸",
  germany: "🇩🇪",
  france: "🇫🇷",
  switzerland: "🇨🇭",
  belgium: "🇧🇪",
  norway: "🇳🇴",
  china: "🇨🇳",
  taiwan: "🇹🇼",
};

/**
 * How many service days a snapshot-backed market can be searched — what the
 * picker offers.
 *
 * A market whose provider answers arbitrary dates live is not bound by this —
 * its range is a provider capability, not a data inventory.
 */
export const SEARCH_WINDOW_DAYS = 7;

/**
 * How often the full scrape runs. Markets whose source only answers for today
 * still run daily; everything else is collected on this cadence.
 */
export const FULL_SCRAPE_INTERVAL_DAYS = 3;

/**
 * How many service days one full scrape commits.
 *
 * The picker's range and the scrape window are the same fact seen from two
 * ends, and must never be edited apart: written separately once, the picker
 * offered 14 days against 7 days of data and the second week returned "no
 * service" for dates the user had just been invited to choose.
 *
 * They are no longer *equal*, because equality only held while the scrape ran
 * every night. On a {@link FULL_SCRAPE_INTERVAL_DAYS}-day cadence a run on day
 * X must still answer the window a passenger sees on day X+2 — which reaches
 * X+2+SEARCH_WINDOW_DAYS-1. Hence the derivation below: the search window plus
 * the days that pass before the next run refreshes it. Change the cadence and
 * this follows automatically; that is the point.
 */
export const SCRAPE_WINDOW_DAYS = SEARCH_WINDOW_DAYS + FULL_SCRAPE_INTERVAL_DAYS - 1;

/** Every configured market, including temporarily hidden ones used by jobs. */
export const configuredCountryOptions: Country[] = [
  "japan",
  "korea",
  "china",
  "singapore",
  "malaysia",
  "thailand",
  "hong_kong",
  "united_kingdom",
  "united_states",
  "germany",
  "france",
  "belgium",
  "norway",
  "switzerland",
];

/**
 * Markets configured but deliberately withheld from the public picker — a
 * market mid-migration, or one whose data is not fit to show yet.
 *
 * A market belongs here when it can answer nothing, not merely when it answers
 * less than another market does. It exists so that hiding a market is one edit
 * here rather than a hand-maintained second list: {@link countryOptions} is
 * derived, so the "configured" and "public" sets can never silently drift apart.
 */
export const hiddenCountryOptions = new Set<Country>([
  // No official China source is registered, so `scrape: "none"` fetches nothing
  // and there are no route files at all. The market was still in the public
  // picker with a seven-day range: every station menu was empty and every
  // search 404'd, which is a dead end dressed as a destination.
  //
  // Hidden rather than deleted — the config, topology and currency stay put, so
  // registering a source is all it takes to bring it back.
  "china",
  // These markets remain configured so their official sources can be monitored,
  // but neither currently has a published, searchable departure timetable.
  "singapore",
  "thailand",
]);

/** Markets exposed by the public picker and transit API. */
export const countryOptions: Country[] = configuredCountryOptions.filter(
  (country) => !hiddenCountryOptions.has(country),
);

/** Live timetable provider id used by /api/transit/search. */
export type ProviderId = "tfl" | "mbta" | "belgium" | "norway" | "swiss" | "hong_kong_mtr";

/** How search obtains timetable results. */
export type SearchKind =
  | { kind: "scraped" }
  | { kind: "provider"; provider: ProviderId }
  | { kind: "provider_then_scraped"; provider: ProviderId }
  | { kind: "catalog_only" };

/**
 * How the nightly job fills this country's data.
 * - official_source: one or more registered official sources are scraped; a
 *   route that fails keeps its previously committed file
 * - catalog_sync: station catalog only, no timetable
 * - none: no official source is wired up, so nothing is fetched and the
 *   country has no timetable data (China)
 *
 * The retired `generated`, `snapshot` and `provider_backed` strategies all
 * described ways of filling a gap with something other than official data.
 */
export type ScrapeStrategy = "official_source" | "catalog_sync" | "none";

export type ResultViewFamily = "japan" | "korea" | "metro" | "live_rail" | "catalog";
export type LiveRailMarket = "london" | "boston" | "switzerland" | "belgium" | "norway";

/** Static service-day coverage declaration. `stale` is a runtime fallback
 * state; configuration must declare the source's normal capability explicitly. */
export type ServiceDayCapability = {
  coverage: Exclude<ServiceDayCoverage, "stale">;
  source: string;
  sourceUrl?: string;
  scope: string;
};

/** Declared product boundary used by both browse UI and coverage audit. */
export type MarketTopology = {
  regions: readonly {
    id: string;
    name: string;
    /** Lines whose stable ids begin with one of these prefixes belong here. */
    lineIdPrefixes?: readonly string[];
    /** Catch-all region when no prefix claims a line. Required for multi-region markets. */
    default?: boolean;
    /** Product-directory denominator, independent of current timetable coverage. */
    declaredLines: number;
    /** Product-directory denominator, independent of current timetable coverage. */
    declaredStations: number;
  }[];
  /** Operators/geographies intentionally outside the current product boundary. */
  expansionGaps?: readonly { operator: string; reason: string }[];
};

/**
 * Single country table: product chrome + search/scrape/result policy.
 * Prefer reading policy via {@link getCountryCapability} from countryCapability.ts.
 */
export type CountryConfigEntry = {
  labelKey: string;
  provider: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  featuredStations: string[];
  promptName: string;
  connected: boolean;
  /** Provider only serves live "today" data; the date field is locked. */
  liveOnly: boolean;
  /** Number of consecutive local service dates the picker may offer. */
  dateRangeDays: number;
  /** Reject dates outside the published range at the search edge. */
  dateRangeEnforced?: boolean;
  timeZone: string;
  search: SearchKind;
  scrape: ScrapeStrategy;
  /**
   * Whether the station and line menus are trimmed to what this market's
   * committed timetables can answer.
   *
   * The sibling `timetable` and `routePages` gates are gone: rejecting
   * unverified rows from search, and refusing to publish them as SEO pages, are
   * now unconditional rather than a per-market migration step.
   */
  /**
   * Whether this market publishes a complete official station/line directory
   * that is deliberately broader than its verified timetable coverage. The
   * menu then keeps the whole directory and the per-station coverage badges
   * say what search can answer; trimming it would hide the operator's own map
   * behind whatever the timetable currently reaches.
   */
  authenticityGates: { catalog: boolean; officialDirectory?: boolean };
  marketTopology: MarketTopology;
  resultView: ResultViewFamily;
  liveRailMarket?: LiveRailMarket;
  serviceDay: ServiceDayCapability;
};

export const countryConfig: Record<Country, CountryConfigEntry> = {
  japan: {
    labelKey: "search.japan",
    provider: "Scheduled JR + ODPT data",
    originPlaceholder: "Tokyo",
    destinationPlaceholder: "Shin-Osaka",
    featuredStations: ["Tokyo", "Shinagawa", "Kyoto", "Shin-Osaka", "Nagoya"],
    promptName: "日本",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Asia/Tokyo",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [
      { id: "tokyo-urban", name: "Tokyo urban rail", lineIdPrefixes: ["toei-", "tokyo-metro-"], declaredLines: 6, declaredStations: 132 },
      { id: "japan-intercity", name: "Japan intercity rail", default: true, declaredLines: 10, declaredStations: 36 },
    ] },
    resultView: "japan",
    serviceDay: { coverage: "unavailable", source: "No qualifying official full-day source", scope: "No service-day advisory" },
  },
  korea: {
    labelKey: "search.korea",
    provider: "Scheduled Korail + Seoul Metro data",
    originPlaceholder: "Seoul (SNC)",
    destinationPlaceholder: "Busan (BSN)",
    featuredStations: ["Seoul (SNC)", "Yongsan", "Daejeon", "Dongdaegu", "Busan (BSN)"],
    promptName: "韓國",
    connected: true,
    liveOnly: false,
    dateRangeDays: 7,
    dateRangeEnforced: true,
    timeZone: "Asia/Seoul",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: true },
    marketTopology: { regions: [{ id: "seoul-capital", name: "Seoul Capital Area", declaredLines: 12, declaredStations: 332 }] },
    resultView: "korea",
    serviceDay: { coverage: "unavailable", source: "No qualifying official full-day source", scope: "No service-day advisory" },
  },
  singapore: {
    labelKey: "search.singapore",
    provider: "LTA DataMall GTFS",
    originPlaceholder: "Jurong East",
    destinationPlaceholder: "Raffles Place",
    featuredStations: ["Jurong East", "Raffles Place", "City Hall", "Orchard", "Woodlands"],
    promptName: "新加坡",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Asia/Singapore",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: true, officialDirectory: true },
    marketTopology: { regions: [{ id: "singapore", name: "Singapore", declaredLines: 9, declaredStations: 184 }] },
    resultView: "metro",
    serviceDay: {
      coverage: "partial",
      source: "SMRT official station information API",
      sourceUrl: "https://journey.smrt.com.sg/",
      scope: "Direction-specific first/last trains for supported SMRT routes",
    },
  },
  malaysia: {
    labelKey: "search.malaysia",
    provider: "data.gov.my / KTMB GTFS",
    originPlaceholder: "Rawang",
    destinationPlaceholder: "Kuala Lumpur",
    featuredStations: ["Rawang", "Batu Caves", "Kuala Lumpur", "Klang", "Subang Jaya"],
    promptName: "馬來西亞",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Asia/Kuala_Lumpur",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: true },
    marketTopology: { regions: [{ id: "malaysia-intercity", name: "Malaysia rail", declaredLines: 3, declaredStations: 5 }] },
    resultView: "metro",
    serviceDay: { coverage: "unavailable", source: "KTMB GTFS has no separate service-day advisory", scope: "No service-day advisory" },
  },
  thailand: {
    labelKey: "search.thailand",
    provider: "Scraped (BTS/MRT)",
    originPlaceholder: "Siam",
    destinationPlaceholder: "Sukhumvit",
    featuredStations: ["Siam", "Chit Lom", "Asok", "Mo Chit", "Sukhumvit"],
    promptName: "泰國",
    connected: true,
    // BEM's first/last table is stamped with the one service date it describes,
    // and `advisoryFromHtml` refuses any other date rather than reusing those
    // times — so Bangkok can answer today and nothing else. The picker offered
    // seven days against it, and the six beyond today had neither a departure
    // (the frequency source writes none by design) nor an advisory: the user was
    // invited to choose dates the market could say nothing at all about.
    //
    // The honest range is what the source publishes. Reusing today's first/last
    // across the week would be the dateless canonical day this codebase removed.
    liveOnly: true,
    dateRangeDays: 1,
    dateRangeEnforced: true,
    timeZone: "Asia/Bangkok",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: true, officialDirectory: true },
    marketTopology: { regions: [{ id: "bangkok", name: "Bangkok", declaredLines: 5, declaredStations: 119 }] },
    resultView: "metro",
    serviceDay: {
      coverage: "partial",
      source: "BEM MRT official HTML",
      sourceUrl: "https://metro.bemplc.co.th/Fare-Calculation?lang=en",
      scope: "Blue Line Sukhumvit → Hua Lamphong station-direction first/last values",
    },
  },
  hong_kong: {
    labelKey: "search.hong_kong",
    provider: "Official MTR Next Train API",
    originPlaceholder: "Central",
    destinationPlaceholder: "Tsuen Wan",
    featuredStations: ["Central", "Admiralty", "Tsim Sha Tsui", "Mong Kok", "Causeway Bay"],
    promptName: "香港",
    connected: true,
    liveOnly: true,
    dateRangeDays: 1,
    dateRangeEnforced: true,
    timeZone: "Asia/Hong_Kong",
    // The next-train feed describes only the moment it is fetched. Search it
    // at request time; a nightly snapshot cannot truthfully answer later in
    // the same day.
    search: { kind: "provider", provider: "hong_kong_mtr" },
    scrape: "official_source",
    authenticityGates: { catalog: true },
    marketTopology: { regions: [{ id: "hong-kong", name: "Hong Kong", declaredLines: 6, declaredStations: 23 }] },
    resultView: "metro",
    serviceDay: { coverage: "unavailable", source: "MTR next-train source is not a full service-day declaration", scope: "No service-day advisory" },
  },
  united_kingdom: {
    labelKey: "search.united_kingdom",
    provider: "Official TfL Journey API",
    originPlaceholder: "King's Cross St. Pancras",
    destinationPlaceholder: "Oxford Circus",
    featuredStations: [
      "King's Cross St. Pancras Underground Station",
      "Oxford Circus Underground Station",
      "Victoria Underground Station",
      "Waterloo Underground Station",
      "London Bridge Underground Station",
    ],
    promptName: "英國倫敦",
    connected: true,
    // The TfL journey planner answers future dates from the published schedule,
    // so London is not a today-only market: each date returns its own real
    // journeys. Only the daily scrape used to make it look otherwise, by asking
    // for "departures from now" once per date.
    liveOnly: false,
    dateRangeDays: 7,
    dateRangeEnforced: true,
    timeZone: "Europe/London",
    search: { kind: "provider", provider: "tfl" },
    scrape: "official_source",
    authenticityGates: { catalog: true },
    marketTopology: {
      regions: [{ id: "london", name: "London (TfL)", declaredLines: 11, declaredStations: 961 }],
      expansionGaps: [{ operator: "National Rail", reason: "National and intercity services are outside the TfL product market." }],
    },
    resultView: "live_rail",
    liveRailMarket: "london",
    serviceDay: { coverage: "supported", source: "TfL Journey API", sourceUrl: "https://api.tfl.gov.uk", scope: "Complete route-aware first/last journeys" },
  },
  united_states: {
    labelKey: "search.united_states",
    provider: "Official MBTA Realtime",
    originPlaceholder: "South Station",
    destinationPlaceholder: "Back Bay",
    featuredStations: [
      "South Station",
      "Back Bay",
      "North Station",
      "Park Street",
      "Harvard",
    ],
    promptName: "美國波士頓",
    connected: true,
    // MBTA predictions are restricted to the current local service day.
    liveOnly: false,
    dateRangeDays: 7,
    dateRangeEnforced: true,
    timeZone: "America/New_York",
    search: { kind: "provider", provider: "mbta" },
    scrape: "official_source",
    authenticityGates: { catalog: true },
    marketTopology: {
      regions: [{ id: "boston", name: "Boston (MBTA)", declaredLines: 6, declaredStations: 263 }],
      expansionGaps: [{ operator: "US national and non-Boston transit", reason: "Only the MBTA Boston product market is currently integrated." }],
    },
    resultView: "live_rail",
    liveRailMarket: "boston",
    serviceDay: { coverage: "supported", source: "MBTA public API", sourceUrl: "https://api-v3.mbta.com", scope: "Scheduled route first/last journeys for the current service date" },
  },
  germany: {
    labelKey: "search.germany",
    provider: "gtfs.de / DELFI",
    originPlaceholder: "Berlin Hbf",
    destinationPlaceholder: "Munich Hbf",
    featuredStations: ["Berlin Hbf", "Hamburg Hbf", "Munich Hbf", "Frankfurt Hbf", "Cologne Hbf"],
    promptName: "德國",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Europe/Berlin",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "germany-intercity", name: "Germany intercity rail", declaredLines: 6, declaredStations: 17 }] },
    resultView: "japan",
    serviceDay: { coverage: "unavailable", source: "gtfs.de timetable is not yet published as a service-day advisory artifact", scope: "No service-day advisory" },
  },
  france: {
    labelKey: "search.france",
    provider: "Scraped (SNCF)",
    originPlaceholder: "Paris Gare de Lyon",
    destinationPlaceholder: "Lyon Part-Dieu",
    featuredStations: ["Paris Gare de Lyon", "Lyon Part-Dieu", "Marseille St-Charles", "Lille Europe", "Strasbourg"],
    promptName: "法國",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Europe/Paris",
    search: { kind: "scraped" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "france-intercity", name: "France intercity rail", declaredLines: 4, declaredStations: 18 }] },
    resultView: "japan",
    serviceDay: {
      coverage: "supported",
      source: "SNCF Open Data GTFS",
      sourceUrl: "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip",
      scope: "Complete GTFS route journeys for published service dates",
    },
  },
  belgium: {
    labelKey: "search.belgium",
    provider: "iRail / SNCB-NMBS",
    originPlaceholder: "Brussels-Central",
    destinationPlaceholder: "Antwerpen-Centraal",
    featuredStations: ["Brussels-Central", "Brussels-South/Brussels-Midi", "Brussels-North", "Antwerpen-Centraal", "Gent-Sint-Pieters"],
    promptName: "比利時",
    connected: true,
    liveOnly: false,
    dateRangeDays: 14,
    timeZone: "Europe/Brussels",
    search: { kind: "provider", provider: "belgium" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "belgium-intercity", name: "Belgium intercity rail", declaredLines: 5, declaredStations: 714 }] },
    resultView: "live_rail",
    liveRailMarket: "belgium",
    serviceDay: { coverage: "unavailable", source: "iRail journey API has no qualifying full-day declaration", scope: "No service-day advisory" },
  },
  norway: {
    labelKey: "search.norway",
    provider: "Entur Journey Planner",
    originPlaceholder: "Oslo S",
    destinationPlaceholder: "Bergen stasjon",
    featuredStations: norwayFeaturedStations.slice(0, 5),
    promptName: "挪威",
    connected: true,
    liveOnly: false,
    dateRangeDays: 14,
    timeZone: "Europe/Oslo",
    search: { kind: "provider", provider: "norway" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "norway-intercity", name: "Norway intercity rail", declaredLines: 5, declaredStations: 12 }] },
    resultView: "live_rail",
    liveRailMarket: "norway",
    serviceDay: { coverage: "unavailable", source: "Entur journey API has no qualifying full-day declaration", scope: "No service-day advisory" },
  },
  switzerland: {
    labelKey: "search.switzerland",
    provider: "OpenTransportData Swiss (OJP 2.0)",
    originPlaceholder: "Zürich HB",
    destinationPlaceholder: "Genève",
    featuredStations: ["Zürich HB", "Bern", "Basel SBB", "Lausanne", "Genève"],
    promptName: "瑞士",
    connected: true,
    liveOnly: false,
    // Belgium and Norway are pure `provider` markets: if the journey API cannot
    // answer, the search fails as a provider error and says so. Switzerland is
    // `provider_then_scraped` — it is built to fall back to committed GTFS, and
    // that fallback only ever holds the scraped window. Offering fourteen days
    // meant the second week was backed by nothing but the live OJP token being
    // present and accepted; without it those dates fell through to a fallback
    // that had no rows for them and answered "no service" for a date the picker
    // had just invited the user to choose.
    //
    // Bind the range to the data that is always there. A working OJP token
    // still answers these days, and answers them better.
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Europe/Zurich",
    search: { kind: "provider_then_scraped", provider: "swiss" },
    scrape: "official_source",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "switzerland-intercity", name: "Switzerland intercity rail", declaredLines: 5, declaredStations: 23 }] },
    resultView: "live_rail",
    liveRailMarket: "switzerland",
    serviceDay: { coverage: "unavailable", source: "OJP journey API has no qualifying full-day declaration", scope: "No service-day advisory" },
  },
  china: {
    labelKey: "search.china",
    provider: "No registered official source",
    originPlaceholder: "Beijing South",
    destinationPlaceholder: "Shanghai Hongqiao",
    featuredStations: ["Beijing South", "Shanghai Hongqiao", "Guangzhou South", "Shenzhen North", "Chengdu East"],
    promptName: "中國",
    connected: true,
    liveOnly: false,
    dateRangeDays: SEARCH_WINDOW_DAYS,
    timeZone: "Asia/Shanghai",
    search: { kind: "scraped" },
    // No official China source is wired up. The four high-speed route files
    // that used to sit here were curated snapshots served under a 12306 label;
    // they are gone, and nothing replaces them until a real source exists.
    scrape: "none",
    authenticityGates: { catalog: false },
    marketTopology: { regions: [{ id: "china-intercity", name: "China intercity rail", declaredLines: 6, declaredStations: 17 }] },
    resultView: "japan",
    serviceDay: { coverage: "unavailable", source: "No registered official source", scope: "No service-day advisory" },
  },
};

export const countryCurrency: Record<Country, string> = {
  japan: "JPY",
  korea: "KRW",
  hong_kong: "HKD",
  united_kingdom: "GBP",
  united_states: "USD",
  singapore: "SGD",
  malaysia: "MYR",
  thailand: "THB",
  germany: "EUR",
  france: "EUR",
  switzerland: "CHF",
  china: "CNY",
  belgium: "EUR",
  norway: "NOK",
};

export const allCurrencies = [
  "TWD", "USD", "EUR", "GBP", "JPY", "KRW", "HKD",
  "CHF", "SGD", "MYR", "THB", "CNY",
  "AUD", "CAD", "NZD", "PHP", "IDR", "VND",
  "SEK", "NOK", "DKK", "PLN", "TRY", "ZAR",
  "BRL", "MXN", "RUB", "INR", "SAR", "AED",
  "ILS", "CZK", "HUF", "RON",
] as const;

export function providerDateValue(country: Country, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: countryConfig[country].timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Shift a market-local `YYYY-MM-DD` value by whole days. */
export function addDateValueDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

/** Consecutive calendar dates in the transit market's local timezone. */
export function providerDateValues(country: Country, count: number, now = new Date()) {
  const first = providerDateValue(country, now);
  return Array.from({ length: Math.max(0, count) }, (_, index) => addDateValueDays(first, index));
}

export interface SearchDateRange {
  start: string;
  end: string;
  days: number;
  liveOnly: boolean;
}

/** Public date contract shared by the picker, station API, and search edge. */
export function searchDateRange(country: Country, now = new Date()): SearchDateRange {
  const dates = providerDateValues(country, countryConfig[country].dateRangeDays, now);
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    days: dates.length,
    liveOnly: countryConfig[country].liveOnly,
  };
}

export function isSearchDateAllowed(country: Country, date: string, now = new Date()): boolean {
  const range = searchDateRange(country, now);
  return date >= range.start && date <= range.end;
}

/** Current market-local clock, optionally shifted earlier for departure search. */
export function providerDateTimeValue(country: Country, now = new Date(), offsetMinutes = -60) {
  const adjusted = new Date(now.getTime() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: countryConfig[country].timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(adjusted);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: providerDateValue(country, adjusted),
    time: `${values.hour}:${values.minute}`,
  };
}

export const countryThemes: Record<Country, {
  primaryBgLight: string;
  primaryBgDark: string;
  buttonBg: string;
  buttonShadow: string;
  textActive: string;
  borderActive: string;
  badgeBg: string;
  indicatorBg: string;
  dateSelected: string;
  dateLabelSelected: string;
}> = {
  japan: {
    primaryBgLight: "from-rose-500/5",
    primaryBgDark: "dark:from-rose-950/20",
    buttonBg: "bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(225,29,72,0.3)] dark:shadow-[0_4px_14px_rgba(225,29,72,0.15)]",
    textActive: "text-rose-600 dark:text-rose-400",
    borderActive: "border-rose-500",
    badgeBg: "border-rose-500 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-400",
    indicatorBg: "bg-rose-500",
    dateSelected: "bg-rose-50 dark:bg-rose-950/30 border-rose-500 dark:border-rose-500/50 text-rose-600 dark:text-rose-400 shadow-sm",
    dateLabelSelected: "text-rose-500/80 dark:text-rose-400/80",
  },
  korea: {
    primaryBgLight: "from-indigo-500/5",
    primaryBgDark: "dark:from-indigo-950/20",
    buttonBg: "bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(79,70,229,0.3)] dark:shadow-[0_4px_14px_rgba(79,70,229,0.15)]",
    textActive: "text-indigo-600 dark:text-indigo-400",
    borderActive: "border-indigo-500",
    badgeBg: "border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-400",
    indicatorBg: "bg-indigo-500",
    dateSelected: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-400 shadow-sm",
    dateLabelSelected: "text-indigo-500/80 dark:text-indigo-400/80",
  },
  singapore: {
    primaryBgLight: "from-fuchsia-500/5",
    primaryBgDark: "dark:from-fuchsia-950/20",
    buttonBg: "bg-fuchsia-600 hover:bg-fuchsia-500 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(192,38,211,0.3)] dark:shadow-[0_4px_14px_rgba(192,38,211,0.15)]",
    textActive: "text-fuchsia-600 dark:text-fuchsia-400",
    borderActive: "border-fuchsia-500",
    badgeBg: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/30 dark:text-fuchsia-400",
    indicatorBg: "bg-fuchsia-500",
    dateSelected: "bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-500 dark:border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm",
    dateLabelSelected: "text-fuchsia-500/80 dark:text-fuchsia-400/80",
  },
  malaysia: {
    primaryBgLight: "from-emerald-500/5",
    primaryBgDark: "dark:from-emerald-950/20",
    buttonBg: "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(5,150,105,0.3)] dark:shadow-[0_4px_14px_rgba(5,150,105,0.15)]",
    textActive: "text-emerald-600 dark:text-emerald-400",
    borderActive: "border-emerald-500",
    badgeBg: "border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400",
    indicatorBg: "bg-emerald-500",
    dateSelected: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-sm",
    dateLabelSelected: "text-emerald-500/80 dark:text-emerald-400/80",
  },
  thailand: {
    primaryBgLight: "from-amber-500/5",
    primaryBgDark: "dark:from-amber-950/20",
    buttonBg: "bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(217,119,6,0.3)] dark:shadow-[0_4px_14px_rgba(217,119,6,0.15)]",
    textActive: "text-amber-600 dark:text-amber-400",
    borderActive: "border-amber-500",
    badgeBg: "border-amber-500 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400",
    indicatorBg: "bg-amber-500",
    dateSelected: "bg-amber-50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-sm",
    dateLabelSelected: "text-amber-500/80 dark:text-amber-400/80",
  },
  hong_kong: {
    primaryBgLight: "from-cyan-500/5",
    primaryBgDark: "dark:from-cyan-950/20",
    buttonBg: "bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(8,145,178,0.3)] dark:shadow-[0_4px_14px_rgba(8,145,178,0.15)]",
    textActive: "text-cyan-600 dark:text-cyan-400",
    borderActive: "border-cyan-500",
    badgeBg: "border-cyan-500 bg-cyan-50 text-cyan-600 dark:border-cyan-500/30 dark:bg-cyan-950/30 dark:text-cyan-400",
    indicatorBg: "bg-cyan-500",
    dateSelected: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-500 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400 shadow-sm",
    dateLabelSelected: "text-cyan-500/80 dark:text-cyan-400/80",
  },
  united_kingdom: {
    primaryBgLight: "from-blue-500/5",
    primaryBgDark: "dark:from-blue-950/20",
    buttonBg: "bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(37,99,235,0.3)] dark:shadow-[0_4px_14px_rgba(37,99,235,0.15)]",
    textActive: "text-blue-600 dark:text-blue-400",
    borderActive: "border-blue-500",
    badgeBg: "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-400",
    indicatorBg: "bg-blue-500",
    dateSelected: "bg-blue-50 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm",
    dateLabelSelected: "text-blue-500/80 dark:text-blue-400/80",
  },
  united_states: {
    primaryBgLight: "from-slate-500/5",
    primaryBgDark: "dark:from-slate-900/20",
    buttonBg: "bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(51,65,85,0.3)] dark:shadow-[0_4px_14px_rgba(51,65,85,0.15)]",
    textActive: "text-slate-700 dark:text-slate-300",
    borderActive: "border-slate-500",
    badgeBg: "border-slate-500 bg-slate-100 text-slate-700 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300",
    indicatorBg: "bg-slate-500",
    dateSelected: "bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200 shadow-sm",
    dateLabelSelected: "text-slate-500 dark:text-slate-400",
  },
  germany: {
    primaryBgLight: "from-red-500/5",
    primaryBgDark: "dark:from-red-950/20",
    buttonBg: "bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(220,38,38,0.3)] dark:shadow-[0_4px_14px_rgba(220,38,38,0.15)]",
    textActive: "text-red-600 dark:text-red-400",
    borderActive: "border-red-500",
    badgeBg: "border-red-500 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-400",
    indicatorBg: "bg-red-500",
    dateSelected: "bg-red-50 dark:bg-red-950/30 border-red-500 dark:border-red-500/50 text-red-600 dark:text-red-400 shadow-sm",
    dateLabelSelected: "text-red-500/80 dark:text-red-400/80",
  },
  france: {
    primaryBgLight: "from-violet-500/5",
    primaryBgDark: "dark:from-violet-950/20",
    buttonBg: "bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(124,58,237,0.3)] dark:shadow-[0_4px_14px_rgba(124,58,237,0.15)]",
    textActive: "text-violet-600 dark:text-violet-400",
    borderActive: "border-violet-500",
    badgeBg: "border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-400",
    indicatorBg: "bg-violet-500",
    dateSelected: "bg-violet-50 dark:bg-violet-950/30 border-violet-500 dark:border-violet-500/50 text-violet-600 dark:text-violet-400 shadow-sm",
    dateLabelSelected: "text-violet-500/80 dark:text-violet-400/80",
  },
  belgium: {
    primaryBgLight: "from-yellow-500/5",
    primaryBgDark: "dark:from-yellow-950/20",
    buttonBg: "bg-yellow-600 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(202,138,4,0.28)] dark:shadow-[0_4px_14px_rgba(202,138,4,0.14)]",
    textActive: "text-yellow-700 dark:text-yellow-300",
    borderActive: "border-yellow-600",
    badgeBg: "border-yellow-600 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-950/30 dark:text-yellow-300",
    indicatorBg: "bg-yellow-600",
    dateSelected: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-600 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-300 shadow-sm",
    dateLabelSelected: "text-yellow-600/80 dark:text-yellow-300/80",
  },
  norway: {
    primaryBgLight: "from-rose-500/5",
    primaryBgDark: "dark:from-rose-950/20",
    buttonBg: "bg-rose-700 hover:bg-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600",
    buttonShadow: "shadow-[0_4px_14px_rgba(190,24,93,0.28)] dark:shadow-[0_4px_14px_rgba(190,24,93,0.16)]",
    textActive: "text-rose-700 dark:text-rose-300",
    borderActive: "border-rose-600",
    badgeBg: "border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300",
    indicatorBg: "bg-rose-600",
    dateSelected: "bg-rose-50 dark:bg-rose-950/30 border-rose-600 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-sm",
    dateLabelSelected: "text-rose-600/80 dark:text-rose-300/80",
  },
  switzerland: {
    primaryBgLight: "from-rose-500/5",
    primaryBgDark: "dark:from-rose-950/25",
    buttonBg: "bg-rose-700 hover:bg-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600",
    buttonShadow: "shadow-[0_4px_14px_rgba(190,24,93,0.28)] dark:shadow-[0_4px_14px_rgba(190,24,93,0.16)]",
    textActive: "text-rose-700 dark:text-rose-300",
    borderActive: "border-rose-600",
    badgeBg: "border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300",
    indicatorBg: "bg-rose-600",
    dateSelected: "bg-rose-50 dark:bg-rose-950/30 border-rose-600 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-sm",
    dateLabelSelected: "text-rose-600/80 dark:text-rose-300/80",
  },
  china: {
    primaryBgLight: "from-orange-500/5",
    primaryBgDark: "dark:from-orange-950/20",
    buttonBg: "bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(234,88,12,0.3)] dark:shadow-[0_4px_14px_rgba(234,88,12,0.15)]",
    textActive: "text-orange-600 dark:text-orange-400",
    borderActive: "border-orange-500",
    badgeBg: "border-orange-500 bg-orange-50 text-orange-600 dark:border-orange-500/30 dark:bg-orange-950/30 dark:text-orange-400",
    indicatorBg: "bg-orange-500",
    dateSelected: "bg-orange-50 dark:bg-orange-950/30 border-orange-500 dark:border-orange-500/50 text-orange-600 dark:text-orange-400 shadow-sm",
    dateLabelSelected: "text-orange-500/80 dark:text-orange-400/80",
  },
};
