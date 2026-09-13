import type { Country, TransitResult } from "../types";
import { fareSources } from "../data/fareSources";
import { hongKongMtrLines } from "../data/hongKongMtr";
import { resolveStationAlias } from "../data/stationAliases";
import { stationSearchKey } from "../data/stationKey";

type Row = Record<string, string>;
export interface FareDocument {
  schemaVersion: 1;
  country: Country;
  observedOn: string;
  status: string;
  sources: Array<{ id?: string; url: string; effectiveFrom?: string; observedOn: string }>;
  stations?: Row[];
  rows?: Array<[string, string, number, number]>;
  stationNames?: Record<string, string>;
  tables?: Array<{ sourceId: string; family: string; title: string; rows: Array<[string, string, number, number | null]> }>;
  gtfs?: Record<string, Row[]>;
}
export interface OfficialFare {
  amount: number;
  currency: string;
  labelZh: string;
  labelEn: string;
  sourceUrl: string;
  publisher: string;
}

const key = (country: Country, value: string) => stationSearchKey(resolveStationAlias(country, value));
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const dateIso = (value: string) => value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");

function serviceDate(trip: TransitResult, now: Date): string {
  if (trip.date !== undefined) return trip.date;
  // Undated live results use the operator's local day, never the viewer's timezone.
  if (!trip.realtime) return "";
  const zones: Partial<Record<Country, string>> = { hong_kong: "Asia/Hong_Kong", korea: "Asia/Seoul", united_states: "America/New_York" };
  const zone = zones[trip.country];
  return zone ? new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now) : "";
}

function offer(trip: TransitResult, amount: number | undefined, currency: string, labelZh: string, labelEn: string): OfficialFare | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
  const source = fareSources[trip.country];
  return { amount, currency, labelZh, labelEn, sourceUrl: source.url, publisher: source.publisher };
}

function mtrFare(trip: TransitResult, doc: FareDocument): OfficialFare | null {
  // Airport Express, first class, inter-operator and transfer journeys need other rules.
  if (trip.operator !== "MTR" || trip.seatClass === "first") return null;
  const line = hongKongMtrLines.find(l => [l.name, l.code].includes(trip.service) && l.code !== "AEL");
  if (!line || trip.legs?.some(l => ![line.name, line.code].includes(l.lineName))) return null;
  const endpoint = (name: string) => {
    const k = key(trip.country, name);
    const ids = new Set(doc.stations?.filter(s => s["Line Code"] === line.code
      && [s["English Name"], s["Chinese Name"]].some(n => key(trip.country, n) === k)).map(s => s["Station ID"]));
    return ids.size === 1 ? [...ids][0] : undefined;
  };
  const origin = endpoint(trip.origin), destination = endpoint(trip.destination);
  if (!origin || !destination || origin === destination) return null;
  const rows = doc.rows?.filter(r => r[0] === origin && r[1] === destination) || [];
  return rows.length === 1 ? offer(trip, rows[0][3], "HKD", "成人・單程票・普通等", "Adult · Single Journey Ticket · Standard") : null;
}

function korailFare(trip: TransitResult, doc: FareDocument, date: string): OfficialFare | null {
  if (trip.operator !== "Korail") return null;
  const type = trip.trainType || "";
  const family = /^KTX(?:-|$)/i.test(type) ? "ktx"
    : /^(ITX[- ]?(?:새마을|마음|Saemaeul|Maum)|새마을(?:호)?|Saemaeul)$/i.test(type) ? "saemaeul"
    : /^(무궁화(?:호)?|누리로|Mugunghwa|Nuriro)$/i.test(type) ? "mugunghwa" : undefined;
  if (!family || trip.legs?.some(l => l.lineName !== trip.service)) return null;
  const station = (name: string) => {
    const k = key(trip.country, name);
    const matches = Object.entries(doc.stationNames || {}).filter(([ko, en]) => key(trip.country, ko) === k || key(trip.country, en) === k);
    return matches.length === 1 ? matches[0][0] : undefined;
  };
  const a = station(trip.origin), b = station(trip.destination);
  if (!a || !b || a === b) return null;
  const tables = doc.tables?.filter(t => t.family === family) || [];
  const amounts: Array<number | null> = [];
  for (const table of tables) {
    const source = doc.sources.find(s => s.id === table.sourceId);
    if (!source?.effectiveFrom || date < source.effectiveFrom) continue;
    for (const row of table.rows) {
      // These published interval charts list each unordered station pair once.
      if ((row[0] === a && row[1] === b) || (row[0] === b && row[1] === a)) amounts.push(row[trip.seatClass === "first" ? 3 : 2]);
    }
  }
  // If the OD has different via-route prices (or no price for this class), hide it.
  if (!amounts.length || amounts.some(a => a === null) || new Set(amounts).size !== 1) return null;
  return offer(trip, amounts[0]!, "KRW", trip.seatClass === "first" ? "成人・特室" : "成人・一般室", trip.seatClass === "first" ? "Adult · First class" : "Adult · Standard class");
}

function mbtaFare(trip: TransitResult, doc: FareDocument, date: string): OfficialFare | null {
  if (trip.operator !== "MBTA" || trip.seatClass === "first" || trip.legs?.length) return null;
  const data = doc.gtfs;
  if (!data) return null;
  const feed = data.feed_info[0];
  if (!feed || date < dateIso(feed.feed_start_date) || date > dateIso(feed.feed_end_date)) return null;
  const routes = data.routes.filter(r => ["0", "1", "2"].includes(r.route_type)
    && [r.route_long_name, r.route_short_name].filter(Boolean).includes(trip.service));
  if (routes.length !== 1) return null;
  const route = routes[0];
  // Fare rules apply to known station identities. Route membership is extracted
  // from the same official feed without exporting any departure times.
  const station = (name: string) => {
    const matches = data.stops.filter(s => key(trip.country, s.stop_name) === key(trip.country, name));
    const parents = new Set(matches.map(s => s.parent_station || s.stop_id)
      .filter(parent => data.route_stations.some(r => r.route_id === route.route_id && r.station_id === parent)));
    if (parents.size !== 1) return null;
    const parent = [...parents][0];
    if (!data.route_stations.some(r => r.route_id === route.route_id && r.station_id === parent)) return null;
    const ids = new Set(data.stops.filter(s => s.stop_id === parent || s.parent_station === parent).map(s => s.stop_id));
    return new Set(data.stop_areas.filter(s => ids.has(s.stop_id)).map(s => s.area_id));
  };
  const from = station(trip.origin), to = station(trip.destination);
  if (!from || !to) return null;
  const candidates = data.fare_leg_rules.filter(r => r.network_id === route.network_id && r.transfer_only !== "1"
    && (!r.from_area_id || from.has(r.from_area_id)) && (!r.to_area_id || to.has(r.to_area_id)));
  const specificity = (r: Row) => Number(Boolean(r.from_area_id)) + Number(Boolean(r.to_area_id));
  const max = Math.max(...candidates.map(specificity));
  const rules = candidates.filter(r => specificity(r) === max);
  if (!rules.length) return null;
  const timeframeValid = (id: string) => {
    if (!id) return true;
    const frames = data.timeframes.filter(f => f.timeframe_group_id === id);
    if (frames.length !== 1 || frames[0].start_time || frames[0].end_time) return false;
    const service = frames[0].service_id;
    const exception = data.calendar_dates.find(c => c.service_id === service && dateIso(c.date) === date);
    if (exception) return exception.exception_type === "1";
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${date}T12:00:00Z`).getUTCDay()];
    return data.calendar.some(c => c.service_id === service && date >= dateIso(c.start_date) && date <= dateIso(c.end_date) && c[weekday] === "1");
  };
  if (rules.some(r => !timeframeValid(r.from_timeframe_group_id) || !timeframeValid(r.to_timeframe_group_id))) return null;
  for (const media of ["charlieticket", "mticket", "credit_debit", "cash"]) {
    const products = data.fare_products.filter(p => p.fare_media_id === media && rules.some(r => r.fare_product_id === p.fare_product_id));
    if (!products.length || new Set(products.map(p => `${p.currency}:${p.amount}`)).size !== 1) continue;
    const p = products[0];
    if (p.currency !== "USD" || !p.amount.trim()) return null;
    const medium = data.fare_media.find(m => m.fare_media_id === media)?.fare_media_name || media;
    return offer(trip, Number(p.amount), "USD", `成人・${medium}`, `Adult · ${medium}`);
  }
  return null;
}

export function resolveOfficialFare(trip: TransitResult, doc: FareDocument, now = new Date()): OfficialFare | null {
  if (doc.schemaVersion !== 1 || doc.country !== trip.country || doc.status !== "journey-match"
    || !fareSources[trip.country]?.matching || trip.direct !== true || trip.transferStations?.length
    || trip.provenance && trip.provenance !== "official" || trip.truthMode && trip.truthMode !== "verified") return null;
  const date = serviceDate(trip, now);
  if (!validDate(date) || !validDate(doc.observedOn)) return null;
  // An undated tariff snapshot only proves the day it was checked. Korail has
  // explicit start dates; MBTA supplies a feed validity interval. No invented expiry.
  if (trip.country !== "united_states" && (date > doc.observedOn || trip.country === "hong_kong" && date !== doc.observedOn)) return null;
  try {
    if (trip.country === "hong_kong") return mtrFare(trip, doc);
    if (trip.country === "korea") return korailFare(trip, doc, date);
    if (trip.country === "united_states") return mbtaFare(trip, doc, date);
  } catch { /* Incomplete or changed file formats must fail closed. */ }
  return null;
}

const cache = new Map<Country, Promise<FareDocument>>();
export function loadOfficialFares(country: Country): Promise<FareDocument> {
  const cached = cache.get(country);
  if (cached) return cached;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("Fare file timeout")); }, 4000);
  });
  const request = Promise.race([timeout, (async () => {
    const response = await fetch(`/fares/${country}.json`, { signal: controller.signal });
    if (!response.ok) throw new Error("Fare file unavailable");
    const doc = await response.json();
    if (doc.schemaVersion !== 1 || doc.country !== country || !Array.isArray(doc.sources)) throw new Error("Invalid fare file");
    return doc as FareDocument;
  })()]).catch(error => { cache.delete(country); throw error; }).finally(() => clearTimeout(timer));
  cache.set(country, request);
  return request;
}
