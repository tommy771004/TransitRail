// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: How busy a London Underground station is now, from TfL's live
// crowding feed, in the words TfL asks apps to use — and, when it is not quiet,
// the next time it is usually quiet, which is what TfL asks apps to lead with.
//
// TfL's definition (Tech Forum, 2021-09-17): the value is the station's
// busyness in the last 5 minutes as a fraction of the busiest it has been since
// July 2019. Below 0.4 is "quiet", 0.4 to 0.7 "busy", above 0.7 "very busy".
// Only Tube stations are covered, and Monument is counted as Bank.

import { fetchTflJson, resolveTflStation, tflUrl } from "./tfl";

export type CrowdingLevel = "quiet" | "busy" | "very_busy";

export interface StationCrowding {
  station: string;
  level: CrowdingLevel;
  /** When TfL measured it, as an instant. */
  measuredAt: string;
  /** "HH:MM" London time of the next usually-quiet quarter hour today, if the station is not quiet now. */
  usuallyQuietFrom?: string;
}

interface TflLiveCrowding {
  dataAvailable?: boolean;
  percentageOfBaseline?: number;
  timeUtc?: string | null;
}

interface TflTypicalCrowding {
  timeBands?: Array<{ timeBand?: string; percentageOfBaseLine?: number }>;
}

const TUBE_NAPTAN = /^940GZZLU[A-Z]{3}$/;
/** TfL reports Monument's crowding under Bank. */
const CROWDING_NAPTAN_ALIASES: Record<string, string> = { "940GZZLUMMT": "940GZZLUBNK" };
/** TfL recomputes every 5 minutes; a reading older than this is no longer "now". */
const MAX_READING_AGE_MS = 30 * 60_000;
/** How far ahead a quieter time is still worth suggesting. */
const QUIET_LOOKAHEAD_MINUTES = 3 * 60;

export function crowdingLevel(value: number): CrowdingLevel {
  if (value < 0.4) return "quiet";
  return value <= 0.7 ? "busy" : "very_busy";
}

function londonClock(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return { weekday: String(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** The first typical quarter hour after now that TfL counts as quiet, within the lookahead. */
export function nextUsuallyQuiet(typical: TflTypicalCrowding, nowMinutes: number): string | undefined {
  for (const band of typical.timeBands || []) {
    const match = band.timeBand?.match(/^(\d{2}):(\d{2})-/);
    if (!match || typeof band.percentageOfBaseLine !== "number") continue;
    const start = Number(match[1]) * 60 + Number(match[2]);
    if (start <= nowMinutes || start > nowMinutes + QUIET_LOOKAHEAD_MINUTES) continue;
    if (crowdingLevel(band.percentageOfBaseLine) === "quiet") return `${match[1]}:${match[2]}`;
  }
  return undefined;
}

/** The Tube stop TfL keeps crowding for, or null when the station has none. */
async function tubeNaptan(station: string): Promise<{ id: string; name: string } | null> {
  for (const query of [station, `${station} Underground Station`]) {
    const resolved = await resolveTflStation(query);
    if (resolved && TUBE_NAPTAN.test(resolved.id)) return resolved;
  }
  return null;
}

/**
 * Null whenever TfL has nothing to say for the station — not a Tube station,
 * no live reading, a stale one, or the feed failed. Crowding is supplementary, so its
 * absence is simply not shown.
 */
export async function londonStationCrowding(station: string, now = new Date()): Promise<StationCrowding | null> {
  try {
    const stop = await tubeNaptan(station);
    if (!stop) return null;
    const naptan = CROWDING_NAPTAN_ALIASES[stop.id] || stop.id;
    const live = await fetchTflJson<TflLiveCrowding>(tflUrl(`/crowding/${naptan}/Live`));
    if (!live.dataAvailable || typeof live.percentageOfBaseline !== "number" || !live.timeUtc) return null;
    // The feed has stalled for months before; an old reading must not pass as live.
    if (!(now.getTime() - Date.parse(live.timeUtc) <= MAX_READING_AGE_MS)) return null;
    const level = crowdingLevel(live.percentageOfBaseline);
    let usuallyQuietFrom: string | undefined;
    if (level !== "quiet") {
      const clock = londonClock(now);
      const typical = await fetchTflJson<TflTypicalCrowding>(tflUrl(`/crowding/${naptan}/${clock.weekday}`)).catch(() => undefined);
      usuallyQuietFrom = typical ? nextUsuallyQuiet(typical, clock.minutes) : undefined;
    }
    return { station: stop.name, level, measuredAt: live.timeUtc, ...(usuallyQuietFrom ? { usuallyQuietFrom } : {}) };
  } catch {
    return null;
  }
}

// --- End of tflCrowding.ts ---
