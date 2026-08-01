import type { Country, TransitResult } from "../types";
import { resolveStationAlias } from "./stationAliases";
import { stationSearchKey } from "./stationKey";

/**
 * The shortest connection that can be represented as a safe itinerary.
 *
 * This is intentionally a floor, not an estimate of a typical walk. A route
 * planner may return a longer wait, but it must never promise a connection
 * below this value when the timetable has no platform-level walking data.
 */
export const DEFAULT_MIN_TRANSFER_MINUTES = 3;

const countryDefaults: Partial<Record<Country, number>> = {
  japan: 5,
  korea: 3,
  hong_kong: 5,
  singapore: 4,
  thailand: 4,
  united_kingdom: 5,
  united_states: 4,
};

/**
 * Known large interchanges get a more conservative floor. The table uses
 * station aliases through getMinimumTransferMinutes(), so a menu spelling and
 * an operator spelling resolve to the same rule.
 */
const stationMinimums: Partial<Record<Country, Record<string, number>>> = {
  korea: {
    "seoul station": 5,
    "seoul (snc)": 5,
    "jongno 3-ga": 5,
    "dongdaemun history & culture park": 5,
    "express bus terminal": 5,
    sadang: 4,
    chungmuro: 4,
    yeouido: 4,
  },
  hong_kong: {
    admiralty: 5,
    central: 5,
    "tsim sha tsui": 5,
    "east tsim sha tsui": 5,
    "kowloon tong": 5,
    "lai king": 5,
  },
  singapore: {
    "tanah merah": 4,
    "dhoby ghaut": 5,
    "city hall": 4,
    "raffles place": 4,
  },
  thailand: {
    "mo chit": 5,
    chatuchak: 5,
    sukhumvit: 5,
    asok: 5,
    "si lom": 5,
    "sala daeng": 5,
  },
  united_states: {
    "south station": 5,
    "park street": 4,
    "downtown crossing": 4,
    "government center": 4,
  },
};

export function getMinimumTransferMinutes(country: Country | undefined, station: string): number {
  const canonical = resolveStationAlias(country, station);
  const key = stationSearchKey(canonical);
  // An unknown country gets the documented floor, never another market's rules:
  // borrowing Japan's table here silently applied Japanese interchange minimums
  // to callers that had no country at all.
  if (country === undefined) return DEFAULT_MIN_TRANSFER_MINUTES;
  return stationMinimums[country]?.[key]
    ?? countryDefaults[country]
    ?? DEFAULT_MIN_TRANSFER_MINUTES;
}

function normalizedOperator(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

/** True only when every leg identifies the same non-empty operator. */
export function isSameOperator(operators: Array<string | undefined>): boolean {
  const normalized = operators.map(normalizedOperator).filter(Boolean);
  return normalized.length === operators.length && new Set(normalized).size === 1;
}

export const SAME_OPERATOR_FARE_WARNING =
  "Fare for a transfer within one operator is not added; confirm the fare with the operator.";

export function sameOperatorFareWarning(results: TransitResult[]): string | undefined {
  if (results.length < 2 || !isSameOperator(results.map((result) => result.operator))) {
    return undefined;
  }
  return SAME_OPERATOR_FARE_WARNING;
}

/**
 * Intercity legs can be added when each leg carries a fare. For a transfer
 * inside one operator the individual values are often products of the same
 * flat-fare system, so returning a sum would overstate the price. In that
 * case the honest value is undefined plus the explicit warning above.
 */
export function aggregateTransferFare(results: TransitResult[]): number | undefined {
  if (results.length === 0) return undefined;
  if (results.length === 1) return results[0].price;
  if (isSameOperator(results.map((result) => result.operator))) return undefined;
  if (!results.every((result) => result.price != null)) return undefined;
  return results.reduce((sum, result) => sum + result.price!, 0);
}
