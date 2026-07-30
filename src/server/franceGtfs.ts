import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SearchResponse, ServiceDayAdvisory, ServiceDayType } from "../types";
import { recordError } from "./errorLog";
import { serviceDayRisk, validateServiceDayAdvisory, withArtifactFreshness, withSelectedQueryRisk } from "../data/serviceDayAdvisory";
import { createGtfsFeedSource, type GtfsFeed } from "./gtfs/feed";
import {
  collectGtfsJourneys,
  formatGtfsExtendedMinutes,
  type GtfsJourney,
  type GtfsStationMatchOptions,
} from "./gtfs/journeys";
import { buildGtfsTimetable } from "./gtfs/timetable";

export const FRANCE_GTFS_URL = "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip";
const FRANCE_TIMEZONE = "Europe/Paris";

export type FranceServiceDayArtifact = {
  schemaVersion: 1;
  country: "france";
  source: "SNCF Open Data GTFS";
  sourceUrl: string;
  timezone: typeof FRANCE_TIMEZONE;
  retrievedAt: string;
  sourceUpdatedAt?: string;
  validFrom: string;
  validTo: string;
  routes: Record<string, Record<string, ServiceDayAdvisory>>;
};

let artifactCache: FranceServiceDayArtifact | null | undefined;
const ARTIFACT_PATH = resolve(process.cwd(), "src/data/service-day/france.json");

function normalizeStation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that differ between how we name a station and how SNCF does, and carry
 *  no distinguishing information ("Paris Gare de l'Est" vs "Paris Est"). */
const FRANCE_STATION_MATCH: GtfsStationMatchOptions = {
  fillerWords: ["gare", "station", "de", "du", "des", "d", "la", "le", "les", "l", "sncf", "ville"],
  // The route list abbreviates Marseille St-Charles while SNCF spells out Saint.
  synonyms: { st: "saint", ste: "sainte", sts: "saints" },
};

const franceFeedSource = createGtfsFeedSource({
  url: FRANCE_GTFS_URL,
  label: "SNCF GTFS",
});

function loadFeed(): Promise<GtfsFeed> {
  return franceFeedSource.load();
}

function serviceDayType(feed: GtfsFeed | undefined, date: string): ServiceDayType {
  const exceptions = feed?.activeDates.get(date.replace(/-/g, ""));
  if (feed?.calendar && exceptions && exceptions.size > 0) return "special";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: FRANCE_TIMEZONE, weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FRANCE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: FRANCE_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function advisoryRisk(date: string, lastDeparture: number, selectedTime?: string) {
  const now = new Date();
  const queryMinutes = date === localDate(now)
    ? selectedTime && /^\d{2}:\d{2}$/.test(selectedTime)
      ? Number(selectedTime.slice(0, 2)) * 60 + Number(selectedTime.slice(3))
      : localMinutes(now)
    : date > localDate(now) ? 0 : 24 * 60;
  const minutesToLastDeparture = lastDeparture - queryMinutes;
  const risk = serviceDayRisk(minutesToLastDeparture);
  return { risk, minutesToLastDeparture } as const;
}

function buildUnavailable(date: string, note: string, feed?: GtfsFeed): ServiceDayAdvisory {
  return {
    coverage: "unavailable",
    serviceDate: date,
    timezone: FRANCE_TIMEZONE,
    serviceDayType: serviceDayType(feed, date),
    risk: "unavailable",
    source: "SNCF Open Data GTFS",
    sourceUrl: FRANCE_GTFS_URL,
    checkedAt: new Date().toISOString(),
    note,
  };
}

function routeKey(origin: string, destination: string) {
  return `${normalizeStation(origin)}->${normalizeStation(destination)}`;
}

function loadArtifact(): FranceServiceDayArtifact | null {
  if (artifactCache !== undefined) return artifactCache;
  if (!existsSync(ARTIFACT_PATH)) {
    artifactCache = null;
    return artifactCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as FranceServiceDayArtifact;
    if (parsed.schemaVersion !== 1 || parsed.country !== "france" || !parsed.routes || !parsed.validFrom || !parsed.validTo) {
      throw new Error("SNCF service-day artifact failed schema validation.");
    }
    for (const dates of Object.values(parsed.routes)) {
      for (const [date, advisory] of Object.entries(dates)) {
        const normalized = validateServiceDayAdvisory(advisory);
        if (normalized.serviceDate !== date) throw new Error("SNCF service-day artifact date does not match its advisory.");
      }
    }
    artifactCache = parsed;
    return parsed;
  } catch (error) {
    void recordError({
      severity: "warning",
      module: "france-gtfs",
      operation: "service-day.artifact-read",
      errorCode: "SNCF_GTFS_ARTIFACT_INVALID",
      error,
      country: "france",
      provider: FRANCE_GTFS_URL,
      context: { path: ARTIFACT_PATH },
    });
    artifactCache = null;
    return null;
  }
}

function collectJourneys(feed: GtfsFeed, origin: string, destination: string, date: string): GtfsJourney[] {
  return collectGtfsJourneys(feed, origin, destination, date, FRANCE_STATION_MATCH);
}

function calculateAdvisory(feed: GtfsFeed, origin: string, destination: string, date: string, selectedTime?: string): ServiceDayAdvisory {
  const journeys = collectJourneys(feed, origin, destination, date);
  if (journeys.length === 0) return buildUnavailable(date, "SNCF did not publish a service for this station pair on the selected date.", feed);
  const firstDeparture = journeys[0].departure;
  const lastDeparture = journeys[journeys.length - 1].departure;
  const { risk, minutesToLastDeparture } = advisoryRisk(date, lastDeparture, selectedTime);
  return {
    coverage: "supported",
    serviceDate: date,
    timezone: FRANCE_TIMEZONE,
    serviceDayType: serviceDayType(feed, date),
    firstDeparture: formatGtfsExtendedMinutes(firstDeparture),
    lastDeparture: formatGtfsExtendedMinutes(lastDeparture),
    risk,
    minutesToLastDeparture,
    source: "SNCF Open Data GTFS",
    sourceUrl: FRANCE_GTFS_URL,
    updatedAt: feed.sourceUpdatedAt,
    checkedAt: new Date().toISOString(),
  };
}

export async function getFranceServiceDayAdvisory(
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): Promise<ServiceDayAdvisory> {
  const artifact = loadArtifact();
  const artifactAdvisory = artifact?.routes[routeKey(origin, destination)]?.[date];
  if (artifactAdvisory) return withSelectedQueryRisk(withArtifactFreshness(artifactAdvisory, artifact?.retrievedAt), selectedTime);
  // Journey search is deliberately artifact-only. The scheduled France
  // scraper owns GTFS retrieval and atomic publication; a missing artifact is
  // unavailable coverage, not permission to fetch an upstream feed per user.
  return buildUnavailable(date, "SNCF service-day information is not available from the latest scheduled artifact.");
}

/**
 * GTFS extended route types → the service brand a French passenger recognises.
 * Uses only the spec's own classification, not a guess keyed on route ids.
 */
const SERVICE_BY_ROUTE_TYPE: Record<number, string> = {
  2: "Train", 100: "Train", 101: "TGV", 102: "Intercités", 103: "Intercités",
  105: "Intercités de Nuit", 106: "TER", 107: "Train", 109: "RER", 110: "Train",
  3: "Autocar", 200: "Autocar", 700: "Autocar", 715: "Autocar", 800: "Autocar",
};

/**
 * What to print in the Service column.
 *
 * The real feed puts an internal route code in route_short_name ("601A", "K7")
 * and the train number in trip_headsign ("6607") — the reverse of what the
 * names suggest, and the reason an earlier version of this page advertised
 * "trains on 601A, 601B". route_type is the field that actually classifies the
 * service, so the label is brand + number: "TGV 6607". serviceFamily() in the
 * page generator strips the trailing number, so the summary groups by brand.
 */
function serviceLabel(feed: GtfsFeed, journey: GtfsJourney): string {
  const route = journey.routeId ? feed.routes.get(journey.routeId) : undefined;
  const brand = route?.routeType !== undefined ? SERVICE_BY_ROUTE_TYPE[route.routeType] : undefined;
  const trainNumber = journey.headsign && /^\d+$/.test(journey.headsign.trim())
    ? journey.headsign.trim()
    : undefined;
  if (brand && trainNumber) return `${brand} ${trainNumber}`;
  if (brand) return brand;
  if (trainNumber) return `Train ${trainNumber}`;
  return route?.shortName || route?.longName || "Train";
}

/**
 * Real departures for a France route on a given date, straight from the SNCF
 * GTFS calendar — the same feed the service-day advisory already downloads.
 *
 * Shaped for ProviderBackedScraper, so a failed download or a date the feed
 * does not cover falls back to the curated snapshot rather than failing the
 * scrape. No fare is emitted: SNCF's GTFS ships no fare_attributes, and an
 * invented price is exactly what this replaces.
 */
export async function searchFranceGtfs(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  let feed: GtfsFeed;
  try {
    feed = await loadFeed();
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "SNCF_GTFS_UNAVAILABLE",
        message: error instanceof Error ? error.message : "SNCF GTFS download failed.",
        results: [],
        source: FRANCE_GTFS_URL,
      },
    };
  }

  const journeys = collectJourneys(feed, origin, destination, date);
  if (journeys.length === 0) {
    return {
      status: 404,
      body: {
        error: "NO_SERVICE",
        message: `SNCF published no ${origin} → ${destination} service for ${date}.`,
        results: [],
        source: "SNCF Open Data GTFS",
      },
    };
  }

  const results = buildGtfsTimetable(feed, journeys, {
    idPrefix: "fr",
    country: "france",
    operator: "SNCF",
    origin,
    destination,
    serviceLabel,
    // Only a real headsign, i.e. the destination shown on the train. A numeric
    // trip_headsign is the train number and has already gone into `service`.
    headsign: (journey) => (
      journey.headsign && !/^\d+$/.test(journey.headsign.trim())
        ? journey.headsign.trim()
        : undefined
    ),
  });

  return { status: 200, body: { results, source: "SNCF Open Data GTFS" } };
}

/** Collect and atomically publish the route/date artifact used by scheduled scrapes. */
export async function collectFranceServiceDayArtifact(
  routes: Array<{ origin: string; destination: string }>,
  date: string,
): Promise<FranceServiceDayArtifact> {
  const feed = await loadFeed();
  const existing = loadArtifact();
  const artifact: FranceServiceDayArtifact = existing
    ? { ...existing, routes: Object.fromEntries(Object.entries(existing.routes).map(([key, dates]) => [key, { ...dates }])) }
    : {
      schemaVersion: 1,
      country: "france",
      source: "SNCF Open Data GTFS",
      sourceUrl: FRANCE_GTFS_URL,
      timezone: FRANCE_TIMEZONE,
      retrievedAt: new Date().toISOString(),
      sourceUpdatedAt: feed.sourceUpdatedAt,
      validFrom: date,
      validTo: date,
      routes: {},
    };
  artifact.retrievedAt = new Date().toISOString();
  artifact.sourceUpdatedAt = feed.sourceUpdatedAt || artifact.sourceUpdatedAt;
  artifact.validFrom = artifact.validFrom < date ? artifact.validFrom : date;
  artifact.validTo = artifact.validTo > date ? artifact.validTo : date;
  let collectedRoutes = 0;
  for (const route of routes) {
    const key = routeKey(route.origin, route.destination);
    const advisory = validateServiceDayAdvisory(calculateAdvisory(feed, route.origin, route.destination, date));
    if (advisory.coverage !== "supported") {
      await recordError({
        severity: "warning",
        module: "france-gtfs",
        operation: "service-day.route",
        errorCode: "SNCF_GTFS_ROUTE_UNAVAILABLE",
        message: `SNCF GTFS has no complete service for ${route.origin} → ${route.destination} on ${date}.`,
        country: "france",
        provider: FRANCE_GTFS_URL,
        context: { origin: route.origin, destination: route.destination, date },
      });
      continue;
    }
    artifact.routes[key] = { ...(artifact.routes[key] || {}), [date]: advisory };
    collectedRoutes += 1;
  }
  if (collectedRoutes === 0) throw new Error(`SNCF GTFS collected no complete service routes for ${date}.`);
  const tempPath = `${ARTIFACT_PATH}.${process.pid}.tmp`;
  mkdirSync(resolve(ARTIFACT_PATH, ".."), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(tempPath, ARTIFACT_PATH);
  artifactCache = artifact;
  return artifact;
}

export function resetFranceGtfsCache() {
  franceFeedSource.reset();
  artifactCache = undefined;
}

export function resetFranceGtfsFeedCache() {
  franceFeedSource.reset();
}
