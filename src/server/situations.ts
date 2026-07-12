import type { Country, TransitSituation } from "../types";
import { getSwissSituations } from "./swissSituations";

const CACHE_TTL_MS = 2 * 60 * 1000;
let cache: { at: number; situations: TransitSituation[] } | undefined;
let inflight: Promise<TransitSituation[]> | undefined;

async function fetchJson<T>(url: URL, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "TransitRail/1.0", ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function getTflSituations(): Promise<TransitSituation[]> {
  const url = new URL("/Line/Mode/tube,dlr,overground,elizabeth-line/Status", "https://api.tfl.gov.uk");
  if (process.env.TFL_APP_KEY) url.searchParams.set("app_key", process.env.TFL_APP_KEY);
  const lines = await fetchJson<Array<{ id?: string; name?: string; lineStatuses?: Array<{ statusSeverity?: number; statusSeverityDescription?: string; reason?: string }> }>>(url);
  return lines.flatMap((line) => (line.lineStatuses || [])
    .filter((status) => typeof status.statusSeverity === "number" && status.statusSeverity < 10)
    .map((status, index) => ({
      id: `tfl-${line.id || line.name || index}-${status.statusSeverity}`,
      country: "united_kingdom" as const,
      title: `${line.name || "TfL"}: ${status.statusSeverityDescription || "Service change"}`,
      description: status.reason,
      severity: (status.statusSeverity ?? 10) <= 5 ? "major" as const : "minor" as const,
      source: "TfL Line Status",
    })));
}

async function getMbtaSituations(): Promise<TransitSituation[]> {
  const url = new URL("/alerts", "https://api-v3.mbta.com");
  url.searchParams.set("filter[activity]", "BOARD,EXIT,RIDE");
  url.searchParams.set("page[limit]", "50");
  const headers = process.env.MBTA_API_KEY ? { "x-api-key": process.env.MBTA_API_KEY } : {};
  const response = await fetchJson<{ data?: Array<{ id?: string; attributes?: { header?: string; description?: string; effect?: string; updated_at?: string; severity?: number } }> }>(url, headers);
  return (response.data || []).map((alert, index) => ({
    id: `mbta-${alert.id || index}`,
    country: "united_states" as const,
    title: alert.attributes?.header || alert.attributes?.effect || "MBTA service alert",
    description: alert.attributes?.description,
    severity: (alert.attributes?.severity ?? 0) >= 7 ? "major" as const : "minor" as const,
    updatedAt: alert.attributes?.updated_at,
    source: "MBTA Alerts",
  }));
}

async function loadSituations(): Promise<TransitSituation[]> {
  const [tfl, mbta, swiss] = await Promise.allSettled([getTflSituations(), getMbtaSituations(), getSwissSituations()]);
  return [
    ...(tfl.status === "fulfilled" ? tfl.value : []),
    ...(mbta.status === "fulfilled" ? mbta.value : []),
    ...(swiss.status === "fulfilled" ? swiss.value.map((situation, index) => ({
      id: `swiss-${index}-${situation.summary}`,
      country: "switzerland" as const,
      title: situation.summary,
      description: situation.cause,
      severity: situation.severity?.toLowerCase().includes("high") ? "major" as const : "minor" as const,
      updatedAt: situation.validFrom ? new Date(situation.validFrom).toISOString() : undefined,
      source: "Swiss OTD SIRI-SX",
    })) : []),
  ];
}

export async function getTransitSituations(country?: Country): Promise<TransitSituation[]> {
  const now = Date.now();
  if (!cache || now - cache.at >= CACHE_TTL_MS) {
    inflight ||= loadSituations().then((situations) => {
      cache = { at: Date.now(), situations };
      inflight = undefined;
      return situations;
    }).catch(() => {
      inflight = undefined;
      return cache?.situations || [];
    });
    await inflight;
  }
  return country ? (cache?.situations || []).filter((situation) => situation.country === country) : (cache?.situations || []);
}
