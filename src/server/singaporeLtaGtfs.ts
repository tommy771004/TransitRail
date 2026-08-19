import type { SearchResponse } from "../types";
import { parseGtfsFeed, type GtfsFeed } from "./gtfs/feed";
import { collectGtfsJourneys, type GtfsJourney, type GtfsStationMatchOptions } from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

/**
 * DataMall's GTFS Schedule (Train) resolver. It answers with a **freshly
 * signed** S3 link valid for 15 minutes, and it requires an AccountKey.
 *
 * Do not point this at the static
 * `datamall.lta.gov.sg/content/dam/.../GTFSScheduleTrain.zip` file. It is
 * fetchable without a key, which makes it look like the easier source, but it
 * is a frozen snapshot of one resolver response: the signed link inside it was
 * minted on 2026-07-31 with `X-Amz-Expires=900`, so it has been dead since
 * fifteen minutes after that and no download can revive it. A 200 from that
 * URL followed by 403 on the archive is that trap, not a transient outage.
 */
export const LTA_GTFS_SCHEDULE_URL = "https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain";
const LTA_GTFS_LABEL = "LTA DataMall GTFS Schedule (Train)";

const LTA_STATION_MATCH: GtfsStationMatchOptions = {
  fillerWords: ["mrt", "lrt", "station"],
};

function ltaAccountKey(): string | undefined {
  return process.env.LTA_ACCOUNT_KEY?.trim() || undefined;
}

/** Pull the signed archive URL out of whichever envelope shape DataMall returns. */
function downloadLink(payload: unknown): string | undefined {
  const find = (candidate: unknown): string | undefined => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const nested = find(item);
        if (nested) return nested;
      }
      return undefined;
    }
    if (!candidate || typeof candidate !== "object") return undefined;
    for (const [key, child] of Object.entries(candidate)) {
      if (key.toLowerCase() === "link" && typeof child === "string") return child;
      const nested = find(child);
      if (nested) return nested;
    }
    return undefined;
  };
  return find(payload);
}

async function loadLtaGtfsFeed(): Promise<GtfsFeed> {
  const accountKey = ltaAccountKey();
  if (!accountKey) {
    throw new Error(
      `${LTA_GTFS_LABEL} needs LTA_ACCOUNT_KEY. Only the authenticated resolver mints a usable archive link.`,
    );
  }

  const linkResponse = await fetch(LTA_GTFS_SCHEDULE_URL, {
    headers: { AccountKey: accountKey, Accept: "application/json", "User-Agent": "TransitRail/1.0" },
  });
  // DataMall answers an unauthenticated request with 404 whatever the path, so
  // a 401 here is the gateway rejecting this key, not a wrong address.
  if (linkResponse.status === 401) {
    throw new Error(`${LTA_GTFS_LABEL} rejected LTA_ACCOUNT_KEY (HTTP 401). The credential needs renewing, not the URL.`);
  }
  if (!linkResponse.ok) throw new Error(`${LTA_GTFS_LABEL} resolver returned HTTP ${linkResponse.status}.`);

  const link = downloadLink(await linkResponse.json());
  if (!link) throw new Error(`${LTA_GTFS_LABEL} response did not contain a download link.`);

  const archiveResponse = await fetch(link, {
    headers: { Accept: "application/zip", "User-Agent": "TransitRail/1.0" },
  });
  if (!archiveResponse.ok) {
    throw new Error(`${LTA_GTFS_LABEL} archive download returned HTTP ${archiveResponse.status}.`);
  }
  return parseGtfsFeed(new Uint8Array(await archiveResponse.arrayBuffer()), {
    label: LTA_GTFS_LABEL,
    sourceUpdatedAt: archiveResponse.headers.get("last-modified") || undefined,
  });
}

const ltaGtfsFeedSource = (() => {
  // The LTA resolver hands back a short-lived signed archive URL, so the
  // ordinary fixed-URL GTFS source cannot own this cache. Use its public
  // interface with a private resolver instead, keeping one parsed feed for the
  // full scrape.
  const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
  // Failures are remembered too, for long enough to cover one nightly run.
  // Every route and date used to retry the whole chain on its own, so a single
  // rejected credential was downloaded and logged twenty-eight times; one
  // attempt and one message is what a human can actually act on. The window is
  // short so a long-lived server still recovers on its own once LTA or the key
  // is fixed.
  const FAILURE_TTL_MS = 10 * 60 * 1000;
  let cache: { expiresAt: number; feed: GtfsFeed } | undefined;
  let failure: { expiresAt: number; error: Error } | undefined;
  let inFlight: Promise<GtfsFeed> | undefined;
  return {
    async load() {
      if (cache && cache.expiresAt > Date.now()) return cache.feed;
      if (failure && failure.expiresAt > Date.now()) throw failure.error;
      if (!inFlight) {
        inFlight = loadLtaGtfsFeed()
          .then((feed) => {
            cache = { feed, expiresAt: Date.now() + SUCCESS_TTL_MS };
            failure = undefined;
            return feed;
          })
          .catch((error: unknown) => {
            const wrapped = error instanceof Error ? error : new Error(String(error));
            failure = { error: wrapped, expiresAt: Date.now() + FAILURE_TTL_MS };
            throw wrapped;
          })
          .finally(() => { inFlight = undefined; });
      }
      return inFlight;
    },
    reset() {
      cache = undefined;
      failure = undefined;
      inFlight = undefined;
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
