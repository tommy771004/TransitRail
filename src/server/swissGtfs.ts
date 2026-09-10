import type { SearchResponse } from "../types";
import { createGtfsFeedSource, type GtfsFeed, type GtfsFeedSource } from "./gtfs/feed";
import {
  collectGtfsJourneys,
  collectGtfsJourneysForDates,
  type GtfsJourney,
  type GtfsStationMatchOptions,
} from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

/** The public catalog page is used to discover the newest ZIP without a token. */
export const SWISS_GTFS_CATALOG_URL =
  "https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020";
const SWISS_SOURCE = "OpenTransportData Swiss GTFS Static";
const SWISS_DATA_HOST = "data.opentransportdata.swiss";

/** Exported so a test can prove every key is one the matcher can look up. */
export const SWISS_REGISTER_IDS: Readonly<Record<string, readonly string[]>> = {
  "Arth-Goldau": ["8505004"],
  "Basel SBB": ["8500010"],
  "Bellinzona": ["8505213"],
  "Bern": ["8507000"],
  "Biel/Bienne": ["8504300"],
  "Brig": ["8501609"],
  "Chur": ["8509000"],
  "Fribourg/Freiburg": ["8504100"],
  "Genève": ["8501008"],
  "Genève-Aéroport": ["8501026"],
  "Interlaken Ost": ["8507492"],
  "Lausanne": ["8501120"],
  "Lugano": ["8505300"],
  "Luzern": ["8505000"],
  "Montreux": ["8501300"],
  "Sargans": ["8509411"],
  "Sion": ["8501506"],
  "St. Gallen": ["8506302"],
  "Winterthur": ["8506000"],
  "Yverdon-les-Bains": ["8504200"],
  "Zug": ["8502204"],
  "Zürich Flughafen": ["8503016"],
  "Zürich HB": ["8503000"],
};

const SWISS_STATION_MATCH: GtfsStationMatchOptions = {
  aliases: {
    "zürich hb": ["Zürich Hauptbahnhof", "Zürich HB"],
    "geneve": ["Genève", "Geneva"],
    "genève": ["Genève", "Geneva"],
  },
  registerIds: SWISS_REGISTER_IDS,
};

let feedSource: GtfsFeedSource | null = null;
const preparedResults = new Map<string, { status: number; body: SearchResponse & { error?: string } }>();

function latestZipUrl(html: string): string | undefined {
  const pattern = /href=["']([^"']*gtfs_fp\d{4}_[^"']+\.zip)["']/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const candidate = new URL(match[1], SWISS_GTFS_CATALOG_URL);
      if (
        candidate.hostname === SWISS_DATA_HOST &&
        candidate.pathname.includes("/download/") &&
        candidate.pathname.toLowerCase().endsWith(".zip")
      ) {
        return candidate.toString();
      }
    } catch {
      // Ignore malformed historical links and keep looking for the newest one.
    }
  }
  return undefined;
}

async function discoverSwissGtfsUrl(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(SWISS_GTFS_CATALOG_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "TransitRail/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Swiss GTFS catalog returned HTTP ${response.status}.`);
    }
    const url = latestZipUrl(await response.text());
    if (!url) {
      throw new Error("Swiss GTFS catalog did not expose a current ZIP download.");
    }
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSwissGtfs(): Promise<GtfsFeed> {
  if (!feedSource) {
    feedSource = createGtfsFeedSource({
      url: await discoverSwissGtfsUrl(),
      label: SWISS_SOURCE,
      timeoutMs: 90_000,
      cacheTtlMs: 12 * 60 * 60 * 1000,
    });
  }
  return feedSource.load();
}

function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  return journey.shortName?.trim()
    || route?.shortName?.trim()
    || route?.longName?.trim()
    || "Swiss Rail";
}

function responseForJourneys(
  feed: GtfsFeed,
  origin: string,
  destination: string,
  date: string,
  journeys: GtfsJourney[],
) {
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `Swiss GTFS published no ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: SWISS_SOURCE,
      },
    } satisfies { status: number; body: SearchResponse & { error?: string } };
  }

  return {
    status: 200,
    body: {
      results: buildGtfsTimetable(feed, journeys, {
        idPrefix: "ch-gtfs",
        country: "switzerland",
        operator: "Swiss public transport operators",
        origin,
        destination,
        serviceLabel,
        headsign: (journey) => journey.headsign?.trim() || undefined,
      }),
      source: SWISS_SOURCE,
    },
  } satisfies { status: number; body: SearchResponse & { error?: string } };
}

/** Precompute all configured Swiss routes and scrape dates in one stop_times pass. */
/**
 * How many routes one collection pass may hold.
 *
 * `collectGtfsJourneysForDates` keeps a trip index per route, and a hub appears
 * in many routes at once — every Zürich HB stop time is recorded against each of
 * the ~20 routes that end there. Collecting all 75 configured routes in one pass
 * exhausted the default V8 heap ("Ineffective mark-compacts near heap limit")
 * and took the whole scrape with it.
 *
 * Chunking bounds that index to a slice of the route list. The cost is one extra
 * scan of `stop_times` per chunk, which re-reads nothing: the parsed feed is
 * cached in {@link loadSwissGtfs} and shared across passes.
 */
const PREPARE_ROUTE_CHUNK = 16;

export async function prepareSwissGtfsBatch(
  routes: readonly { origin: string; destination: string }[],
  dates: readonly string[],
) {
  const missing = routes.flatMap((route) => dates.map((date) => `${route.origin}\u0000${route.destination}\u0000${date}`))
    .filter((key) => !preparedResults.has(key));
  if (missing.length === 0) return;

  const feed = await loadSwissGtfs();
  for (let offset = 0; offset < routes.length; offset += PREPARE_ROUTE_CHUNK) {
    const chunk = routes.slice(offset, offset + PREPARE_ROUTE_CHUNK);
    const journeys = collectGtfsJourneysForDates(feed, chunk, dates, SWISS_STATION_MATCH);
    chunk.forEach((route, index) => {
      dates.forEach((date) => {
        const key = `${route.origin}\u0000${route.destination}\u0000${date}`;
        preparedResults.set(key, responseForJourneys(
          feed,
          route.origin,
          route.destination,
          date,
          journeys.get(`${index}:${date}`) || [],
        ));
      });
    });
  }
}

export async function searchSwissGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  // Kept, not consumed: one warm-up covers the whole window, and the scrape then
  // asks for each service day in turn. Deleting on read made every later day
  // look unprepared and re-collect the entire feed.
  const prepared = preparedResults.get(`${origin}\u0000${destination}\u0000${date}`);
  if (prepared) return prepared;

  let feed: GtfsFeed;
  try {
    feed = await loadSwissGtfs();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "SWISS_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Swiss GTFS download failed.",
        results: [],
        source: SWISS_SOURCE,
      },
    };
  }

  const journeys = collectGtfsJourneys(feed, origin, destination, date, SWISS_STATION_MATCH);
  return responseForJourneys(feed, origin, destination, date, journeys);
}

export function resetSwissGtfsFeedCache() {
  feedSource?.reset();
  feedSource = null;
  preparedResults.clear();
}
