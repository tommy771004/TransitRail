import type { SearchResponse } from "../types";
import { inflateRawSync } from "node:zlib";
import { parseGtfsFeed, type GtfsFeed } from "./gtfs/feed";
import { collectGtfsJourneys, type GtfsJourney, type GtfsStationMatchOptions } from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

// LTA's current GTFS Schedule (Train) catalogue entry is a static ZIP. The
// former datamall2 dynamic resolver now returns 401/404 even when an AccountKey
// is present, while this official catalogue URL is directly downloadable.
export const LTA_GTFS_SCHEDULE_URL = "https://datamall.lta.gov.sg/content/dam/datamall/datasets/PublicTransportRelated/GTFSScheduleTrain.zip";
const LTA_GTFS_LABEL = "LTA DataMall GTFS Schedule (Train)";

const LTA_STATION_MATCH: GtfsStationMatchOptions = {
  fillerWords: ["mrt", "lrt", "station"],
};

function readZip16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readZip32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * Walk a ZIP central directory and return its entries.
 *
 * Deliberately small and server-only: the DataMall wrapper uses ordinary ZIP
 * entries, not ZIP64. Reading names without inflating anything is what lets
 * the caller tell a GTFS archive from the wrapper by inspection rather than by
 * catching a parse failure.
 */
function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdOffset = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (readZip32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`${LTA_GTFS_LABEL} download is not a ZIP archive.`);

  const entryCount = readZip16(view, eocdOffset + 10);
  let cursor = readZip32(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();

  for (let index = 0; index < entryCount; index += 1) {
    if (readZip32(view, cursor) !== 0x02014b50) {
      throw new Error(`${LTA_GTFS_LABEL} archive has an invalid ZIP directory.`);
    }
    const nameLength = readZip16(view, cursor + 28);
    entries.push({
      name: decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
      compression: readZip16(view, cursor + 10),
      compressedSize: readZip32(view, cursor + 20),
      localHeaderOffset: readZip32(view, cursor + 42),
    });
    cursor += 46 + nameLength + readZip16(view, cursor + 30) + readZip16(view, cursor + 32);
  }

  return entries;
}

function readZipEntryText(bytes: Uint8Array, entry: ZipEntry): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readZip32(view, entry.localHeaderOffset) !== 0x04034b50) {
    throw new Error(`${LTA_GTFS_LABEL} archive has an invalid ZIP entry.`);
  }
  const dataStart = entry.localHeaderOffset + 30
    + readZip16(view, entry.localHeaderOffset + 26)
    + readZip16(view, entry.localHeaderOffset + 28);
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  const content = entry.compression === 0
    ? compressed
    : entry.compression === 8
      ? inflateRawSync(compressed)
      : undefined;
  if (!content) throw new Error(`${LTA_GTFS_LABEL} archive uses an unsupported ZIP compression method.`);
  return new TextDecoder().decode(content);
}

function findSignedArchiveLink(bytes: Uint8Array, entries: ZipEntry[]): string | undefined {
  const entryText = (suffix: string) => {
    const entry = entries.find((candidate) => candidate.name.toLowerCase().endsWith(suffix));
    return entry ? readZipEntryText(bytes, entry) : undefined;
  };
  const jsonEntry = entryText(".json");
  if (jsonEntry) {
    try {
      const value: unknown = JSON.parse(jsonEntry);
      const findLink = (candidate: unknown): string | undefined => {
        if (!candidate || typeof candidate !== "object") return undefined;
        for (const [key, child] of Object.entries(candidate)) {
          if (key.toLowerCase() === "link" && typeof child === "string") return child;
          const nested = findLink(child);
          if (nested) return nested;
        }
        return undefined;
      };
      const link = findLink(value);
      if (link) return link;
    } catch {
      // The XML copy below is the fallback when DataMall changes the JSON shape.
    }
  }

  const xmlEntry = entryText(".xml");
  const xmlLink = xmlEntry?.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1]
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return xmlLink?.trim() || undefined;
}

async function loadLtaGtfsFeed(): Promise<GtfsFeed> {
  const catalogueResponse = await fetch(LTA_GTFS_SCHEDULE_URL, {
    headers: { Accept: "application/zip", "User-Agent": "TransitRail/1.0" },
  });
  if (!catalogueResponse.ok) throw new Error(`${LTA_GTFS_LABEL} download returned HTTP ${catalogueResponse.status}.`);
  const catalogueBytes = new Uint8Array(await catalogueResponse.arrayBuffer());
  const sourceUpdatedAt = catalogueResponse.headers.get("last-modified") || undefined;

  // Decide what was downloaded by looking at it, not by catching a parse
  // failure: treating any exception as "this must be the wrapper" reported a
  // genuinely corrupt GTFS archive as a missing download link, pointing at the
  // wrong end of the chain. Accepting a direct archive also means a future
  // DataMall change that drops the wrapper needs no code change.
  const entries = readZipDirectory(catalogueBytes);
  if (entries.some((entry) => entry.name.toLowerCase().endsWith("stops.txt"))) {
    return parseGtfsFeed(catalogueBytes, { label: LTA_GTFS_LABEL, sourceUpdatedAt });
  }

  const archiveUrl = findSignedArchiveLink(catalogueBytes, entries);
  if (!archiveUrl) throw new Error(`${LTA_GTFS_LABEL} catalogue did not contain a signed archive link.`);
  const archiveResponse = await fetch(archiveUrl, {
    headers: { Accept: "application/zip", "User-Agent": "TransitRail/1.0" },
  });
  if (!archiveResponse.ok) throw new Error(`${LTA_GTFS_LABEL} archive download returned HTTP ${archiveResponse.status}.`);
  return parseGtfsFeed(new Uint8Array(await archiveResponse.arrayBuffer()), {
    label: LTA_GTFS_LABEL,
    sourceUpdatedAt: archiveResponse.headers.get("last-modified") || sourceUpdatedAt,
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
