import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { TransitResult } from "../types";
import { CountryResultsView } from "./CountryResultsView";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

const base: TransitResult = {
  id: "official-trip", country: "japan", operator: "Official operator", service: "Service",
  origin: "A", destination: "B", departureTime: "10:00", direct: true, stops: [],
};

function render(trip: TransitResult, formatPrice?: (trip: TransitResult) => string | null) {
  return renderToStaticMarkup(<CountryResultsView
    country={trip.country} origin={trip.origin} destination={trip.destination} date="2026-09-13"
    results={[trip]} savedIds={new Set()} sortMode="earliest" koreaFilter="all"
    onSortChange={() => {}} onKoreaFilterChange={() => {}} onModify={() => {}}
    onSave={() => {}} onSelectSeat={() => {}} formatPrice={formatPrice}
  />);
}

describe.each(["japan", "korea", "hong_kong", "united_kingdom"] as const)("%s fare visibility", country => {
  it.each([{}, { price: 100 }, { price: NaN, currency: "JPY" }, { price: -1, currency: "JPY" }])("omits absent or invalid fare blocks without a placeholder", fare => {
    const formatter = vi.fn(() => "FORMATTED-FARE");
    const html = render({ ...base, country, ...fare }, formatter);
    expect(html).not.toContain("FORMATTED-FARE");
    expect(html).not.toContain("Fare for this service");
    expect(html).not.toContain(i18n.t("result.fare_unavailable"));
    expect(html).not.toMatch(/class="m3-chip m3-title-small[^>]*><\/span>/);
    expect(formatter).not.toHaveBeenCalled();
  });

  it.each([0, 1200])("keeps a provided fare of %s and the currency display formatter", price => {
    const html = render({ ...base, country, price, currency: "JPY" }, () => "FORMATTED-FARE");
    expect(html).toContain("FORMATTED-FARE");
    expect(html).toContain("Fare for this service");
  });

  it("falls back to the provided amount when the optional formatter has no result", () => {
    const html = render({ ...base, country, price: 1200, currency: "JPY" }, () => null);
    expect(html).toContain("Fare for this service");
    expect(html).toContain("1200 JPY");
    expect(html).not.toMatch(/class="m3-chip m3-title-small[^>]*><\/span>/);
  });
});
