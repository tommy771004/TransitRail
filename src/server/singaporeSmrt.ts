import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceDayAdvisory, ServiceDayType } from "../types";
import { serviceDayRisk, validateServiceDayAdvisory, withArtifactFreshness, withSelectedQueryRisk } from "../data/serviceDayAdvisory";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type TrainTime = {
  last_trains?: string;
  first_trains?: { weekday?: string; sat?: string; sun_public_holiday?: string };
  station_line?: string;
  description?: string;
};
export type SmrtStationPayload = { results?: Array<{ name?: string; train_times?: TrainTime[] }> };

const SOURCE = "SMRT official station information API";
const SOURCE_URL = "https://journey.smrt.com.sg/";
const API = "https://connect.smrt.wwprojects.com/smrt/api/station_info/";
const TIMEZONE = "Asia/Singapore";
const ARTIFACT_PATH = resolve(process.cwd(), "src/data/service-day/singapore.json");

const ROUTES: Record<string, { slug: string; line: string; terminus: string }> = {
  "changi airport->jurong east": { slug: "Changi Airport", line: "East-West Line", terminus: "Tuas Link" },
  "jurong east->raffles place": { slug: "Jurong East", line: "East-West Line", terminus: "Pasir Ris" },
  "woodlands->orchard": { slug: "Woodlands", line: "North-South Line", terminus: "Marina South Pier" },
};

export type SingaporeServiceDayArtifact = {
  schemaVersion: 1;
  country: "singapore";
  source: typeof SOURCE;
  sourceUrl: typeof SOURCE_URL;
  timezone: typeof TIMEZONE;
  retrievedAt: string;
  validFrom: string;
  validTo: string;
  routes: Record<string, Record<string, ServiceDayAdvisory>>;
};

let artifactCache: SingaporeServiceDayArtifact | null | undefined;
const stationFetchCache = new Map<string, Promise<SmrtStationPayload>>();

function key(origin: string, destination: string) {
  return `${origin.toLowerCase().trim()}->${destination.toLowerCase().trim()}`;
}

function dayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" })
    .format(new Date(`${date}T12:00:00+08:00`));
  return weekday === "Saturday" ? "saturday" : weekday === "Sunday" ? "sunday_holiday" : "weekday";
}

function clock(value: string | undefined): string | undefined {
  const digits = value?.replace(/:/g, "");
  return /^\d{4}$/.test(digits ?? "") ? `${digits!.slice(0, 2)}:${digits!.slice(2)}` : undefined;
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

export function buildSingaporeSmrtAdvisory(
  payload: SmrtStationPayload,
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): ServiceDayAdvisory {
  const route = ROUTES[key(origin, destination)];
  if (!route) return unavailable(date, "This route is not covered by the official SMRT station feed; no train times were inferred.");
  const station = payload.results?.find((candidate) => candidate.name?.toLowerCase() === origin.toLowerCase());
  const row = station?.train_times?.find((candidate) =>
    candidate.station_line === route.line && candidate.description?.includes(route.terminus));
  const type = dayType(date);
  const firstKey = type === "weekday" ? "weekday" : type === "saturday" ? "sat" : "sun_public_holiday";
  const firstDeparture = clock(row?.first_trains?.[firstKey]);
  const lastDeparture = clock(row?.last_trains);
  if (!firstDeparture || !lastDeparture) return unavailable(date, "SMRT did not publish a complete direction-specific first/last value for this route.");
  const advisory = validateServiceDayAdvisory({
    coverage: "partial",
    serviceDate: date,
    timezone: TIMEZONE,
    serviceDayType: type,
    firstDeparture,
    lastDeparture,
    risk: serviceDayRisk(24 * 60),
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    checkedAt: new Date().toISOString(),
    note: "SMRT publishes direction-specific first and last trains, not a complete departure timetable.",
  });
  return withSelectedQueryRisk(advisory, selectedTime);
}

export async function fetchSingaporeSmrtStation(slug: string, fetcher: Fetcher = fetch): Promise<SmrtStationPayload> {
  const response = await fetcher(`${API}?name=${encodeURIComponent(slug)}`, {
    headers: {
      Referer: SOURCE_URL,
      Origin: "https://journey.smrt.com.sg",
      "user-agent": "TransitRail scheduled service-day collector",
    },
  });
  if (!response.ok) throw new Error(`SMRT returned HTTP ${response.status}.`);
  const payload = await response.json() as SmrtStationPayload;
  if (!Array.isArray(payload.results) || !payload.results[0]?.train_times) throw new Error("SMRT returned malformed station JSON.");
  return payload;
}

function loadArtifact(): SingaporeServiceDayArtifact | null {
  if (artifactCache !== undefined) return artifactCache;
  if (!existsSync(ARTIFACT_PATH)) return artifactCache = null;
  try {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as SingaporeServiceDayArtifact;
    if (artifact.schemaVersion !== 1 || artifact.country !== "singapore" || !artifact.routes) throw new Error("Invalid Singapore artifact.");
    for (const dates of Object.values(artifact.routes)) for (const advisory of Object.values(dates)) validateServiceDayAdvisory(advisory);
    return artifactCache = artifact;
  } catch {
    return artifactCache = null;
  }
}

export async function getSingaporeServiceDayAdvisory(
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
): Promise<ServiceDayAdvisory> {
  const artifact = loadArtifact();
  const advisory = artifact?.routes[key(origin, destination)]?.[date];
  if (!advisory) return unavailable(date, ROUTES[key(origin, destination)]
    ? "SMRT service-day information is not available from the latest scheduled artifact."
    : "This route is not covered by the official SMRT station feed; no train times were inferred.");
  return withSelectedQueryRisk(withArtifactFreshness(advisory, artifact.retrievedAt), selectedTime);
}

export async function collectSingaporeServiceDayArtifact(
  routes: Array<{ origin: string; destination: string }>,
  date: string,
  fetcher: Fetcher = fetch,
): Promise<SingaporeServiceDayArtifact> {
  const existing = loadArtifact();
  const artifact: SingaporeServiceDayArtifact = existing || {
    schemaVersion: 1,
    country: "singapore",
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
    let promise = stationFetchCache.get(route.slug);
    if (!promise) {
      promise = fetchSingaporeSmrtStation(route.slug, fetcher);
      stationFetchCache.set(route.slug, promise);
    }
    const advisory = buildSingaporeSmrtAdvisory(await promise, requested.origin, requested.destination, date);
    if (advisory.coverage === "unavailable") throw new Error(advisory.note);
    const routeKey = key(requested.origin, requested.destination);
    artifact.routes[routeKey] = { ...(artifact.routes[routeKey] || {}), [date]: advisory };
    collected += 1;
  }
  if (collected === 0) throw new Error("No supported Singapore SMRT route was collected.");
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

export function resetSingaporeSmrtCache() {
  artifactCache = undefined;
  stationFetchCache.clear();
}
