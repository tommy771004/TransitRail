import type { AppAlert, AppAlertCategory, Country, TransitSituation } from "../types";
import { configuredCountryOptions } from "../data/countries";
import { isCalendarDate } from "../data/serviceRegionCatalog";
import type { TFunction } from "i18next";
import { describeFingerprintChange } from "./timetableChanges";
import { stationLabel } from "./stationLabel";

export const MAX_USER_ALERTS = 100;
export const ALERT_RETENTION_MS = 90 * 86400000;
const textValue = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const timeValue = (v: unknown) => typeof v === "string" && /^(?:[01]\d|2[0-9]):[0-5]\d$/.test(v);
function validFingerprint(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  return Number.isInteger(f.departures) && Number(f.departures) >= 0
    && (f.first === undefined || timeValue(f.first)) && (f.last === undefined || timeValue(f.last))
    && (f.serviceDate === undefined || isCalendarDate(f.serviceDate))
    && (f.serviceDayType === undefined || ["weekday", "saturday", "sunday_holiday"].includes(String(f.serviceDayType)))
    && (f.coverage === undefined || ["supported", "partial"].includes(String(f.coverage)));
}
function validEvent(alert: AppAlert): boolean {
  const event = alert.event;
  if (!event || !alert.country || !textValue(event.origin) || !textValue(event.destination) || event.kind !== alert.category) return false;
  return event.kind === "departure" ? textValue(event.service) && timeValue(event.time)
    : event.kind === "timetable" && validFingerprint(event.before) && validFingerprint(event.after);
}

export function renderTransitAlert(alert: AppAlert, t: TFunction): { title: string; body: string } {
  const event = alert.event;
  if (!event) return alert;
  const route = `${stationLabel(t, event.origin, alert.country)} → ${stationLabel(t, event.destination, alert.country)}`;
  return event.kind === "departure"
    ? { title: t("alerts.departure_approaching", { service: event.service }), body: `${route}\n${t("alerts.departure_approaching_body", { time: event.time })}` }
    : { title: t("alerts.timetable_updated"), body: `${route}\n${describeFingerprintChange(event.before, event.after, t) ?? ""}` };
}

export function saveJsonSafely(key: string, value: unknown, storage?: Pick<Storage, "setItem">): boolean {
  try { (storage ?? window.localStorage).setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function persistTransitAlerts(alerts: unknown, storage?: Storage): boolean {
  try {
    const target = storage ?? window.localStorage;
    if (!saveJsonSafely("transitrail.alerts.user-v2", migrateTransitAlerts(alerts), target)) return false;
    target.removeItem("transitrail.alerts");
    return true;
  } catch { return false; }
}

const USER_ALERT_CATEGORIES = new Set<AppAlertCategory>(["timetable", "departure"]);
const CONFIGURED_COUNTRIES = new Set<Country>(configuredCountryOptions);

// Frozen strings from the unversioned alert format. They are deliberately kept
// here instead of reading today's translations: migration must continue to
// recognise what an older build actually wrote after copy changes later.
const LEGACY_TIMETABLE_TITLES = new Set([
  "Timetable updated",
  "時刻表已更新",
  "時刻表が更新されました",
  "시각표가 업데이트되었습니다",
]);
const LEGACY_DEPARTURE_TITLE_PREFIXES = [
  "Departure approaching: ",
  "即將出發：",
  "まもなく出発：",
  "곧 출발: ",
];

/**
 * What the notifications page is allowed to carry.
 *
 * The page had become a log of everything the app did: raw provider error text,
 * offline-cache notices, browser-permission results, and a receipt for every
 * tap ("Route added", "Seat preference saved"). None of that is transit
 * information, and burying two real notices under fifteen receipts is the same
 * as not showing them.
 */
function isStoredAlert(value: unknown): value is AppAlert {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const alert = value as Record<string, unknown>;
  return textValue(alert.id)
    && textValue(alert.title)
    && textValue(alert.body)
    && typeof alert.createdAt === "string"
    && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(alert.createdAt)
    && isCalendarDate(alert.createdAt.slice(0, 10)) && Number.isFinite(Date.parse(alert.createdAt))
    && (alert.category === undefined || USER_ALERT_CATEGORIES.has(alert.category as AppAlertCategory))
    && typeof alert.read === "boolean"
    && (alert.country === undefined || CONFIGURED_COUNTRIES.has(alert.country as Country));
}

export function migrateTransitAlerts(alerts: unknown, now = Date.now()): AppAlert[] {
  if (!Array.isArray(alerts)) return [];
  const seen = new Set<string>();
  return alerts.flatMap((alert): AppAlert[] => {
    if (!isStoredAlert(alert)) return [];
    const timestamp = Date.parse(alert.createdAt);
    if (timestamp > now || timestamp < now - ALERT_RETENTION_MS) return [];
    if (alert.event !== undefined) return validEvent(alert) ? [alert] : [];

    // The old format mixed passenger notices with provider errors, permission
    // state, cache state and tap receipts. Only migrate titles that an older
    // build used for the two passenger-facing transit events. Unknown entries
    // are intentionally dropped so IT and system text cannot reach the page.
    if (LEGACY_TIMETABLE_TITLES.has(alert.title)) {
      return [{ ...alert, category: "timetable" as const }];
    }
    if (LEGACY_DEPARTURE_TITLE_PREFIXES.some((prefix) => alert.title.startsWith(prefix))) {
      return [{ ...alert, category: "departure" as const }];
    }
    return [];
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter(alert => { if (seen.has(alert.id)) return false; seen.add(alert.id); return true; }).slice(0, MAX_USER_ALERTS);
}

/**
 * Provider service status for the networks this passenger actually travels on.
 *
 * The feed is every connected operator in every market, so an unfiltered page
 * showed someone searching Tokyo the London tube's severity and Boston's MBTA
 * alerts. A disruption on a network you have never opened is not information.
 */
export function situationsForCountries(
  situations: readonly TransitSituation[],
  countries: ReadonlySet<Country>,
): TransitSituation[] {
  return situations.filter((situation) => countries.has(situation.country));
}

type CountryRecord = { country: Country };

/** Markets represented by what the passenger is doing or has kept. */
export function countriesForSituationFeed(
  activeCountry: Country,
  savedTrips: readonly CountryRecord[],
  favorites: readonly CountryRecord[],
  history: readonly CountryRecord[],
): Set<Country> {
  return new Set([
    activeCountry,
    ...savedTrips.map((item) => item.country),
    ...favorites.map((item) => item.country),
    ...history.map((item) => item.country),
  ]);
}
