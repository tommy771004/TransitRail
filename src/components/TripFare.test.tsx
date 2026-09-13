import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { TripFareContent } from "./TripFare";
import type { TransitResult } from "../types";
import type { OfficialFare } from "../utils/officialFares";

beforeAll(async () => { await i18n.changeLanguage("en"); });
const trip: TransitResult = { id: "x", country: "hong_kong", operator: "MTR", service: "Tsuen Wan Line", origin: "Central", destination: "Admiralty", departureTime: "10:00", direct: true, stops: [] };
const fare: OfficialFare = { amount: 5, currency: "HKD", labelZh: "成人・單程票", labelEn: "Adult · Single Journey Ticket", publisher: "MTR", sourceUrl: "https://opendata.mtr.com.hk/data/mtr_lines_fares.csv" };

it("omits the entire block without a matched fare, including reminders", () => {
  expect(renderToStaticMarkup(<TripFareContent trip={trip} />)).toBe("");
});
it("uses the current currency formatter for a matched fare without changing the trip", () => {
  const before = structuredClone(trip);
  const formatter = vi.fn(() => "NT$20");
  const html = renderToStaticMarkup(<TripFareContent trip={trip} fare={fare} formatPrice={formatter} />);
  expect(formatter).toHaveBeenCalledWith({ ...trip, price: 5, currency: "HKD" });
  expect(html).toContain("NT$20");
  expect(html).toContain("Adult · Single Journey Ticket");
  expect(html).toContain(fare.sourceUrl);
  expect(trip).toEqual(before);
});
it("prefers the existing provider quote and shows only one fare block", () => {
  const html = renderToStaticMarkup(<TripFareContent trip={{ ...trip, price: 3, currency: "HKD" }} fare={fare} />);
  expect(html).toContain("3 HKD");
  expect(html).not.toContain("5 HKD");
  expect(html).not.toContain("Single Journey Ticket");
  expect(html.match(/data-trip-fare/g)).toHaveLength(1);
});
it("keeps the original currency if conversion is unavailable", () => {
  expect(renderToStaticMarkup(<TripFareContent trip={trip} fare={fare} formatPrice={() => null} />)).toContain("5 HKD");
});
