import type { SearchResponse } from "../types";
import { createGtfsFeedSource, type GtfsFeed } from "./gtfs/feed";
import { collectGtfsJourneys, type GtfsJourney } from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

/** Official Ministry of Transport Malaysia static GTFS for KTMB rail. */
export const MALAYSIA_KTMB_GTFS_URL = "https://api.data.gov.my/gtfs-static/ktmb";
const MALAYSIA_KTMB_SOURCE = "data.gov.my / KTMB GTFS";

const malaysiaKtmbFeedSource = createGtfsFeedSource({
  url: MALAYSIA_KTMB_GTFS_URL,
  label: "data.gov.my KTMB GTFS",
  // data.gov.my negotiates this endpoint as a general binary download and
  // returns 406 for `application/zip`, despite serving a valid GTFS zip.
  accept: "*/*",
});

function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  return journey.shortName?.trim()
    || route?.shortName?.trim()
    || route?.longName?.trim()
    || "KTMB train";
}

/**
 * Reads only trips whose GTFS calendar declares them active on `date`.
 * A date with no active service is deliberately a 404, never a generated
 * headway-based timetable.
 */
export async function searchMalaysiaKtmbGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  let feed: GtfsFeed;
  try {
    feed = await malaysiaKtmbFeedSource.load();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "MALAYSIA_KTMB_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "KTMB GTFS download failed.",
        results: [],
        source: MALAYSIA_KTMB_GTFS_URL,
      },
    };
  }

  const journeys = collectGtfsJourneys(feed, origin, destination, date);
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `data.gov.my published no KTMB ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: MALAYSIA_KTMB_SOURCE,
      },
    };
  }

  return {
    status: 200,
    body: {
      results: buildGtfsTimetable(feed, journeys, {
        idPrefix: "my-ktmb",
        country: "malaysia",
        operator: "Keretapi Tanah Melayu Berhad (KTMB)",
        origin,
        destination,
        serviceLabel,
        headsign: (journey) => journey.headsign?.trim() || undefined,
      }),
      source: MALAYSIA_KTMB_SOURCE,
    },
  };
}

export function resetMalaysiaKtmbGtfsFeedCache() {
  malaysiaKtmbFeedSource.reset();
}
