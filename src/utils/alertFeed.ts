import type { AppAlert, AppAlertCategory, Country, TransitSituation } from "../types";
import { configuredCountryOptions } from "../data/countries";

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
  return typeof alert.id === "string"
    && typeof alert.title === "string"
    && typeof alert.body === "string"
    && typeof alert.createdAt === "string"
    && typeof alert.read === "boolean"
    && (alert.country === undefined || CONFIGURED_COUNTRIES.has(alert.country as Country));
}

export function migrateTransitAlerts(alerts: unknown): AppAlert[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.flatMap((alert) => {
    if (!isStoredAlert(alert)) return [];
    if (alert.category && USER_ALERT_CATEGORIES.has(alert.category)) return [alert];

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
  });
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
