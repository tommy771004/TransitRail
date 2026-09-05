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
 * A source may declare an operator-published stable `latest` URL. Deployments
 * can still override it through the named environment variable, which keeps
 * mirrors and emergency migrations possible without a code release.
 */
import type { OfficialSourceId } from "../data/sourceRegistry";
import type { JourneyLeg, SearchResponse, TransitResult } from "../types";
import { createGtfsFeedSource, type GtfsFeed, type GtfsFeedSource } from "./gtfs/feed";
import {
  collectGtfsJourneyCalls,
  collectGtfsJourneys,
  formatGtfsClock,
  type GtfsJourney,
  type GtfsJourneyCall,
} from "./gtfs/journeys";
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
  /** Operator-published stable URL used when no environment override exists. */
  defaultUrl?: string;
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
  // The railway link on the operator page is deliberately not under `latest`;
  // that directory currently serves an expired 2025 archive.
  defaultUrl: "https://www.kotoden.co.jp/publichtm/gtfs/gtfsdata/gtfs_kd.zip",
};

const feedSources = new Map<string, GtfsFeedSource>();

/** The configured zip URL, or undefined when this feed is not set up. */
export function japanGtfsFeedUrl(source: JapanGtfsRailSource): string | undefined {
  return process.env[source.urlEnvVar]?.trim() || source.defaultUrl;
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

function timedLegs(
  calls: readonly GtfsJourneyCall[],
  lineName: string,
  headsign?: string,
): JourneyLeg[] {
  const legs: JourneyLeg[] = [];
  for (let index = 0; index < calls.length - 1; index += 1) {
    const from = calls[index];
    const to = calls[index + 1];
    const departure = from.departure ?? from.arrival;
    let arrival = to.arrival ?? to.departure;
    if (departure === undefined || arrival === undefined) continue;
    if (arrival < departure) arrival += 24 * 60;
    legs.push({
      lineName,
      mode: "train",
      origin: from.station,
      destination: to.station,
      departureTime: formatGtfsClock(departure),
      arrivalTime: formatGtfsClock(arrival),
      durationMinutes: arrival - departure,
      ...(headsign ? { headsign } : {}),
    });
  }
  return legs;
}

function attachCallingPatterns(
  feed: GtfsFeed,
  journeys: readonly GtfsJourney[],
  results: readonly TransitResult[],
  source: JapanGtfsRailSource,
): TransitResult[] {
  const callsByTrip = collectGtfsJourneyCalls(feed, journeys);
  return results.map((result, index) => {
    const journey = journeys[index];
    const calls = callsByTrip.get(journey.tripId) || [];
    const lineName = serviceLabel(source, feed, journey);
    const legs = timedLegs(calls, lineName, result.headsign);
    return {
      ...result,
      stops: calls.map((call) => call.station),
      ...(legs.length > 0 ? { legs } : {}),
    };
  });
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

  const results = buildGtfsTimetable(feed, journeys, {
    idPrefix: source.idPrefix,
    country: "japan",
    operator: source.operator,
    origin,
    destination,
    serviceLabel: (currentFeed, journey) => serviceLabel(source, currentFeed, journey),
    headsign: (journey) => journey.headsign?.trim() || undefined,
  });

  return {
    status: 200,
    body: {
      results: attachCallingPatterns(feed, journeys, results, source),
      source: source.label,
    },
  };
}

export function resetJapanGtfsFeedCache() {
  for (const feedSource of feedSources.values()) feedSource.reset();
  feedSources.clear();
}
