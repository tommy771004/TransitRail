import type { SearchResponse } from "../types";
import { createGtfsFeedSource, type GtfsFeed } from "./gtfs/feed";
import {
  collectGtfsJourneys,
  type GtfsJourney,
  type GtfsStationMatchOptions,
} from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

export const GERMANY_GTFS_URL = "https://download.gtfs.de/germany/fv_free/latest.zip";
const GERMANY_SOURCE = "gtfs.de Long Distance Rail Germany";

const germanyFeedSource = createGtfsFeedSource({
  url: GERMANY_GTFS_URL,
  label: "gtfs.de Germany GTFS",
});

const GERMANY_STATION_MATCH: GtfsStationMatchOptions = {
  aliases: {
    "munich hbf": ["München Hbf"],
    "cologne hbf": ["Köln Hbf"],
    "frankfurt hbf": ["Frankfurt(Main)Hbf"],
  },
};

function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  const tripName = journey.shortName?.trim();
  const routeName = route?.shortName?.trim() || route?.longName?.trim();
  if (tripName && routeName) {
    if (routeName.includes(tripName)) return routeName;
    if (tripName.includes(routeName)) return tripName;
    return `${routeName} ${tripName}`;
  }
  return tripName || routeName || "Train";
}

export async function searchGermanyGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  let feed: GtfsFeed;
  try {
    feed = await germanyFeedSource.load();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "GERMANY_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Germany GTFS download failed.",
        results: [],
        source: GERMANY_GTFS_URL,
      },
    };
  }

  const journeys = collectGtfsJourneys(
    feed,
    origin,
    destination,
    date,
    GERMANY_STATION_MATCH,
  );
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `gtfs.de published no ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: GERMANY_SOURCE,
      },
    };
  }

  const results = buildGtfsTimetable(feed, journeys, {
    idPrefix: "de",
    country: "germany",
    operator: "DB / German rail operators",
    origin,
    destination,
    serviceLabel,
    headsign: (journey) => journey.headsign?.trim() || undefined,
  });
  return { status: 200, body: { results, source: GERMANY_SOURCE } };
}

export function resetGermanyGtfsFeedCache() {
  germanyFeedSource.reset();
}
