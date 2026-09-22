import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { TransitResult } from "../types";
import { CountryResultsView, type CountryResultsViewProps } from "./CountryResultsView";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

const elizabeth: TransitResult = {
  id: "eliz", country: "united_kingdom", operator: "TfL", service: "Elizabeth line",
  origin: "Heathrow Terminals 2 & 3", destination: "Oxford Circus", departureTime: "10:06", arrivalTime: "10:45",
  durationMinutes: 39, price: 15.5, currency: "GBP", direct: true, stops: ["a", "b", "c", "d", "e", "f", "g", "h"],
  lineColor: "#6950A1", realtime: true, delayMinutes: 0,
};
const piccadilly: TransitResult = {
  id: "picc", country: "united_kingdom", operator: "TfL", service: "Piccadilly + Bakerloo",
  origin: "Heathrow Terminals 2 & 3", destination: "Oxford Circus", departureTime: "10:07", arrivalTime: "10:58",
  durationMinutes: 51, price: 5.9, currency: "GBP", direct: false, stops: [],
  transferStations: ["Piccadilly Circus"],
  legs: [
    { lineName: "Piccadilly", origin: "Heathrow Terminals 2 & 3", destination: "Piccadilly Circus", departureTime: "10:07", arrivalTime: "10:53", color: "#003688" },
    { lineName: "Bakerloo", origin: "Piccadilly Circus", destination: "Oxford Circus", departureTime: "10:56", arrivalTime: "10:58", color: "#B36305" },
  ],
};

const base: CountryResultsViewProps = {
  country: "united_kingdom", origin: elizabeth.origin, destination: elizabeth.destination, date: "2026-09-22",
  results: [elizabeth, piccadilly], savedIds: new Set(), sortMode: "earliest", koreaFilter: "all",
  onSortChange: vi.fn(), onKoreaFilterChange: vi.fn(), onModify: vi.fn(), onSave: vi.fn(), onSelectSeat: vi.fn(),
};
const render = (props: Partial<CountryResultsViewProps> = {}) =>
  renderToStaticMarkup(<CountryResultsView {...base} {...props} />);

describe("result card", () => {
  it("shows a fare on each row only when fares differ, otherwise one shared line", () => {
    const differing = render();
    expect(differing.match(/data-trip-fare-row/g)).toHaveLength(2);
    expect(differing).not.toContain("Fare for every departure");

    const shared = render({ results: [elizabeth, { ...elizabeth, id: "eliz-2", departureTime: "10:21", arrivalTime: "11:00" }] });
    expect(shared).not.toContain("data-trip-fare-row");
    expect(shared.match(/Fare for every departure/g)).toHaveLength(1);

    const cheapestFirst = render({ results: [elizabeth, { ...elizabeth, id: "eliz-2" }], sortMode: "cheapest" });
    expect(cheapestFirst.match(/data-trip-fare-row/g)).toHaveLength(2);
  });

  it("badges the next departure, the fastest and the cheapest relative to the result set", () => {
    const html = render({ time: "10:00" });
    const next = html.indexOf(">Next<");
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(html.indexOf("10:06"));
    expect(html).toContain(">Fastest<");
    expect(html).toContain(">Cheapest<");
    expect(html).toContain("Departs in 6 min");
    // One journey shares the fastest time with nothing, so there is no badge to hand out.
    expect(render({ results: [elizabeth] })).not.toContain(">Fastest<");
  });

  it("names the change, its wait and its pressure on a transfer card", () => {
    const html = render();
    expect(html).toContain("Change at Piccadilly Circus to Bakerloo · 3 min wait");
    expect(html).toContain("Very short connection");
    expect(html).toContain("Direct · 8 stops");
    expect(html).toContain("On time");
  });

  it("folds departed trips behind one line instead of listing them", () => {
    const html = render({ time: "10:07" });
    expect(html).toContain("1 departed");
    expect(html).not.toContain("Elizabeth line</h2>");
    expect(render({ time: "10:00" })).not.toContain("departed");
  });

  it("keeps the fixed columns from shrinking and the band from pushing the arrival off the card", () => {
    const html = render();
    expect(html).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(html).toMatch(/ml-auto flex shrink-0 items-baseline gap-2 whitespace-nowrap/);
    expect(html).toMatch(/<article[^>]*min-w-0 overflow-hidden/);
    // A 2-minute hop is 4% of the band: its label is hidden, not clipped.
    expect(html).toMatch(/invisible"[^>]*>Bakerloo</);
  });

  it("opens the details as a closed sheet the card controls", () => {
    const html = render({ results: [elizabeth] });
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/);
    expect(html).toMatch(/<div hidden=""[^>]*data-trip-sheet/);
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
    expect(html).not.toContain("Trip details &amp; timeline");
  });

  it("offers one sort rail for every market, hidden when there is nothing to sort", () => {
    for (const country of ["japan", "korea", "hong_kong", "united_kingdom"] as const) {
      const trip = { ...elizabeth, country };
      expect(render({ country, results: [trip] })).toContain('aria-label="Sort"');
      expect(render({ country, results: [] })).not.toContain('aria-label="Sort"');
    }
  });
});
