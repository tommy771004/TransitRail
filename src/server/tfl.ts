// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: UK Transport for London (TfL) transit provider service supporting future date and time queries

import type {
  JourneyLeg,
  SearchResponse,
  ServiceDayAdvisory,
  ServiceDayType,
  TransitLine,
  TransitResult,
} from "../types";
import { serviceDayRisk } from "../data/serviceDayAdvisory";
import { recordError } from "./errorLog";

const TFL_API_URL = "https://api.tfl.gov.uk";
const TFL_MODES = "tube,dlr,overground,elizabeth-line";
const STATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface TflStopPoint {
  id?: string;
  commonName?: string;
  modes?: string[];
}

interface TflStopPointResponse {
  stopPoints?: TflStopPoint[];
}

interface TflSearchResponse {
  matches?: Array<{
    id?: string;
    name?: string;
    modes?: string[];
  }>;
}

interface TflLeg {
  duration?: number;
  departureTime?: string;
  arrivalTime?: string;
  mode?: { name?: string };
  departurePoint?: { commonName?: string; lat?: number; lon?: number };
  arrivalPoint?: { commonName?: string; lat?: number; lon?: number };
  instruction?: { summary?: string; detailed?: string };
  routeOptions?: Array<{
    lineIdentifier?: { id?: string; name?: string };
  }>;
  path?: {
    stopPoints?: Array<{ name?: string }>;
  };
  disruptions?: Array<{ description?: string }>;
}

interface TflJourney {
  startDateTime?: string;
  arrivalDateTime?: string;
  duration?: number;
  legs?: TflLeg[];
  fare?: { totalCost?: number };
}

interface TflJourneyResponse {
  journeys?: TflJourney[];
}

/**
 * `/Line/{id}/Timetable/{from}/to/{to}` — the only TfL endpoint that publishes a
 * whole service day rather than the trips around one moment. Each route carries
 * one schedule per day type, and each schedule the departure clock of every
 * journey it runs, so first and last are the ends of `knownJourneys`.
 *
 * Hours run past 23: a Bakerloo service leaving at 00:27 is published as hour
 * "24" of the day it belongs to, which is what makes it the *last* departure of
 * that service day rather than the first of the next one.
 */
interface TflKnownJourney {
  hour?: string;
  minute?: string;
}

interface TflTimetableSchedule {
  name?: string;
  knownJourneys?: TflKnownJourney[];
}

interface TflTimetableResponse {
  timetable?: {
    routes?: Array<{ schedules?: TflTimetableSchedule[] }>;
  };
}

/** A service-day boundary, already carried onto the calendar day it falls on. */
type ServiceBound = { date: string; time: string };

let stationCache: { expiresAt: number; stations: string[] } | null = null;
let lineCache: { expiresAt: number; lines: TransitLine[] } | null = null;
const serviceDayCache = new Map<string, { first: ServiceBound; last: ServiceBound }>();

/**
 * A service-day sweep asks the same route for eleven times of day, and two of
 * the things each sample fetches do not vary with the time it asks about: the
 * station ids, and the line's published service-day bounds. Fetching them per
 * sample turned a 13-request route into a ~55-request one, which is how a single
 * London route came to cost 82 seconds and the daily scrape came to exhaust its
 * 30-minute budget after three of its seven dates.
 *
 * Both memos below store the *promise*, registered synchronously before the
 * first await, so parallel samples that miss together share one request instead
 * of racing to fill the entry. Neither caches a failure.
 */
type ResolvedTflStation = { id: string; name: string } | null;
const stationResolutionMemo = new Map<string, { expiresAt: number; value: Promise<ResolvedTflStation> }>();

/**
 * Per-sweep scratch space for the service-day bounds lookup.
 *
 * Deliberately *not* a process-wide cache with a TTL. The pair feeds
 * `serviceDayAdvisory`, whose `coverage: "stale"` state is how a caller learns
 * TfL could not answer right now — caching a success past the sweep that needed
 * it would report a healthy service day through an outage. One sweep is exactly
 * as long as the answer is known to be worth reusing.
 */
interface TflSweepContext {
  /** Service-day bounds per line+pair+day type, shared by the sweep's samples. */
  bounds: Map<string, Promise<{ first: ServiceBound; last: ServiceBound } | null>>;
  /** Applies to every request the sweep makes, retries included. */
  gate: TflRateGate;
}

/**
 * Forget resolved station ids. Only tests need this: the memo is sized for a
 * long-lived process, so a case that asserts on the lookups its own stub
 * receives would otherwise be answered from the previous case's memo.
 *
 * Deliberately narrow — it does not touch `serviceDayCache`, whose contents are
 * what the stale-advisory cases build up on purpose.
 */
export function resetTflStationResolutionCache() {
  stationResolutionMemo.clear();
}

const tflLineColors: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
  dlr: "#00A4A7",
  liberty: "#6C6D70",
  lioness: "#FFA600",
  mildmay: "#0077AD",
  suffragette: "#5BBD72",
  weaver: "#823A62",
  windrush: "#EE2E24",
};

/**
 * Whether the configured `TFL_APP_KEY` is one TfL actually accepts.
 *
 * `undefined` means the question has not been asked yet; a key stays attached
 * until something tells us it is bad, so the ordinary keyed path costs nothing.
 */
let tflKeyAccepted: boolean | undefined;
let tflKeyProbe: Promise<boolean> | undefined;

function tflAppKey() {
  const key = process.env.TFL_APP_KEY?.trim();
  return key || undefined;
}

function tflUrl(pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, TFL_API_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const key = tflAppKey();
  // A key TfL has already rejected is worse than no key: it cannot lift the
  // allowance and it may be the reason the request is refused at all.
  if (key && tflKeyAccepted !== false) {
    url.searchParams.set("app_key", key);
  }
  return url;
}

/**
 * Ask TfL once whether the configured key works, and cache the answer.
 *
 * The sweep used to read `Boolean(process.env.TFL_APP_KEY)` as "this key buys
 * the subscription allowance" and paced itself accordingly — 150ms between
 * requests, eight in flight, against TfL's ~500/min for subscribers. But a key
 * that is *present and rejected* — never subscribed to a product, quota spent,
 * or carrying a stray newline out of the secret store — buys nothing. The sweep
 * then ran eight times faster than the ~50/min anonymous allowance it was
 * actually being held to, every request came back 429, the retries exhausted,
 * and all 28 of London's route-dates failed while the job still reported
 * success. Setting a bad key was strictly worse than setting none.
 *
 * One idle request settles it, which is the same question
 * `scripts/diagnose-tfl-key.ts` answers by hand.
 */
async function tflKeyIsUsable(): Promise<boolean> {
  const key = tflAppKey();
  if (!key) return false;
  if (tflKeyAccepted !== undefined) return tflKeyAccepted;

  tflKeyProbe ??= (async () => {
    const url = new URL(`/StopPoint/Search/${encodeURIComponent("Oxford Circus")}`, TFL_API_URL);
    url.searchParams.set("modes", TFL_MODES);
    url.searchParams.set("app_key", key);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "TransitRail/1.0" },
      });
      if (response.ok) return true;
      console.warn(
        `  TfL rejected TFL_APP_KEY (HTTP ${response.status}); falling back to anonymous access and pacing.`
        + " Run `npx tsx scripts/diagnose-tfl-key.ts` to see what TfL says about the key.",
      );
      return false;
    } catch {
      // A network failure says nothing about the key. Leave the verdict open so
      // a transient blip does not demote a good key for the whole process.
      return true;
    }
  })();

  const accepted = await tflKeyProbe;
  tflKeyAccepted = accepted;
  if (!accepted) {
    void recordError({
      severity: "warning",
      module: "tfl",
      operation: "key.probe",
      errorCode: "TFL_APP_KEY_REJECTED",
      error: new Error("TFL_APP_KEY was rejected by TfL; using anonymous access."),
      country: "united_kingdom",
      provider: TFL_API_URL,
    });
  }
  return accepted;
}

/**
 * Forget the cached key verdict. Tests drive the probe per case; a long-lived
 * process keeps its answer.
 */
export function resetTflKeyProbe() {
  tflKeyAccepted = undefined;
  tflKeyProbe = undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Anonymous TfL access is rate limited, and a service-day sweep issues one
 * request per sampled hour. Back off and retry on 429 rather than dropping the
 * sample: a half-collected day is worse than a slow one, because the gaps look
 * like missing service instead of a throttled scrape. Set `TFL_APP_KEY` to lift
 * the limit and make this path rare.
 */
const TFL_RATE_LIMIT_RETRIES = 3;

/**
 * Serializes request *starts* to at most one per interval.
 *
 * A concurrency limit is not a rate limit. Pacing only the start of each sampled
 * hour left the samples free to bunch up behind anything they share — they all
 * wait on one station lookup, then resume in the same tick and fire together —
 * so a sweep that averaged well under the limit still opened with a burst of
 * about ten simultaneous requests, and a 429 sent all of them into a retry that
 * bunched the same way. Claiming the slot synchronously means concurrent callers
 * queue against each other instead of against the clock they all read at once.
 */
function createTflRateGate(intervalMs: number) {
  let nextAt = 0;
  let lastAt = 0;
  let queue: Promise<void> = Promise.resolve();
  return () => {
    if (intervalMs <= 0) return Promise.resolve();
    // Claim the slot synchronously, for the reason above.
    const startAt = Math.max(Date.now(), nextAt);
    nextAt = startAt + intervalMs;
    // Then wait behind the previous caller rather than on a lone relative
    // sleep. `setTimeout` promises only a floor on its delay, and the delay is
    // computed when the slot is claimed: if the event loop stalls past several
    // claimed slots, all of them come due at once and their sleeps resolve in
    // the same tick — the burst this gate exists to prevent, arriving exactly
    // when the process is already under load. Holding each caller to one
    // interval past the previous *dispatch* re-spaces an overdue queue instead
    // of releasing it together.
    const wait = queue.then(async () => {
      const due = Math.max(startAt, lastAt + intervalMs);
      for (let remaining = due - Date.now(); remaining > 0; remaining = due - Date.now()) {
        await sleep(remaining);
      }
      lastAt = Date.now();
    });
    queue = wait;
    return wait;
  };
}

type TflRateGate = () => Promise<void>;

/**
 * A 429 is the one failure worth quoting the provider on. "Rate limit exceeded,
 * try again in N seconds" and "quota exhausted" and "this key is not subscribed"
 * all arrive as the same status with different bodies, and without the body a
 * run cannot tell a sweep that is going too fast from a key that was never going
 * to work. It reaches the error log only — `searchTflJourney` still answers
 * callers with its own generic message.
 */
async function describeTflRateLimit(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  let body = "";
  try {
    body = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 200);
  } catch {
    body = "<unreadable>";
  }
  return `TfL returned HTTP 429.${retryAfter ? ` Retry-After: ${retryAfter}.` : ""}${body ? ` Provider said: ${body}` : ""}`;
}

async function fetchTflJson<T>(url: URL, gate?: TflRateGate): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    await gate?.();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "TransitRail/1.0",
        },
      });
      if (response.status === 429) {
        if (attempt >= TFL_RATE_LIMIT_RETRIES) {
          throw new Error(await describeTflRateLimit(response));
        }
        const retryAfter = Number(response.headers.get("retry-after"));
        clearTimeout(timeout);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2_000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`TfL returned HTTP ${response.status}.`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeStationName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+(underground|rail|dlr|overground)\s+station$/, "")
    // A bare "Station" suffix too: TfL's own catalogue carries both
    // "Paddington Station" and "Paddington Underground Station", and they are
    // the same place. Without this they hash to different keys and the exact
    // match below never fires.
    .replace(/\s+station$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateInLondon() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * TfL timestamps are already London local and carry NO timezone designator
 * ("2026-08-05T09:00:00"). `new Date()` reads such a string in the *process's*
 * zone, so converting it to Europe/London shifted every departure by the gap
 * between the server's zone and London's — an hour late on a UTC host through
 * British Summer Time, seven hours early on an Asia/Taipei laptop. The wall
 * clock in the string is the answer; read it, do not convert it.
 */
const LONDON_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function londonParts(value?: string): { date: string; time: string } | null {
  if (!value) return null;
  const local = value.match(LONDON_LOCAL);
  // Zone-less: the string is London wall-clock time already.
  if (local && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return { date: `${local[1]}-${local[2]}-${local[3]}`, time: `${local[4]}:${local[5]}` };
  }
  // Zoned (or unparseable as local): convert properly.
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function timeInLondon(value?: string) {
  return londonParts(value)?.time ?? "--:--";
}

function localDateTimeInLondon(value?: string) {
  return londonParts(value);
}

function localMinutes(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

function serviceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

function buildServiceDayAdvisory(
  date: string,
  selectedTime: string,
  bounds: { first: ServiceBound; last: ServiceBound } | null | undefined,
): ServiceDayAdvisory {
  const first = bounds?.first;
  const last = bounds?.last;
  const queryMinutes = localMinutes(date, selectedTime);
  const lastMinutes = last ? localMinutes(last.date, last.time) : null;
  const minutesToLastDeparture = queryMinutes !== null && lastMinutes !== null
    ? lastMinutes - queryMinutes
    : undefined;
  const risk = minutesToLastDeparture === undefined
    ? "unavailable"
    : serviceDayRisk(minutesToLastDeparture);

  return {
    coverage: first && last ? "supported" : "unavailable",
    serviceDate: date,
    timezone: "Europe/London",
    serviceDayType: serviceDayType(date),
    firstDeparture: first?.time,
    lastDeparture: last?.time,
    risk,
    minutesToLastDeparture,
    source: TFL_API_URL,
    sourceUrl: TFL_API_URL,
    checkedAt: new Date().toISOString(),
  };
}

function publicTransportLegs(legs: TflLeg[]) {
  return legs.filter((leg) => leg.mode?.name !== "walking");
}

export async function getTflStations() {
  if (stationCache && stationCache.expiresAt > Date.now()) {
    return stationCache.stations;
  }

  const data = await fetchTflJson<TflStopPointResponse>(
    tflUrl(`/StopPoint/Mode/${TFL_MODES}`),
  );
  const stations = Array.from(
    new Set(
      (data.stopPoints || [])
        .map((station) => station.commonName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  stationCache = {
    expiresAt: Date.now() + STATION_CACHE_TTL_MS,
    stations,
  };
  return stations;
}

interface TflLineSummary {
  id?: string;
  name?: string;
  modeName?: string;
}

export async function getTflLines(): Promise<TransitLine[]> {
  if (lineCache && lineCache.expiresAt > Date.now()) {
    return lineCache.lines;
  }

  const lineSummaries = await fetchTflJson<TflLineSummary[]>(
    tflUrl(`/Line/Mode/${TFL_MODES}`),
  );
  const summaries = (lineSummaries || []).filter((line): line is Required<TflLineSummary> =>
    Boolean(line.id && line.name));

  const lines = await Promise.all(
    summaries.map(async (summary) => {
      const stopPoints = await fetchTflJson<TflStopPoint[]>(
        tflUrl(`/Line/${encodeURIComponent(summary.id)}/StopPoints`),
      );
      const stations = (stopPoints || [])
        .map((stop) => stop.commonName?.trim())
        .filter((name): name is string => Boolean(name));
      return { id: summary.id, name: summary.name, stations };
    }),
  );

  const linesByStation = new Map<string, string[]>();
  for (const line of lines) {
    for (const station of line.stations) {
      const names = linesByStation.get(station) || [];
      if (!names.includes(line.name)) names.push(line.name);
      linesByStation.set(station, names);
    }
  }

  const catalog: TransitLine[] = lines.map((line) => ({
    id: line.id,
    name: line.name,
    color: tflLineColors[line.id],
    stations: line.stations.map((station) => {
      const transfers = (linesByStation.get(station) || []).filter((name) => name !== line.name);
      return {
        name: station,
        interchanges: transfers.length > 0 ? transfers : undefined,
      };
    }),
  }));

  lineCache = {
    expiresAt: Date.now() + STATION_CACHE_TTL_MS,
    lines: catalog,
  };
  return catalog;
}

async function searchTflStopPoints(query: string, gate?: TflRateGate) {
  const data = await fetchTflJson<TflSearchResponse>(
    tflUrl(`/StopPoint/Search/${encodeURIComponent(query)}`, { modes: TFL_MODES }),
    gate,
  );
  return (data.matches || []).filter((match) => match.id && match.name);
}

/**
 * TfL's search matches on words, so a "Station" suffix the network does not use
 * finds nothing: "Paddington Station" and "Liverpool Street Station" resolved to
 * null and every date for that route fell back to the snapshot, while the three
 * routes named "… Underground Station" worked. Retrying without the suffix costs
 * one request on the paths that were previously dead ends.
 */
function resolveTflStation(query: string, gate?: TflRateGate): Promise<ResolvedTflStation> {
  // Station ids are stable, so this shares the existing station-cache lifetime.
  // Keyed on the raw query because the un-normalized spelling is what the first
  // lookup attempt sends.
  const cached = stationResolutionMemo.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = resolveTflStationUncached(query, gate);
  stationResolutionMemo.set(query, { expiresAt: Date.now() + STATION_CACHE_TTL_MS, value });
  value.catch(() => {
    if (stationResolutionMemo.get(query)?.value === value) stationResolutionMemo.delete(query);
  });
  return value;
}

async function resolveTflStationUncached(query: string, gate?: TflRateGate): Promise<ResolvedTflStation> {
  const normalizedQuery = normalizeStationName(query);
  let matches = await searchTflStopPoints(query, gate);
  if (matches.length === 0 && normalizedQuery && normalizedQuery !== query.toLowerCase()) {
    matches = await searchTflStopPoints(normalizedQuery, gate);
  }
  let exact = matches.find((match) => normalizeStationName(match.name || "") === normalizedQuery);
  let selected = exact || matches[0];

  // TfL's search returns a HUB* interchange id for some bare station names.
  // JourneyResults cannot disambiguate those hubs (HTTP 300); retry with the
  // Tube spelling to obtain the child StopPoint id when one exists.
  if (selected?.id?.startsWith("HUB") && normalizedQuery) {
    const specificMatches = await searchTflStopPoints(`${normalizedQuery} Underground Station`, gate);
    exact = specificMatches.find((match) => normalizeStationName(match.name || "") === normalizedQuery);
    selected = exact || specificMatches[0] || selected;
  }
  return selected?.id
    ? { id: selected.id, name: selected.name || query }
    : null;
}

function currentLondonTimeHHMM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}${values.minute}`;
}

/**
 * Which published schedule covers a service day. TfL names them in prose
 * ("Monday - Friday", "Saturdays and Public Holidays", "Sunday"), and Saturday's
 * name also contains "holiday", so Sunday is matched on its own word first.
 */
function scheduleForDay(schedules: TflTimetableSchedule[], dayType: ServiceDayType) {
  const named = (pattern: RegExp) => schedules.find((schedule) => pattern.test(schedule.name || ""));
  if (dayType === "saturday") return named(/saturday/i);
  if (dayType === "sunday_holiday") return named(/sunday/i) ?? named(/holiday/i);
  return named(/monday|weekday/i);
}

/**
 * The ends of a published schedule, carried onto the calendar day each falls on.
 *
 * An hour of 24 or more is TfL saying "still the same service day": 24:27 is
 * 00:27 tomorrow, and rolling it forward here is what lets the ordinary minute
 * arithmetic downstream see it as later than 23:00 rather than as 27 minutes
 * past midnight this morning.
 */
function boundsFromSchedule(schedule: TflTimetableSchedule, date: string) {
  const minutes = (schedule.knownJourneys || [])
    .map((journey) => Number(journey.hour) * 60 + Number(journey.minute))
    .filter(Number.isFinite);
  if (!minutes.length) return null;

  const bound = (total: number): ServiceBound => {
    const dayOffset = Math.floor(total / (24 * 60));
    const clock = total - dayOffset * 24 * 60;
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    return {
      date: day.toISOString().slice(0, 10),
      time: `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`,
    };
  };

  return { first: bound(Math.min(...minutes)), last: bound(Math.max(...minutes)) };
}

/**
 * The first and last departure of a service day, shared across a sweep when one
 * is in progress and fetched outright when this is a one-off journey query.
 *
 * This asks the line's published timetable, not the journey planner. The planner
 * has no notion of a service day: `adjustment=TripFirst`/`TripLast` were once
 * used here, but TfL ignores the parameter outright — the responses are
 * identical with and without it — so both "bounds" were the trips around the
 * sampled time. First and last therefore collapsed onto that time and every UK
 * search reported `risk: "critical"`, telling a passenger at midday that the
 * last train was leaving.
 */
function fetchServiceDayBounds(
  lineId: string,
  fromId: string,
  toId: string,
  date: string,
  key: string,
  sweep: TflSweepContext | undefined,
): Promise<{ first: ServiceBound; last: ServiceBound } | null> {
  const cached = sweep?.bounds.get(key);
  if (cached) return cached;

  const value = fetchTflJson<TflTimetableResponse>(
    tflUrl(`/Line/${encodeURIComponent(lineId)}/Timetable/${encodeURIComponent(fromId)}/to/${encodeURIComponent(toId)}`),
    sweep?.gate,
  ).then((body) => {
    const schedules = body.timetable?.routes?.[0]?.schedules || [];
    const schedule = scheduleForDay(schedules, serviceDayType(date));
    return schedule ? boundsFromSchedule(schedule, date) : null;
  });

  // The caller only awaits this inside its own try, and the journey fetch it
  // races can reject first — attach a handler so a rejection is never unhandled,
  // and drop the entry so a later sample retries rather than reusing a failure.
  value.catch(() => {
    if (sweep?.bounds.get(key) === value) sweep.bounds.delete(key);
  });
  sweep?.bounds.set(key, value);
  return value;
}

/** The line a journey actually runs on, which is the line whose timetable bounds it. */
function primaryLineId(journey: TflJourney | undefined) {
  for (const leg of publicTransportLegs(journey?.legs || [])) {
    const id = leg.routeOptions?.[0]?.lineIdentifier?.id;
    if (id) return id;
  }
  return undefined;
}

export async function searchTflJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
  sweep?: TflSweepContext,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  const tflDate = date.replace(/-/g, "");
  const tflTime = time ? time.replace(/:/g, "") : currentLondonTimeHHMM();
  // A traveller query still fans out into station resolution, the requested
  // journey, and first/last service-day bounds. Pace that whole fan-out with
  // the same mechanism as a nightly sweep so opening the live directory and
  // immediately searching cannot burst through TfL's anonymous allowance.
  const requestContext: TflSweepContext = sweep ?? {
    bounds: new Map(),
    gate: createTflRateGate(tflRuntimeRequestIntervalMs()),
  };

  try {
    const [resolvedOrigin, resolvedDestination] = await Promise.all([
      resolveTflStation(origin, requestContext.gate),
      resolveTflStation(destination, requestContext.gate),
    ]);

    if (!resolvedOrigin || !resolvedDestination) {
      return {
        status: 400,
        body: {
          error: "Station not found",
          message: "TfL could not resolve one or both station names.",
          results: [],
          source: TFL_API_URL,
        },
      };
    }

    const journeyPath = `/Journey/JourneyResults/${encodeURIComponent(resolvedOrigin.id)}/to/${encodeURIComponent(resolvedDestination.id)}`;
    const serviceDayCacheKey = `${resolvedOrigin.id}->${resolvedDestination.id}:${date}`;
    const journeyParams = {
      mode: TFL_MODES,
      timeIs: "Departing",
      journeyPreference: "LeastTime",
      date: tflDate,
      time: tflTime,
    };
    const data = await fetchTflJson<TflJourneyResponse>(tflUrl(journeyPath, journeyParams), requestContext.gate);

    // The bounds come from the *line's* published timetable, so they can only be
    // asked for once the journey has named the line it runs on. A sweep's eleven
    // samples still share one fetch: the memo below is keyed by line and pair,
    // which is exactly what does not vary with the time being sampled.
    const lineId = primaryLineId(data.journeys?.[0]);
    const sampledTime = `${tflTime.slice(0, 2)}:${tflTime.slice(2)}`;
    let serviceDayAdvisory: ServiceDayAdvisory;
    try {
      const bounds = lineId
        ? await fetchServiceDayBounds(
          lineId,
          resolvedOrigin.id,
          resolvedDestination.id,
          date,
          `${lineId}:${serviceDayCacheKey}`,
          requestContext,
        )
        : null;
      if (bounds) serviceDayCache.set(serviceDayCacheKey, bounds);
      serviceDayAdvisory = buildServiceDayAdvisory(date, sampledTime, bounds);
    } catch (error) {
      void recordError({
        severity: "error",
        module: "tfl",
        operation: "service-day.fetch",
        errorCode: "TFL_SERVICE_DAY_FAILED",
        error,
        country: "united_kingdom",
        provider: TFL_API_URL,
        context: { origin, destination, date },
      });
      const cached = serviceDayCache.get(serviceDayCacheKey);
      const fallback = buildServiceDayAdvisory(date, sampledTime, cached);
      serviceDayAdvisory = {
        ...fallback,
        coverage: cached ? "stale" : "unavailable",
        note: cached
          ? "The last known service-day timetable is being shown while TfL is unavailable."
          : "TfL service-day information is temporarily unavailable.",
        checkedAt: new Date().toISOString(),
      };
    }

    const results: TransitResult[] = (data.journeys || []).slice(0, 5).map((journey, index) => {
      const legs = journey.legs || [];
      const transitLegs = publicTransportLegs(legs);
      const services = Array.from(
        new Set(
          transitLegs
            .flatMap((leg) => leg.routeOptions || [])
            .map((option) => option.lineIdentifier?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      );
      const intermediateStops = transitLegs
        .flatMap((leg) => leg.path?.stopPoints || [])
        .map((stop) => stop.name)
        .filter((name): name is string => Boolean(name))
        .filter((name) => (
          normalizeStationName(name) !== normalizeStationName(resolvedOrigin.name) &&
          normalizeStationName(name) !== normalizeStationName(resolvedDestination.name)
        ));
      const warnings = transitLegs
        .flatMap((leg) => leg.disruptions || [])
        .map((disruption) => disruption.description)
        .filter((description): description is string => Boolean(description));
      const farePence = journey.fare?.totalCost;

      const legDetails: JourneyLeg[] = transitLegs.map((leg) => {
        const lineId = leg.routeOptions?.[0]?.lineIdentifier?.id;
        return {
          lineName: leg.routeOptions?.[0]?.lineIdentifier?.name || leg.mode?.name || "TfL",
          lineCode: lineId,
          color: lineId ? tflLineColors[lineId] : undefined,
          mode: leg.mode?.name,
          origin: leg.departurePoint?.commonName || "",
          originLat: leg.departurePoint?.lat,
          originLng: leg.departurePoint?.lon,
          destination: leg.arrivalPoint?.commonName || "",
          destLat: leg.arrivalPoint?.lat,
          destLng: leg.arrivalPoint?.lon,
          departureTime: timeInLondon(leg.departureTime),
          arrivalTime: timeInLondon(leg.arrivalTime),
          durationMinutes: leg.duration,
          headsign: leg.instruction?.summary,
          stopCount: leg.path?.stopPoints?.length || undefined,
        };
      });
      const transferStations = legDetails
        .slice(0, -1)
        .map((leg) => leg.destination)
        .filter(Boolean);
      const firstLineId = transitLegs[0]?.routeOptions?.[0]?.lineIdentifier?.id;

      return {
        id: `uk-tfl-${journey.startDateTime || Date.now()}-${index}`,
        country: "united_kingdom",
        operator: "Transport for London",
        service: services.join(" + ") || "TfL",
        trainType: transitLegs.map((leg) => leg.mode?.name).filter(Boolean).join(" + "),
        durationMinutes: journey.duration,
        departureTime: timeInLondon(journey.startDateTime),
        arrivalTime: timeInLondon(journey.arrivalDateTime),
        origin: resolvedOrigin.name,
        originLat: legDetails[0]?.originLat,
        originLng: legDetails[0]?.originLng,
        destination: resolvedDestination.name,
        destLat: legDetails.at(-1)?.destLat,
        destLng: legDetails.at(-1)?.destLng,
        price: typeof farePence === "number" ? farePence / 100 : undefined,
        currency: typeof farePence === "number" ? "GBP" : undefined,
        direct: transitLegs.length <= 1,
        stops: Array.from(new Set(intermediateStops)),
        headsign: transitLegs.at(-1)?.instruction?.summary,
        // The journey planner answers future dates from the published schedule.
        // Only a journey on today's London service day can be a live arrival;
        // flagging the rest realtime made real scheduled data classify as a
        // stale live snapshot and get thrown away.
        realtime: londonParts(journey.startDateTime)?.date === dateInLondon(),
        warning: warnings[0],
        lineColor: firstLineId ? tflLineColors[firstLineId] : undefined,
        legs: legDetails.length > 1 ? legDetails : undefined,
        transferStations: transferStations.length > 0 ? transferStations : undefined,
      };
    });

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0 ? "TfL returned no journeys for this route." : undefined,
        source: TFL_API_URL,
        serviceDayAdvisory,
      },
    };
  } catch (error) {
    void recordError({
      severity: "error",
      module: "tfl",
      operation: "journey.fetch",
      errorCode: "TFL_JOURNEY_FAILED",
      error,
      country: "united_kingdom",
      provider: TFL_API_URL,
      context: { origin, destination, date },
    });
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: "Transit data is temporarily unavailable. Please try again later.",
        results: [],
        source: TFL_API_URL,
      },
    };
  }
}

// --- End of tfl.ts ---

/**
 * Times of day sampled to build a service day from the journey planner.
 *
 * The planner answers "journeys near this time", so one query returns a handful
 * of departures within a few minutes. Sweeping the operating day turns that into
 * a real, if incomplete, picture of the service — every row is a genuine
 * published departure, and nothing between the samples is invented.
 */
const SERVICE_DAY_SAMPLE_TIMES = [
  "05:30", "07:00", "08:30", "10:00", "12:00",
  "14:00", "16:00", "17:30", "19:00", "21:00", "23:00",
];

/**
 * How many samples may be in flight, and how often the sweep may issue a
 * request of any kind.
 *
 * The sweep used to run strictly serially, so a route cost the sum of eleven
 * round trips. Concurrency hides that latency, but it must not raise the request
 * rate — TfL's published limits are ~50/min anonymously and ~500/min on a
 * subscription key, so the intervals sit under each. Concurrency then only
 * decides how much latency overlaps; the gate decides the rate.
 *
 * `TFL_REQUEST_INTERVAL_MS` overrides the interval for a key on a product with a
 * different allowance, so a 429 can be answered without a code change.
 */
const SERVICE_DAY_CONCURRENCY = 4;
const SERVICE_DAY_KEYED_CONCURRENCY = 8;
const SERVICE_DAY_REQUEST_INTERVAL_MS = 1_200;
const SERVICE_DAY_KEYED_REQUEST_INTERVAL_MS = 150;

function tflRequestIntervalMs(keyed: boolean) {
  const override = Number(process.env.TFL_REQUEST_INTERVAL_MS);
  if (Number.isFinite(override) && override >= 0) return override;
  return keyed ? SERVICE_DAY_KEYED_REQUEST_INTERVAL_MS : SERVICE_DAY_REQUEST_INTERVAL_MS;
}

function tflRuntimeRequestIntervalMs() {
  // Ordinary journey unit fixtures are in-memory and should not spend seconds
  // imitating the public API. A pacing test sets the override explicitly;
  // sweep tests continue to exercise the production defaults above.
  if (process.env.NODE_ENV === "test" && process.env.TFL_REQUEST_INTERVAL_MS === undefined) return 0;
  return tflRequestIntervalMs(false);
}

/**
 * Run `worker` over `items` with at most `limit` in flight, keeping the results
 * in input order so the sweep stays deterministic regardless of which sample
 * finishes first.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runner = async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner),
  );
  return results;
}

/**
 * One service day for a route, assembled from several journey-planner queries.
 *
 * A single query gave three departures for a whole day, which is why the daily
 * scrape used to look like a live snapshot stamped on seven dates. Sampling
 * across the day keeps every row real while covering the hours a passenger
 * might actually travel.
 */
export async function searchTflServiceDay(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  // Verified, not merely configured: pacing at the subscription rate on the
  // strength of an unusable key is what turned London's scrape into 28 failures.
  const keyed = await tflKeyIsUsable();

  // One context per sweep. The samples share the service day's first/last trip,
  // and it is discarded with the sweep so no later request inherits it; the gate
  // covers every request they make — station lookups, trip bounds, journeys and
  // retries alike — because pacing only the sample starts let them bunch behind
  // whatever they shared and then fire together.
  const sweep: TflSweepContext = {
    bounds: new Map(),
    gate: createTflRateGate(tflRequestIntervalMs(keyed)),
  };

  const responses = await mapWithConcurrency(
    SERVICE_DAY_SAMPLE_TIMES,
    keyed ? SERVICE_DAY_KEYED_CONCURRENCY : SERVICE_DAY_CONCURRENCY,
    (time) => searchTflJourney(origin, destination, date, time, sweep),
  );

  const byId = new Map<string, SearchResponse["results"][number]>();
  for (const response of responses) {
    for (const result of response.body.results || []) {
      if (!byId.has(result.id)) byId.set(result.id, result);
    }
  }
  const last = responses.at(-1);

  // Every sample failed: hand back the last failure so the caller's existing
  // provider-fallback path reports it rather than seeing a silent empty day.
  if (byId.size === 0) {
    return last ?? {
      status: 502,
      body: { error: "Provider request failed", results: [], source: TFL_API_URL },
    };
  }

  const results = [...byId.values()].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  return {
    status: 200,
    body: { ...last!.body, results, source: TFL_API_URL },
  };
}
