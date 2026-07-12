import type { TransitResult } from "../types";

export interface TimetableFingerprint {
  first?: string;
  last?: string;
  departures: number;
}

export function timetableFingerprint(results: TransitResult[]): TimetableFingerprint {
  let first: string | undefined;
  let last: string | undefined;
  for (const result of results) {
    const departure = result.departureTime;
    if (!departure) continue;
    if (!first || departure < first) first = departure;
    if (!last || departure > last) last = departure;
  }
  return { first, last, departures: results.length };
}

/** Compares two already-computed fingerprints — e.g. a fingerprint persisted
 *  from a previous check against one derived from a fresh scrape — without
 *  needing the original TransitResult[] arrays on hand. */
export function describeFingerprintChange(before: TimetableFingerprint, after: TimetableFingerprint, isChinese: boolean): string | undefined {
  if (before.last && after.last && before.last !== after.last) {
    return isChinese
      ? `末班車由 ${before.last} 調整為 ${after.last}。`
      : `Last service changed from ${before.last} to ${after.last}.`;
  }
  if (before.first && after.first && before.first !== after.first) {
    return isChinese
      ? `首班車由 ${before.first} 調整為 ${after.first}。`
      : `First service changed from ${before.first} to ${after.first}.`;
  }
  if (before.departures !== after.departures) {
    const difference = after.departures - before.departures;
    return isChinese
      ? `班次由 ${before.departures} 班調整為 ${after.departures} 班（${difference > 0 ? "+" : ""}${difference}）。`
      : `Departures changed from ${before.departures} to ${after.departures} (${difference > 0 ? "+" : ""}${difference}).`;
  }
  return undefined;
}

export function describeTimetableChange(previous: TransitResult[], current: TransitResult[], isChinese: boolean): string | undefined {
  return describeFingerprintChange(timetableFingerprint(previous), timetableFingerprint(current), isChinese);
}
