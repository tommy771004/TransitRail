import type { TFunction } from "i18next";
import i18n from "../i18n";
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

/**
 * One plain sentence a passenger can act on.
 *
 * This used to build its own strings, in Chinese or English only, out of the
 * raw values it happened to be holding: the internal service-day enum
 * ("Service day changed from weekday to saturday"), an ISO date, and a signed
 * delta in brackets. That is a diff, not a notification. Everything user-facing
 * now goes through i18next in the reader's own locale, and the values are
 * spoken the way the rest of the app speaks them.
 */
export function describeFingerprintChange(before: TimetableFingerprint, after: TimetableFingerprint, t: TFunction): string | undefined {
  // `getFixedT` renders a locale without switching the app to it, so read the
  // locale off the `t` we were handed rather than off the global instance.
  const locale = (t as TFunction & { lng?: string }).lng || i18n.language;

  if (before.serviceDate && after.serviceDate && before.serviceDate !== after.serviceDate) {
    return t("timetable_change.service_date", { date: friendlyDate(after.serviceDate, locale) });
  }
  if (before.serviceDayType && after.serviceDayType && before.serviceDayType !== after.serviceDayType) {
    // The enum is a key, never a label: `sunday_holiday` reads as a variable
    // name to everyone except the person who wrote it.
    return t("timetable_change.service_day", { type: t(`service_day.type.${after.serviceDayType}`) });
  }
  if (before.last && after.last && before.last !== after.last) {
    return t("timetable_change.last_service", { time: after.last, previous: before.last });
  }
  if (before.first && after.first && before.first !== after.first) {
    return t("timetable_change.first_service", { time: after.first, previous: before.first });
  }
  if (before.departures !== after.departures) {
    const difference = after.departures - before.departures;
    return difference > 0
      ? t("timetable_change.more_departures", { count: difference })
      : t("timetable_change.fewer_departures", { count: -difference });
  }
  return undefined;
}

/** A service date is read as a day, not parsed as a field: "9月8日", not
 *  "2026-09-08". Falls back to the stored value if it is not a real date. */
function friendlyDate(value: string, locale: string): string {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

export function describeTimetableChange(previous: TransitResult[], current: TransitResult[], t: TFunction): string | undefined {
  return describeFingerprintChange(timetableFingerprint(previous), timetableFingerprint(current), t);
}
