import type { ServiceDayAdvisory, TransitResult } from "../types";

export interface TimetableFingerprint {
  first?: string;
  last?: string;
  departures: number;
  serviceDate?: string;
  serviceDayType?: ServiceDayAdvisory["serviceDayType"];
  coverage?: "supported" | "partial";
}

export function timetableFingerprint(results: TransitResult[], advisory?: ServiceDayAdvisory): TimetableFingerprint {
  let first: string | undefined;
  let last: string | undefined;
  for (const result of results) {
    const departure = result.departureTime;
    if (!departure) continue;
    if (!first || departure < first) first = departure;
    if (!last || departure > last) last = departure;
  }
  const comparableCoverage = advisory?.coverage === "supported" || advisory?.coverage === "partial"
    ? advisory.coverage
    : undefined;
  const comparableAdvisory = comparableCoverage ? advisory : undefined;
  return {
    first: advisory ? comparableAdvisory?.firstDeparture : first,
    last: advisory ? comparableAdvisory?.lastDeparture : last,
    departures: results.length,
    serviceDate: comparableAdvisory?.serviceDate,
    serviceDayType: comparableAdvisory?.serviceDayType,
    coverage: comparableCoverage,
  };
}

/** Compares two already-computed fingerprints — e.g. a fingerprint persisted
 *  from a previous check against one derived from a fresh scrape — without
 *  needing the original TransitResult[] arrays on hand. */
export function describeFingerprintChange(before: TimetableFingerprint, after: TimetableFingerprint, isChinese: boolean): string | undefined {
  if (before.serviceDate && after.serviceDate && before.serviceDate !== after.serviceDate) {
    return isChinese
      ? `服務日期由 ${before.serviceDate} 調整為 ${after.serviceDate}。`
      : `Service date changed from ${before.serviceDate} to ${after.serviceDate}.`;
  }
  if (before.serviceDayType && after.serviceDayType && before.serviceDayType !== after.serviceDayType) {
    return isChinese
      ? `服務日由 ${before.serviceDayType} 調整為 ${after.serviceDayType}。`
      : `Service day changed from ${before.serviceDayType} to ${after.serviceDayType}.`;
  }
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
