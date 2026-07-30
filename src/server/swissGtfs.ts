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

const SWISS_STATION_MATCH: GtfsStationMatchOptions = {
  aliases: {
    "zürich hb": ["Zürich Hauptbahnhof", "Zürich HB"],
    "geneve": ["Genève", "Geneva"],
    "genève": ["Genève", "Geneva"],
  },
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
export async function prepareSwissGtfsBatch(
  routes: readonly { origin: string; destination: string }[],
  dates: readonly string[],
) {
  const missing = routes.flatMap((route) => dates.map((date) => `${route.origin}\u0000${route.destination}\u0000${date}`))
    .filter((key) => !preparedResults.has(key));
  if (missing.length === 0) return;

  const feed = await loadSwissGtfs();
  const journeys = collectGtfsJourneysForDates(feed, routes, dates, SWISS_STATION_MATCH);
  routes.forEach((route, index) => {
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

export async function searchSwissGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
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
