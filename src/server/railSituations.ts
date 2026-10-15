// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Service disruptions from the official feeds of markets that publish
// them without a key: SNCB-NMBS via iRail, Toei (and Tokyo Metro with ODPT_API_KEY)
// via ODPT, and the Norwegian rail operators via Entur. Each parser keeps only what
// the feed states; a quiet feed yields nothing rather than an "all clear" row.

import type { TransitSituation } from "../types";

const IRAIL_DISTURBANCES_URL = "https://api.irail.be/v1/disturbances/?format=json&lang=en";
const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";
const ENTUR_CLIENT_NAME = process.env.ENTUR_CLIENT_NAME || "transitrail-timetable";
/** The operators whose trains the Norway search returns. */
const ENTUR_RAIL_AUTHORITIES = ["VYG:Authority:VY", "GOA:Authority:GOA", "SJN:Authority:SJN", "FLT:Authority:FLT"];
/** Planned works further out than this are not yet news for a traveller. */
const UPCOMING_WINDOW_MS = 7 * 86_400_000;

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", "User-Agent": "TransitRail/1.0", ...(init.headers || {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Belgium ---

interface IrailDisturbance {
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  timestamp?: string;
}

/** Live disturbances read as minor; planned works and restored service as information. */
export function parseIrailDisturbances(payload: { disturbance?: IrailDisturbance[] }): TransitSituation[] {
  return (payload.disturbance || []).flatMap((item, index) => {
    const title = item.title?.trim();
    if (!title) return [];
    const seconds = Number(item.timestamp);
    return [{
      id: `be-${item.type || "notice"}-${item.timestamp || index}-${title}`,
      country: "belgium" as const,
      title,
      description: item.description?.replace(/\n{3,}/g, "\n\n").trim() || undefined,
      severity: item.type === "planned" || /situation restored/i.test(title) ? "info" as const : "minor" as const,
      updatedAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined,
      source: "SNCB-NMBS",
    }];
  });
}

export async function getBelgiumSituations(): Promise<TransitSituation[]> {
  return parseIrailDisturbances(await fetchJson(IRAIL_DISTURBANCES_URL));
}

// --- Japan (ODPT) ---

interface OdptTrainInformation {
  "dc:date"?: string;
  "odpt:railway"?: string;
  "odpt:trainInformationStatus"?: Record<string, string>;
  "odpt:trainInformationText"?: Record<string, string>;
}

const ODPT_RAILWAY_NAMES: Record<string, string> = {
  "Toei.Asakusa": "都営浅草線",
  "Toei.Mita": "都営三田線",
  "Toei.Shinjuku": "都営新宿線",
  "Toei.Oedo": "都営大江戸線",
  "Toei.Arakawa": "都電荒川線",
  "Toei.NipporiToneri": "日暮里・舎人ライナー",
  "TokyoMetro.Ginza": "東京メトロ銀座線",
  "TokyoMetro.Marunouchi": "東京メトロ丸ノ内線",
  "TokyoMetro.MarunouchiBranch": "東京メトロ丸ノ内線（分岐線）",
  "TokyoMetro.Hibiya": "東京メトロ日比谷線",
  "TokyoMetro.Tozai": "東京メトロ東西線",
  "TokyoMetro.Chiyoda": "東京メトロ千代田線",
  "TokyoMetro.Yurakucho": "東京メトロ有楽町線",
  "TokyoMetro.Hanzomon": "東京メトロ半蔵門線",
  "TokyoMetro.Namboku": "東京メトロ南北線",
  "TokyoMetro.Fukutoshin": "東京メトロ副都心線",
};

/**
 * ODPT leaves `trainInformationStatus` out while a line runs normally, so
 * only lines that carry one are disruptions. The operator's own text is kept
 * as written.
 */
export function parseOdptTrainInformation(items: OdptTrainInformation[]): TransitSituation[] {
  return items.flatMap((item) => {
    const status = item["odpt:trainInformationStatus"];
    const statusText = status?.ja || status?.en;
    const railway = item["odpt:railway"]?.replace(/^odpt\.Railway:/, "");
    if (!statusText || !railway) return [];
    const text = item["odpt:trainInformationText"];
    return [{
      id: `jp-${railway}-${item["dc:date"] || statusText}`,
      country: "japan" as const,
      title: `${ODPT_RAILWAY_NAMES[railway] || railway}：${statusText}`,
      description: text?.ja || text?.en,
      severity: /運転見合わせ|運休|suspend/i.test(statusText) ? "major" as const : "minor" as const,
      updatedAt: item["dc:date"],
      source: railway.startsWith("Toei.") ? "東京都交通局" : "東京メトロ",
    }];
  });
}

export async function getJapanSituations(): Promise<TransitSituation[]> {
  const urls = ["https://api-public.odpt.org/api/v4/odpt:TrainInformation?odpt:operator=odpt.Operator:Toei"];
  const key = process.env.ODPT_API_KEY;
  if (key) {
    const metro = new URL("https://api.odpt.org/api/v4/odpt:TrainInformation");
    metro.searchParams.set("odpt:operator", "odpt.Operator:TokyoMetro");
    metro.searchParams.set("acl:consumerKey", key);
    urls.push(metro.toString());
  }
  const feeds = await Promise.allSettled(urls.map((url) => fetchJson<OdptTrainInformation[]>(url)));
  if (feeds.every((feed) => feed.status === "rejected")) throw new Error("ODPT train information unavailable");
  return feeds.flatMap((feed) => (feed.status === "fulfilled" && Array.isArray(feed.value) ? parseOdptTrainInformation(feed.value) : []));
}

// --- Norway (Entur) ---

interface EnturText { value?: string; language?: string }
interface EnturSituation {
  id?: string;
  summary?: EnturText[];
  description?: EnturText[];
  severity?: string;
  validityPeriod?: { startTime?: string; endTime?: string };
}

function preferredText(texts: EnturText[] | undefined) {
  const usable = (texts || []).filter((text) => text.value?.trim());
  return (usable.find((text) => text.language === "en") || usable[0])?.value?.trim();
}

/** Current situations, and planned ones starting within the week. */
export function parseEnturSituations(situations: EnturSituation[], now = new Date()): TransitSituation[] {
  const at = now.getTime();
  return situations.flatMap((situation, index) => {
    const title = preferredText(situation.summary);
    if (!title) return [];
    const start = Date.parse(situation.validityPeriod?.startTime || "");
    const end = Date.parse(situation.validityPeriod?.endTime || "");
    if (Number.isFinite(end) && end < at) return [];
    if (Number.isFinite(start) && start > at + UPCOMING_WINDOW_MS) return [];
    const severity = situation.severity === "severe" || situation.severity === "verySevere"
      ? "major" as const
      : situation.severity === "noImpact" ? "info" as const : "minor" as const;
    return [{
      id: `no-${situation.id || index}`,
      country: "norway" as const,
      title,
      description: preferredText(situation.description),
      severity,
      updatedAt: situation.validityPeriod?.startTime,
      source: "Entur",
    }];
  });
}

export async function getNorwaySituations(now = new Date()): Promise<TransitSituation[]> {
  const query = `{ situations(authorities: ${JSON.stringify(ENTUR_RAIL_AUTHORITIES)}) {
    id summary { value language } description { value language } severity validityPeriod { startTime endTime }
  } }`;
  const payload = await fetchJson<{ data?: { situations?: EnturSituation[] }; errors?: unknown[] }>(ENTUR_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ET-Client-Name": ENTUR_CLIENT_NAME },
    body: JSON.stringify({ query }),
  });
  if (payload.errors?.length) throw new Error("Entur rejected the situations query");
  return parseEnturSituations(payload.data?.situations || [], now);
}

// --- End of railSituations.ts ---
