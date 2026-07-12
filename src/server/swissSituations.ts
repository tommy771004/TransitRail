import { XMLParser } from "fast-xml-parser";

// Live disruption overlay for Switzerland, backed by the OTDS LA-SIRI-SX-UNPLANNED
// feed (high-priority unplanned incidents). The full planned SIRI-SX feed is ~96 MB
// and must be cached out-of-band; the unplanned feed is ~0.2 MB, so we fetch it on
// demand and cache it in-process with a short TTL, then surface only situations that
// affect a station on the searched route.

const SX_UNPLANNED_URL =
  process.env.SWISS_SIRI_SX_UNPLANNED_URL || "https://api.opentransportdata.swiss/la/siri-sx-unplanned";
const CACHE_TTL_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export interface SwissSituation {
  summary: string;
  cause?: string;
  severity?: string;
  stopNames: string[];
  validFrom?: number;
  validTo?: number;
}

let cache: { at: number; situations: SwissSituation[] } | null = null;
let inflight: Promise<SwissSituation[]> | null = null;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return textValue(record.Text) || textValue(record["#text"]) || textValue(record.value);
}

function collect(node: unknown, key: string): unknown[] {
  const out: unknown[] = [];
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      if (k === key) out.push(v);
      visit(v);
    }
  };
  visit(node);
  return out;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bearerHeaders(token: string) {
  return {
    Accept: "application/xml",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/xml",
    "User-Agent": "TransitRail/1.0",
  };
}

function situationRequest(): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const ref = process.env.SWISS_OJP_REQUESTOR_REF || "TransitRail_prod";
  return `<?xml version="1.0" encoding="UTF-8"?><Siri xmlns="http://www.siri.org.uk/siri" version="2.0"><ServiceRequest><RequestTimestamp>${now}</RequestTimestamp><RequestorRef>${ref}</RequestorRef><SituationExchangeRequest version="2.0"><RequestTimestamp>${now}</RequestTimestamp></SituationExchangeRequest></ServiceRequest></Siri>`;
}

async function fetchSituations(): Promise<SwissSituation[]> {
  const token = process.env.SWISS_SIRI_SX_UNPLANNED_TOKEN;
  if (!token) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(SX_UNPLANNED_URL, {
      method: "POST",
      headers: bearerHeaders(token),
      body: situationRequest(),
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const parsed = parser.parse(await response.text());
    return collect(parsed, "PtSituationElement")
      .flatMap((entry) => asArray(entry))
      .map((element): SwissSituation | undefined => {
        const summary = textValue(collect(element, "Summary")[0]);
        if (!summary) return undefined;
        const stopNames = Array.from(
          new Set(
            collect(element, "AffectedStopPlace")
              .flatMap((stop) => asArray(stop))
              .map((stop) => textValue((stop as Record<string, unknown>).PlaceName))
              .filter((name): name is string => Boolean(name)),
          ),
        );
        const window = collect(element, "PublicationWindow")[0] as Record<string, unknown> | undefined;
        const start = window?.StartTime ? Date.parse(textValue(window.StartTime) || "") : NaN;
        const end = window?.EndTime ? Date.parse(textValue(window.EndTime) || "") : NaN;
        return {
          summary,
          cause: textValue(collect(element, "AlertCause")[0]),
          severity: textValue(collect(element, "Severity")[0]),
          stopNames,
          validFrom: Number.isFinite(start) ? start : undefined,
          validTo: Number.isFinite(end) ? end : undefined,
        };
      })
      .filter((situation): situation is SwissSituation => Boolean(situation));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function getSituations(): Promise<SwissSituation[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.situations;
  if (inflight) return inflight;
  inflight = fetchSituations()
    .then((situations) => {
      cache = { at: Date.now(), situations };
      inflight = null;
      return situations;
    })
    .catch(() => {
      inflight = null;
      return cache?.situations ?? [];
    });
  return inflight;
}

/** Returns all current Swiss unplanned situations for the country-wide alerts wall. */
export async function getSwissSituations(): Promise<SwissSituation[]> {
  const now = Date.now();
  return (await getSituations()).filter((situation) =>
    (!situation.validFrom || situation.validFrom <= now)
    && (!situation.validTo || situation.validTo >= now),
  );
}

/**
 * Returns the summary of a currently-valid unplanned disruption that affects one of
 * the given route stations, or undefined when the route is clear. Never throws — a
 * feed failure simply yields no warning.
 */
export async function getSwissRouteWarning(stationNames: string[]): Promise<string | undefined> {
  const situations = await getSwissSituations();
  if (situations.length === 0) return undefined;

  const routeKeys = new Set(stationNames.map(normalize).filter(Boolean));
  if (routeKeys.size === 0) return undefined;

  for (const situation of situations) {
    if (situation.stopNames.some((name) => routeKeys.has(normalize(name)))) {
      return situation.summary;
    }
  }
  return undefined;
}
