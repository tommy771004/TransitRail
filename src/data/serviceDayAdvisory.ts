import type { ServiceDayAdvisory } from "../types";

const COVERAGES = new Set(["supported", "partial", "stale", "unavailable"]);
const DAY_TYPES = new Set(["weekday", "saturday", "sunday_holiday", "special"]);
const RISKS = new Set(["safe", "approaching", "critical", "missed", "unavailable"]);

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
  return advisory as ServiceDayAdvisory;
}
