import type { ServiceDayAdvisory, ServiceRisk } from "../types";

/** Scheduled collectors run daily; beyond this window a good artifact is still
 * useful as fallback, but must be presented as stale. */
export const SERVICE_DAY_ARTIFACT_MAX_AGE_MS = 36 * 60 * 60 * 1000;
export interface ServiceDayRiskThresholds {
  approachingMinutes: number;
  criticalMinutes: number;
}

export const DEFAULT_SERVICE_DAY_RISK_THRESHOLDS: ServiceDayRiskThresholds = {
  approachingMinutes: 60,
  criticalMinutes: 15,
};

const COVERAGES = new Set(["supported", "partial", "stale", "unavailable"]);
const DAY_TYPES = new Set(["weekday", "saturday", "sunday_holiday", "special"]);
const RISKS = new Set(["safe", "approaching", "critical", "missed", "unavailable"]);

export function serviceDayRisk(
  minutesToLastDeparture: number,
  thresholds: ServiceDayRiskThresholds = DEFAULT_SERVICE_DAY_RISK_THRESHOLDS,
): Exclude<ServiceRisk, "unavailable"> {
  if (minutesToLastDeparture < 0) return "missed";
  if (minutesToLastDeparture <= thresholds.criticalMinutes) return "critical";
  if (minutesToLastDeparture <= thresholds.approachingMinutes) return "approaching";
  return "safe";
}

function validClock(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 47 && minute >= 0 && minute <= 59;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function clockMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localClockMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return clockMinutes(`${values.hour}:${values.minute}`);
}

/** Validate the shared advisory boundary before it is cached or published. */
export function validateServiceDayAdvisory(value: unknown): ServiceDayAdvisory {
  if (!value || typeof value !== "object") throw new Error("Service-day advisory must be an object.");
  const advisory = value as Partial<ServiceDayAdvisory>;
  if (typeof advisory.coverage !== "string" || !COVERAGES.has(advisory.coverage)) throw new Error("Service-day advisory has invalid coverage.");
  if (!validDate(advisory.serviceDate)) throw new Error("Service-day advisory has invalid service date.");
  if (typeof advisory.timezone !== "string" || advisory.timezone.length === 0) throw new Error("Service-day advisory has no timezone.");
  if (typeof advisory.serviceDayType !== "string" || !DAY_TYPES.has(advisory.serviceDayType)) throw new Error("Service-day advisory has invalid service-day type.");
  if (typeof advisory.risk !== "string" || !RISKS.has(advisory.risk)) throw new Error("Service-day advisory has invalid risk.");
  if (typeof advisory.source !== "string" || advisory.source.length === 0) throw new Error("Service-day advisory has no source attribution.");
  if (advisory.sourceUrl !== undefined && (typeof advisory.sourceUrl !== "string" || !/^https?:\/\//i.test(advisory.sourceUrl))) throw new Error("Service-day advisory has an unsafe source URL.");
  if (advisory.firstDeparture !== undefined && !validClock(advisory.firstDeparture)) throw new Error("Service-day advisory has an invalid first departure.");
  if (advisory.lastDeparture !== undefined && !validClock(advisory.lastDeparture)) throw new Error("Service-day advisory has an invalid last departure.");
  if ((advisory.coverage === "supported" || advisory.coverage === "partial") && (!validClock(advisory.firstDeparture) || !validClock(advisory.lastDeparture))) {
    throw new Error("Supported service-day advisory must include first and last departures.");
  }
  if (advisory.minutesToLastDeparture !== undefined && (!Number.isFinite(advisory.minutesToLastDeparture) || Math.abs(advisory.minutesToLastDeparture) > 10_000)) {
    throw new Error("Service-day advisory has invalid minutes to last departure.");
  }
  if (advisory.frequency !== undefined) {
    if (!Array.isArray(advisory.frequency) || advisory.frequency.length === 0) {
      throw new Error("Service-day advisory has an empty frequency list.");
    }
    for (const band of advisory.frequency) {
      if (!band || typeof band.label !== "string" || band.label.length === 0) {
        throw new Error("Service-day advisory frequency band has no label.");
      }
      // Operators quote single values and ranges; anything else is not a
      // headway we can present as published.
      if (typeof band.minutes !== "string" || !/^\d+(\.\d+)?(-\d+(\.\d+)?)?$/.test(band.minutes)) {
        throw new Error("Service-day advisory frequency band has invalid minutes.");
      }
    }
  }
  return advisory as ServiceDayAdvisory;
}

export function withArtifactFreshness(
  advisory: ServiceDayAdvisory,
  retrievedAt: string | undefined,
  now = Date.now(),
): ServiceDayAdvisory {
  const retrievedMs = retrievedAt ? Date.parse(retrievedAt) : Number.NaN;
  const stale = !Number.isFinite(retrievedMs)
    || now - retrievedMs > SERVICE_DAY_ARTIFACT_MAX_AGE_MS;
  if (!stale || (advisory.coverage !== "supported" && advisory.coverage !== "partial")) return advisory;
  return {
    ...advisory,
    coverage: "stale",
    checkedAt: new Date(now).toISOString(),
    note: advisory.note
      ? `${advisory.note} The last scheduled artifact may be out of date.`
      : "The last scheduled artifact may be out of date; confirm with the operator.",
  };
}

export function withSelectedQueryRisk(
  advisory: ServiceDayAdvisory,
  selectedTime: string | undefined,
  now = new Date(),
): ServiceDayAdvisory {
  if (!advisory.lastDeparture || (advisory.coverage !== "supported" && advisory.coverage !== "partial" && advisory.coverage !== "stale")) {
    return advisory;
  }

  const firstMinutes = advisory.firstDeparture && validClock(advisory.firstDeparture)
    ? clockMinutes(advisory.firstDeparture)
    : undefined;
  let lastMinutes = validClock(advisory.lastDeparture) ? clockMinutes(advisory.lastDeparture) : undefined;
  if (lastMinutes === undefined) return advisory;
  // A clock value after midnight belongs to the following wall-clock day when
  // it is earlier than the first departure (e.g. 05:30 → 00:30 = 24:30).
  if (firstMinutes !== undefined && lastMinutes < firstMinutes) lastMinutes += 24 * 60;

  const today = localDate(now, advisory.timezone);
  const queryMinutes = selectedTime && validClock(selectedTime)
    ? clockMinutes(selectedTime)
    : advisory.serviceDate === today
      ? localClockMinutes(now, advisory.timezone)
      : advisory.serviceDate > today ? 0 : 24 * 60;
  const minutesToLastDeparture = lastMinutes - queryMinutes;
  const risk = serviceDayRisk(minutesToLastDeparture);
  return {
    ...advisory,
    risk,
    minutesToLastDeparture,
    checkedAt: new Date(now).toISOString(),
  };
}
