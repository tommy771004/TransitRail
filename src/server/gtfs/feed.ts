import { inflateRawSync } from "node:zlib";

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type GtfsStop = {
  id: string;
  name: string;
  parentStation?: string;
};

export type GtfsTrip = {
  serviceId: string;
  headsign?: string;
  routeId?: string;
  shortName?: string;
};

export type GtfsRoute = {
  shortName?: string;
  longName?: string;
  routeType?: number;
};

export type GtfsFeed = {
  stops: GtfsStop[];
  trips: Map<string, GtfsTrip>;
  routes: Map<string, GtfsRoute>;
  stopTimes: string;
  activeDates: Map<string, Map<string, number>>;
  calendar?: string;
  sourceUpdatedAt?: string;
};

export type GtfsFeedSource = {
  readonly url: string;
  load(): Promise<GtfsFeed>;
  reset(): void;
};

type GtfsFeedSourceOptions = {
  url: string;
  label: string;
  userAgent?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

function read16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function read32(bytes: Uint8Array, offset: number) {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0;
}

function zipTextEntries(bytes: Uint8Array, label: string): Map<string, string> {
  const entries = new Map<string, string>();
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (read32(bytes, offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error(`${label} archive has no end-of-central-directory record.`);

  const count = read16(bytes, end + 10);
  const centralOffset = read32(bytes, end + 16);
  let offset = centralOffset;
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (read32(bytes, offset) !== 0x02014b50) {
      throw new Error(`${label} archive has an invalid central directory.`);
    }
    const compression = read16(bytes, offset + 10);
    const compressedSize = read32(bytes, offset + 20);
    const nameLength = read16(bytes, offset + 28);
    const extraLength = read16(bytes, offset + 30);
    const commentLength = read16(bytes, offset + 32);
    const localOffset = read32(bytes, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = read16(bytes, localOffset + 26);
    const localExtraLength = read16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const uncompressed = compression === 0
      ? compressed
      : compression === 8
        ? new Uint8Array(inflateRawSync(compressed))
        : (() => { throw new Error(`Unsupported GTFS ZIP compression method ${compression}.`); })();
    entries.set(name, decoder.decode(uncompressed));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function csvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

export function forEachGtfsCsvRow(
  text: string,
  callback: (row: Record<string, string>) => void,
) {
  let start = 0;
  let headers: string[] | undefined;
  while (start < text.length) {
    const end = text.indexOf("\n", start);
    const line = text.slice(start, end < 0 ? text.length : end).replace(/\r$/, "");
    start = end < 0 ? text.length : end + 1;
    if (!line) continue;
    const values = csvLine(line);
    if (!headers) {
      headers = values;
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = values[index] || ""; });
    callback(row);
  }
}

export function parseGtfsFeed(
  bytes: Uint8Array,
  options: { label: string; sourceUpdatedAt?: string },
): GtfsFeed {
  const archive = zipTextEntries(bytes, options.label);
  const requiredEntries = ["stops.txt", "trips.txt", "stop_times.txt", "routes.txt"];
  const missing = requiredEntries.filter((entry) => !archive.has(entry));
  if (missing.length > 0) {
    throw new Error(`${options.label} archive is missing ${missing.join(", ")}.`);
  }

  const stops: GtfsStop[] = [];
  forEachGtfsCsvRow(archive.get("stops.txt") || "", (row) => {
    if (row.stop_id && row.stop_name) {
      stops.push({
        id: row.stop_id,
        name: row.stop_name,
        parentStation: row.parent_station || undefined,
      });
    }
  });

  const trips = new Map<string, GtfsTrip>();
  forEachGtfsCsvRow(archive.get("trips.txt") || "", (row) => {
    if (row.trip_id && row.service_id) {
      trips.set(row.trip_id, {
        serviceId: row.service_id,
        headsign: row.trip_headsign || undefined,
        routeId: row.route_id || undefined,
        shortName: row.trip_short_name || undefined,
      });
    }
  });

  const activeDates = new Map<string, Map<string, number>>();
  forEachGtfsCsvRow(archive.get("calendar_dates.txt") || "", (row) => {
    if (!row.date || !row.service_id) return;
    const byService = activeDates.get(row.date) || new Map<string, number>();
    byService.set(row.service_id, Number(row.exception_type));
    activeDates.set(row.date, byService);
  });

  const routes = new Map<string, GtfsRoute>();
  forEachGtfsCsvRow(archive.get("routes.txt") || "", (row) => {
    if (!row.route_id) return;
    const routeType = Number(row.route_type);
    routes.set(row.route_id, {
      shortName: row.route_short_name || undefined,
      longName: row.route_long_name || undefined,
      routeType: Number.isFinite(routeType) ? routeType : undefined,
    });
  });

  return {
    stops,
    trips,
    routes,
    stopTimes: archive.get("stop_times.txt") || "",
    activeDates,
    calendar: archive.get("calendar.txt"),
    sourceUpdatedAt: options.sourceUpdatedAt,
  };
}

export function createGtfsFeedSource(options: GtfsFeedSourceOptions): GtfsFeedSource {
  let cache: { expiresAt: number; feed: GtfsFeed } | null = null;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  return {
    url: options.url,
    async load() {
      if (cache && cache.expiresAt > Date.now()) return cache.feed;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      let archiveBytes: ArrayBuffer;
      try {
        response = await fetch(options.url, {
          signal: controller.signal,
          headers: {
            Accept: "application/zip",
            "User-Agent": options.userAgent || "TransitRail/1.0",
          },
        });
        if (!response.ok) throw new Error(`${options.label} returned HTTP ${response.status}.`);
        archiveBytes = await response.arrayBuffer();
      } finally {
        clearTimeout(timeout);
      }

      const feed = parseGtfsFeed(new Uint8Array(archiveBytes), {
        label: options.label,
        sourceUpdatedAt: response.headers.get("last-modified") || undefined,
      });
      cache = { feed, expiresAt: Date.now() + cacheTtlMs };
      return feed;
    },
    reset() {
      cache = null;
    },
  };
}
