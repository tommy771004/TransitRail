import type { SearchResponse } from "../types";
import { parseGtfsFeed, type GtfsFeed } from "./gtfs/feed";
import { collectGtfsJourneys, type GtfsJourney, type GtfsStationMatchOptions } from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

export const LTA_GTFS_SCHEDULE_URL = "https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain";
const LTA_GTFS_LABEL = "LTA DataMall GTFS Schedule (Train)";

const LTA_STATION_MATCH: GtfsStationMatchOptions = {
  fillerWords: ["mrt", "lrt", "station"],
};

function ltaAccountKey() {
  return process.env.LTA_ACCOUNT_KEY?.trim();
}

function downloadLink(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.Link === "string") return record.Link;
  const value = record.value;
  if (Array.isArray(value) && typeof value[0] === "object" && value[0] !== null) {
    const link = (value[0] as Record<string, unknown>).Link;
    return typeof link === "string" ? link : undefined;
  }
  if (value && typeof value === "object") {
    const link = (value as Record<string, unknown>).Link;
    return typeof link === "string" ? link : undefined;
  }
  return undefined;
}

async function loadLtaGtfsFeed(): Promise<GtfsFeed> {
  const accountKey = ltaAccountKey();
  if (!accountKey) throw new Error("LTA_ACCOUNT_KEY is not configured.");

  const linkResponse = await fetch(LTA_GTFS_SCHEDULE_URL, {
    headers: { AccountKey: accountKey, Accept: "application/json", "User-Agent": "TransitRail/1.0" },
  });
  if (!linkResponse.ok) throw new Error(`${LTA_GTFS_LABEL} returned HTTP ${linkResponse.status}.`);
  const link = downloadLink(await linkResponse.json());
  if (!link) throw new Error(`${LTA_GTFS_LABEL} response did not contain a download link.`);

  const archiveResponse = await fetch(link, {
    headers: { Accept: "application/zip", "User-Agent": "TransitRail/1.0" },
  });
  if (!archiveResponse.ok) throw new Error(`${LTA_GTFS_LABEL} archive returned HTTP ${archiveResponse.status}.`);
  return parseGtfsFeed(new Uint8Array(await archiveResponse.arrayBuffer()), {
    label: LTA_GTFS_LABEL,
    sourceUpdatedAt: archiveResponse.headers.get("last-modified") || undefined,
  });
}

const ltaGtfsFeedSource = (() => {
  // The LTA API hands back a short-lived signed archive URL, so the ordinary
  // fixed-URL GTFS source cannot own this cache. Use its public interface with
  // a private resolver instead, keeping one parsed feed for the full scrape.
  let cache: { expiresAt: number; feed: GtfsFeed } | undefined;
  return {
    async load() {
      if (cache && cache.expiresAt > Date.now()) return cache.feed;
      const feed = await loadLtaGtfsFeed();
      cache = { feed, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
      return feed;
    },
    reset() {
      cache = undefined;
    },
  };
})();

function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  return journey.shortName?.trim() || route?.shortName?.trim() || route?.longName?.trim() || "MRT/LRT";
}

export async function searchSingaporeLtaGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  let feed: GtfsFeed;
  try {
    feed = await ltaGtfsFeedSource.load();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "SINGAPORE_LTA_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "LTA GTFS download failed.",
        results: [],
        source: LTA_GTFS_SCHEDULE_URL,
      },
    };
  }

  const journeys = collectGtfsJourneys(feed, origin, destination, date, LTA_STATION_MATCH);
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `LTA published no direct ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: LTA_GTFS_SCHEDULE_URL,
      },
    };
  }

  return {
    status: 200,
    body: {
      results: buildGtfsTimetable(feed, journeys, {
        idPrefix: "sg-lta",
        country: "singapore",
        operator: "Singapore rail operators",
        origin,
        destination,
        serviceLabel,
        headsign: (journey) => journey.headsign?.trim() || undefined,
      }),
      source: LTA_GTFS_SCHEDULE_URL,
    },
  };
}

export function resetSingaporeLtaGtfsFeedCache() {
  ltaGtfsFeedSource.reset();
}
