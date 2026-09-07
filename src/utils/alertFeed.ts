import type { AppAlert, Country, TransitSituation } from "../types";

/**
 * What the notifications page is allowed to carry.
 *
 * The page had become a log of everything the app did: raw provider error text,
 * offline-cache notices, browser-permission results, and a receipt for every
 * tap ("Route added", "Seat preference saved"). None of that is transit
 * information, and burying two real notices under fifteen receipts is the same
 * as not showing them.
 */
export function transitAlertsOnly(alerts: readonly AppAlert[]): AppAlert[] {
  // Entries stored before the page was scoped carry no category at all, so an
  // absent one is exactly the receipt this page stopped keeping.
  return alerts.filter((alert) => alert.category === "timetable" || alert.category === "departure");
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
