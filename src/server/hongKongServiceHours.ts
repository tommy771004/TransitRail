/**
 * Official MTR first/last train times, per route direction.
 *
 * MTR publishes no departure-by-departure timetable for its urban lines — not
 * as an API, not as a file. The Next Train API answers "the next four trains"
 * and nothing about any other date. What MTR does publish is the first and last
 * train from each station toward each terminus, which is real, official, and
 * valid for future dates. This adapter collects that and nothing else, so a
 * future date can carry a true service window instead of invented departures.
 *
 * Two honest limits, both recorded on every advisory it produces:
 * - MTR publishes ONE first/last pair per direction; it does not vary by
 *   weekday/Saturday/Sunday the way the SMRT feed does. `serviceDayType` still
 *   records which kind of day was requested, but the times are not day-typed.
 * - Train frequency is published on a separate page and is not collected here.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceDayAdvisory, ServiceDayType } from "../types";
import {
  serviceDayRisk,
  validateServiceDayAdvisory,
  withArtifactFreshness,
  withSelectedQueryRisk,
} from "../data/serviceDayAdvisory";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const SOURCE = "MTR official service hours";
const SOURCE_URL = "https://www.mtr.com.hk/en/customer/services/service_hours_search.php";
const TIMEZONE = "Asia/Hong_Kong";
const ARTIFACT_PATH = resolve(process.cwd(), "src/data/service-day/hong_kong.json");

const NOTE = "MTR publishes one first/last train per direction, not a departure timetable "
  + "and not a separate set per service day. Check mtr.com.hk for train frequency.";

/**
 * Where each committed route's first/last lives on the MTR page.
 *
 * `stationId` selects the page, `line` picks the section (the line code is
 * rendered server-side), and `terminusIds` picks the row — the page identifies a
 * row's destination only by a `js_station_<id>` span resolved client-side, so
 * matching the id directly avoids depending on MTR's station-name dictionary.
 *
 * `terminusIds` is a list because MTR gives one physical station a different id
 * per line: Hong Kong station is 39 on the Tung Chung Line and 44 on the
 * Airport Express. Matching a single id silently missed the row.
 *
 * Hong Kong → Airport is deliberately absent: the Hong Kong station page
 * carries only the Tung Chung Line section, with no Airport Express times to
 * read. It resolves to `unavailable` rather than borrowing another line's.
 */
const ROUTES: Record<string, { stationId: number; line: string; terminusIds: number[] }> = {
  "central->tsuen wan": { stationId: 1, line: "TWL", terminusIds: [25] },
  "admiralty->tsim sha tsui": { stationId: 2, line: "TWL", terminusIds: [25] },
  "tung chung->sunny bay": { stationId: 43, line: "TCL", terminusIds: [39, 44] },
};

export type HongKongServiceDayArtifact = {
  schemaVersion: 1;
  country: "hong_kong";
  source: typeof SOURCE;
  sourceUrl: typeof SOURCE_URL;
  timezone: typeof TIMEZONE;
  retrievedAt: string;
  validFrom: string;
  validTo: string;
  routes: Record<string, Record<string, ServiceDayAdvisory>>;
};

let artifactCache: HongKongServiceDayArtifact | null | undefined;
const pageFetchCache = new Map<number, Promise<string>>();

function key(origin: string, destination: string) {
  return `${origin.toLowerCase().trim()}->${destination.toLowerCase().trim()}`;
}

function dayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" })
    .format(new Date(`${date}T12:00:00+08:00`));
  return weekday === "Saturday" ? "saturday" : weekday === "Sunday" ? "sunday_holiday" : "weekday";
}

/** "0606" → "06:06". MTR renders a bare four-digit clock. */
function clock(value: string | undefined): string | undefined {
  return /^\d{4}$/.test(value ?? "") ? `${value!.slice(0, 2)}:${value!.slice(2)}` : undefined;
}

function unavailable(date: string, note: string): ServiceDayAdvisory {
  return {
    coverage: "unavailable",
    serviceDate: date,
    timezone: TIMEZONE,
    serviceDayType: dayType(date),
    risk: "unavailable",
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    checkedAt: new Date().toISOString(),
    note,
  };
}

const LINE_SECTION = /trainLine (\w+)"[^>]*>\s*<\/h2>\s*<div>\s*(<table[\s\S]*?<\/table>)/g;
const DESTINATION_ROW = /js_station_(\d+)"[\s\S]*?firstTrain">(\d{4})<\/td>\s*<td>(\d{4})<\/td>/g;

/**
 * Read the first/last pair for one route out of an MTR service-hours page.
 *
 * HTML comments are stripped first: the page ships commented-out sample rows
 * carrying literal station names and plausible times, which a tolerant parser
 * would happily read as real data for the wrong line.
 */
export function buildHongKongServiceHoursAdvisory(
  page: string,
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): ServiceDayAdvisory {
  const route = ROUTES[key(origin, destination)];
  if (!route) {
    return unavailable(date, "MTR does not publish first/last train times for this route direction.");
  }

  const live = page.replace(/<!--[\s\S]*?-->/g, "");
  let firstDeparture: string | undefined;
  let lastDeparture: string | undefined;
  for (const [, line, table] of live.matchAll(LINE_SECTION)) {
    if (line !== route.line) continue;
    for (const [, terminus, first, last] of table.matchAll(DESTINATION_ROW)) {
      if (!route.terminusIds.includes(Number(terminus))) continue;
      firstDeparture = clock(first);
      lastDeparture = clock(last);
    }
  }
  if (!firstDeparture || !lastDeparture) {
    return unavailable(date, "MTR did not publish a first/last pair for this direction on the service hours page.");
  }

  const advisory = validateServiceDayAdvisory({
    coverage: "partial",
    serviceDate: date,
    timezone: TIMEZONE,
    serviceDayType: dayType(date),
    firstDeparture,
    lastDeparture,
    risk: serviceDayRisk(24 * 60),
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    checkedAt: new Date().toISOString(),
    note: NOTE,
  });
  return withSelectedQueryRisk(advisory, selectedTime);
}

export async function fetchHongKongStationHours(
  stationId: number,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const response = await fetcher(`${SOURCE_URL}?query_type=search&station=${stationId}`, {
    headers: { "user-agent": "TransitRail scheduled service-day collector" },
  });
  if (!response.ok) throw new Error(`MTR returned HTTP ${response.status}.`);
  const page = await response.text();
  if (!page.includes("trainLine")) throw new Error("MTR returned no service hours sections.");
  return page;
}

function loadArtifact(): HongKongServiceDayArtifact | null {
  if (artifactCache !== undefined) return artifactCache;
  if (!existsSync(ARTIFACT_PATH)) return artifactCache = null;
  try {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as HongKongServiceDayArtifact;
    if (artifact.schemaVersion !== 1 || artifact.country !== "hong_kong" || !artifact.routes) {
      throw new Error("Invalid Hong Kong artifact.");
    }
    for (const dates of Object.values(artifact.routes)) {
      for (const advisory of Object.values(dates)) validateServiceDayAdvisory(advisory);
    }
    return artifactCache = artifact;
  } catch {
    return artifactCache = null;
  }
}

export async function getHongKongServiceDayAdvisory(
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): Promise<ServiceDayAdvisory> {
  const artifact = loadArtifact();
  const advisory = artifact?.routes[key(origin, destination)]?.[date];
  if (!advisory) {
    return unavailable(date, ROUTES[key(origin, destination)]
      ? "MTR service-day information is not available from the latest scheduled artifact."
      : "MTR does not publish first/last train times for this route direction.");
  }
  return withSelectedQueryRisk(withArtifactFreshness(advisory, artifact.retrievedAt), selectedTime);
}

export async function collectHongKongServiceDayArtifact(
  routes: Array<{ origin: string; destination: string }>,
  date: string,
  fetcher: Fetcher = fetch,
): Promise<HongKongServiceDayArtifact> {
  const existing = loadArtifact();
  const artifact: HongKongServiceDayArtifact = existing || {
    schemaVersion: 1,
    country: "hong_kong",
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    timezone: TIMEZONE,
    retrievedAt: new Date().toISOString(),
    validFrom: date,
    validTo: date,
    routes: {},
  };

  let collected = 0;
  for (const requested of routes) {
    const route = ROUTES[key(requested.origin, requested.destination)];
    if (!route) continue;
    let promise = pageFetchCache.get(route.stationId);
    if (!promise) {
      promise = fetchHongKongStationHours(route.stationId, fetcher);
      pageFetchCache.set(route.stationId, promise);
    }
    const advisory = buildHongKongServiceHoursAdvisory(
      await promise,
      requested.origin,
      requested.destination,
      date,
    );
    // Record an unavailable verdict rather than aborting: one direction MTR
    // stopped publishing must not throw away the routes that did resolve, and
    // "we could not read this" is itself the honest answer for that route.
    const routeKey = key(requested.origin, requested.destination);
    artifact.routes[routeKey] = { ...(artifact.routes[routeKey] || {}), [date]: advisory };
    if (advisory.coverage !== "unavailable") collected += 1;
  }
  if (collected === 0) throw new Error("No supported Hong Kong MTR route was collected.");

  artifact.retrievedAt = new Date().toISOString();
  artifact.validFrom = artifact.validFrom < date ? artifact.validFrom : date;
  artifact.validTo = artifact.validTo > date ? artifact.validTo : date;
  mkdirSync(resolve(ARTIFACT_PATH, ".."), { recursive: true });
  const tempPath = `${ARTIFACT_PATH}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(tempPath, ARTIFACT_PATH);
  artifactCache = artifact;
  return artifact;
}

export function resetHongKongServiceHoursCache() {
  artifactCache = undefined;
  pageFetchCache.clear();
}
