import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceDayAdvisory, ServiceDayType } from "../types";
import { recordError } from "./errorLog";
import { serviceDayRisk, validateServiceDayAdvisory, withArtifactFreshness, withSelectedQueryRisk } from "../data/serviceDayAdvisory";

export const THAILAND_BEM_URL = "https://metro.bemplc.co.th/Fare-Calculation?lang=en";
const THAILAND_TIMEZONE = "Asia/Bangkok";
const ARTIFACT_PATH = resolve(process.cwd(), "src/data/service-day/thailand.json");

type BemPage = {
  serviceDate: string;
  routeLabels: string[];
  rows: Array<{ station: string; times: string[] }>;
};

export type ThailandServiceDayArtifact = {
  schemaVersion: 1;
  country: "thailand";
  source: "BEM MRT official HTML";
  sourceUrl: string;
  timezone: typeof THAILAND_TIMEZONE;
  retrievedAt: string;
  sourceUpdatedAt?: string;
  validFrom: string;
  validTo: string;
  routes: Record<string, Record<string, ServiceDayAdvisory>>;
};

let artifactCache: ThailandServiceDayArtifact | null | undefined;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cellText(value: string) {
  return decodeEntities(value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStation(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDate(value: string): string | undefined {
  const match = /(\d{2})-(\d{2})-(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function attr(attrs: string, name: string) {
  return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(attrs)?.[1];
}

function parseBemPage(html: string): BemPage | null {
  const title = [...html.matchAll(/<h2[^>]*class=["'][^"']*modal-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match) => match[1])
    .find((value) => /First\s*-\s*Last\s+Train/i.test(cellText(value)))
    || /First\s*-\s*Last\s+Train[^<]*/i.exec(html)?.[0];
  const serviceDate = title ? parseDate(cellText(title)) : undefined;
  if (!serviceDate) return null;

  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => /First\s*-?\s*Last\s+Train/i.test(cellText(candidate)) && /Station\s+ID/i.test(cellText(candidate)));
  if (!table) return null;
  const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const routeLabels = [...(rows[1] || "").matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)]
    .filter((match) => attr(match[1], "colspan") === "2")
    .map((match) => cellText(match[2]).replace(/^Route\s*/i, "").trim());
  if (routeLabels.length === 0) return null;

  const parsedRows = rows.slice(3).map((row) => ({
    cells: [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cellText(match[1])),
  }))
    .filter(({ cells }) => cells.length >= 2)
    .map(({ cells }) => ({ station: cells[1], times: cells.slice(2) }));
  return { serviceDate, routeLabels, rows: parsedRows };
}

function serviceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: THAILAND_TIMEZONE, weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: THAILAND_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: THAILAND_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function riskFor(date: string, lastDeparture: string, selectedTime?: string) {
  const [hour, minute] = lastDeparture.split(":").map(Number);
  const lastMinutes = hour * 60 + minute;
  const now = new Date();
  const today = localDate(now);
  const queryMinutes = date === today
    ? selectedTime && /^\d{2}:\d{2}$/.test(selectedTime)
      ? Number(selectedTime.slice(0, 2)) * 60 + Number(selectedTime.slice(3))
      : localMinutes(now)
    : date > today ? 0 : 24 * 60;
  const minutesToLastDeparture = lastMinutes - queryMinutes;
  const risk = serviceDayRisk(minutesToLastDeparture);
  return { risk, minutesToLastDeparture } as const;
}

function routeKey(origin: string, destination: string) {
  return `${normalizeStation(origin)}->${normalizeStation(destination)}`;
}

function unavailable(date: string, note: string): ServiceDayAdvisory {
  return {
    coverage: "unavailable",
    serviceDate: date,
    timezone: THAILAND_TIMEZONE,
    serviceDayType: serviceDayType(date),
    risk: "unavailable",
    source: "BEM MRT official HTML",
    sourceUrl: THAILAND_BEM_URL,
    checkedAt: new Date().toISOString(),
    note,
  };
}

function advisoryFromHtml(
  html: string,
  origin: string,
  destination: string,
  date: string,
  selectedTime?: string,
  updatedAt?: string,
): ServiceDayAdvisory {
  const page = parseBemPage(html);
  if (!page) return unavailable(date, "BEM did not publish a readable first/last train table.");
  if (page.serviceDate !== date) {
    return unavailable(date, `BEM currently publishes first/last train information for ${page.serviceDate}.`);
  }
  const destinationKey = normalizeStation(destination);
  const directionIndex = page.routeLabels.findIndex((label) => normalizeStation(label).includes(destinationKey));
  const row = page.rows.find((candidate) => normalizeStation(candidate.station) === normalizeStation(origin));
  const first = directionIndex >= 0 ? page.rows.length > 0 ? row?.times[directionIndex * 2] : undefined : undefined;
  const last = directionIndex >= 0 ? row?.times[directionIndex * 2 + 1] : undefined;
  if (!first || !last || !/^\d{1,2}:\d{2}$/.test(first) || !/^\d{1,2}:\d{2}$/.test(last) || first === "-" || last === "-") {
    return unavailable(date, "BEM does not publish a complete direction-specific value for this station pair.");
  }
  const formattedFirst = first.padStart(5, "0");
  const formattedLast = last.padStart(5, "0");
  const { risk, minutesToLastDeparture } = riskFor(date, formattedLast, selectedTime);
  return {
    coverage: "partial",
    serviceDate: date,
    timezone: THAILAND_TIMEZONE,
    serviceDayType: serviceDayType(date),
    firstDeparture: formattedFirst,
    lastDeparture: formattedLast,
    risk,
    minutesToLastDeparture,
    source: "BEM MRT official HTML",
    sourceUrl: THAILAND_BEM_URL,
    updatedAt,
    checkedAt: new Date().toISOString(),
    note: "BEM publishes station-and-direction first/last times; confirm the complete journey and any transfer with the operator.",
  };
}

function loadArtifact(): ThailandServiceDayArtifact | null {
  if (artifactCache !== undefined) return artifactCache;
  if (!existsSync(ARTIFACT_PATH)) {
    artifactCache = null;
    return artifactCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ThailandServiceDayArtifact;
    if (parsed.schemaVersion !== 1 || parsed.country !== "thailand" || !parsed.routes || !parsed.validFrom || !parsed.validTo) throw new Error("Thailand service-day artifact failed schema validation.");
    for (const dates of Object.values(parsed.routes)) {
      for (const [date, advisory] of Object.entries(dates)) {
        const normalized = validateServiceDayAdvisory(advisory);
        if (normalized.serviceDate !== date) throw new Error("Thailand service-day artifact date does not match its advisory.");
      }
    }
    artifactCache = parsed;
    return parsed;
  } catch (error) {
    void recordError({ severity: "warning", module: "thailand-bem", operation: "service-day.artifact-read", errorCode: "BEM_ARTIFACT_INVALID", error, country: "thailand", provider: THAILAND_BEM_URL });
    artifactCache = null;
    return null;
  }
}

export async function getThailandServiceDayAdvisory(origin: string, destination: string, date: string, selectedTime?: string): Promise<ServiceDayAdvisory> {
  const artifact = loadArtifact();
  const cachedArtifact = artifact?.routes[routeKey(origin, destination)]?.[date];
  if (cachedArtifact) return withSelectedQueryRisk(withArtifactFreshness(cachedArtifact, artifact?.retrievedAt), selectedTime);
  if (routeKey(origin, destination) !== "sukhumvit->hua lamphong") {
    return unavailable(date, "The official BEM page currently covers only the Blue Line Sukhumvit → Hua Lamphong direction; this route is not covered.");
  }
  // Journey search is deliberately artifact-only. Playwright retrieval is
  // owned by the scheduled Thailand scraper, not by a traveler request.
  return unavailable(date, "BEM service-day information is not available from the latest scheduled artifact.");
}

export async function collectThailandServiceDayArtifact(
  html: string,
  routes: Array<{ origin: string; destination: string }>,
  date: string,
  sourceUpdatedAt?: string,
): Promise<ThailandServiceDayArtifact> {
  const existing = loadArtifact();
  const artifact: ThailandServiceDayArtifact = existing || {
    schemaVersion: 1,
    country: "thailand",
    source: "BEM MRT official HTML",
    sourceUrl: THAILAND_BEM_URL,
    timezone: THAILAND_TIMEZONE,
    retrievedAt: new Date().toISOString(),
    sourceUpdatedAt,
    validFrom: date,
    validTo: date,
    routes: {},
  };
  for (const route of routes) {
    if (normalizeStation(route.origin) !== "sukhumvit" || normalizeStation(route.destination) !== "hua lamphong") continue;
    const advisory = validateServiceDayAdvisory(advisoryFromHtml(html, route.origin, route.destination, date, undefined, sourceUpdatedAt));
    if (advisory.coverage === "unavailable") throw new Error(`BEM has no complete direction value for ${route.origin} → ${route.destination}.`);
    const key = routeKey(route.origin, route.destination);
    artifact.routes[key] = { ...(artifact.routes[key] || {}), [date]: advisory };
  }
  if (Object.keys(artifact.routes).length === 0) throw new Error("No supported Thailand BEM route was collected.");
  artifact.retrievedAt = new Date().toISOString();
  artifact.sourceUpdatedAt = sourceUpdatedAt || artifact.sourceUpdatedAt;
  artifact.validFrom = artifact.validFrom < date ? artifact.validFrom : date;
  artifact.validTo = artifact.validTo > date ? artifact.validTo : date;
  mkdirSync(resolve(ARTIFACT_PATH, ".."), { recursive: true });
  const tempPath = `${ARTIFACT_PATH}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  renameSync(tempPath, ARTIFACT_PATH);
  artifactCache = artifact;
  return artifact;
}

export function resetThailandBemCache() {
  artifactCache = undefined;
}
