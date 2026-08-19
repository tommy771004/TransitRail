/**
 * Japanese local railways that publish their own GTFS-JP feed.
 *
 * Tokyo's operators publish through ODPT, which is a per-operator JSON API; the
 * rest of the country's rail open data arrives as GTFS-JP zips published by the
 * operator or through the national GTFS data repository. That is a different
 * shape but not a different quality of data — it is the operator's own
 * timetable, so it reads through the same GTFS machinery every other
 * feed-backed market uses.
 *
 * The feed URL is configuration, not a constant. An operator's zip lives behind
 * whatever path its own site or repository entry gives it, and a URL committed
 * from memory would fetch nothing every night while looking configured. Unset
 * means the scraper does not run, exactly as an absent `ODPT_API_KEY` drops the
 * Tokyo Metro routes rather than filling them from somewhere else.
 */
import type { OfficialSourceId } from "../data/sourceRegistry";
import type { SearchResponse } from "../types";
import { createGtfsFeedSource, type GtfsFeed, type GtfsFeedSource } from "./gtfs/feed";
import { collectGtfsJourneys, type GtfsJourney } from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

export type JapanGtfsRailSource = {
  /** Registered source backing every row this feed produces. */
  sourceId: OfficialSourceId;
  /** Operator credited on each departure. */
  operator: string;
  /** Human label used in download errors. */
  label: string;
  /** Row id prefix, matching the source id's operator part. */
  idPrefix: string;
  /** Environment variable holding the feed's zip URL. */
  urlEnvVar: string;
};

/**
 * Takamatsu-Kotohira Electric Railroad — three lines around Takamatsu, and one
 * of the few Japanese railways publishing GTFS-JP directly rather than through
 * ODPT. Its open-data page is the registered source URL; the zip it links to
 * goes in `KOTODEN_GTFS_URL`.
 */
export const KOTODEN_GTFS_RAIL: JapanGtfsRailSource = {
  sourceId: "jp-kotoden-gtfs",
  operator: "Takamatsu-Kotohira Electric Railroad (Kotoden)",
  label: "Kotoden GTFS-JP",
  idPrefix: "jp-kotoden",
  urlEnvVar: "KOTODEN_GTFS_URL",
};

const feedSources = new Map<string, GtfsFeedSource>();

/** The configured zip URL, or undefined when this feed is not set up. */
export function japanGtfsFeedUrl(source: JapanGtfsRailSource): string | undefined {
  return process.env[source.urlEnvVar]?.trim() || undefined;
}

function feedSourceFor(source: JapanGtfsRailSource): GtfsFeedSource {
  const url = japanGtfsFeedUrl(source);
  if (!url) throw new Error(`${source.label} has no feed URL; set ${source.urlEnvVar}.`);
  const cached = feedSources.get(source.sourceId);
  if (cached && cached.url === url) return cached;
  const created = createGtfsFeedSource({
    url,
    label: source.label,
    // GTFS-JP zips are commonly served by general file gateways that reject a
    // narrow zip Accept, the same way data.gov.my does.
    accept: "*/*",
  });
  feedSources.set(source.sourceId, created);
  return created;
}

/** Parse the operator's feed, cached for the process. */
export function loadJapanGtfsFeed(source: JapanGtfsRailSource): Promise<GtfsFeed> {
  return feedSourceFor(source).load();
}

function serviceLabel(source: JapanGtfsRailSource, feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  return route?.longName?.trim()
    || route?.shortName?.trim()
    || journey.shortName?.trim()
    || source.operator;
}

/**
 * Departures the feed itself declares active on `date`.
 * A date the calendar excludes is a 404: this reads a timetable, it does not
 * assume yesterday's service repeats.
 */
export async function searchJapanGtfsRail(
  source: JapanGtfsRailSource,
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  const url = japanGtfsFeedUrl(source);
  if (!url) {
    return {
      status: 501,
      body: {
        error: "JAPAN_GTFS_FEED_NOT_CONFIGURED",
        message: `${source.label} has no feed URL; set ${source.urlEnvVar}.`,
        results: [],
        source: source.label,
      },
    };
  }

  let feed: GtfsFeed;
  try {
    feed = await loadJapanGtfsFeed(source);
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "JAPAN_GTFS_FEED_UNAVAILABLE",
        message: error instanceof Error ? error.message : `${source.label} download failed.`,
        results: [],
        source: url,
      },
    };
  }

  const journeys = collectGtfsJourneys(feed, origin, destination, date);
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `${source.label} published no ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: source.label,
      },
    };
  }

  return {
    status: 200,
    body: {
      results: buildGtfsTimetable(feed, journeys, {
        idPrefix: source.idPrefix,
        country: "japan",
        operator: source.operator,
        origin,
        destination,
        serviceLabel: (currentFeed, journey) => serviceLabel(source, currentFeed, journey),
        headsign: (journey) => journey.headsign?.trim() || undefined,
      }),
      source: source.label,
    },
  };
}

export function resetJapanGtfsFeedCache() {
  for (const feedSource of feedSources.values()) feedSource.reset();
  feedSources.clear();
}
