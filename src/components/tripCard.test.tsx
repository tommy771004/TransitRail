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

// The wall clock is pinned to the searched day in London so the countdown and
// the departed fold are deterministic whatever day the suite runs on.
const at = (clock: string) => () => new Date(`2026-09-22T${clock}:00+01:00`);

const base: CountryResultsViewProps = {
  country: "united_kingdom", origin: elizabeth.origin, destination: elizabeth.destination, date: "2026-09-22",
  now: at("09:00"),
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

    // A fare only some rows carry stays on those rows; it is never hidden.
    const partial = render({ results: [elizabeth, { ...elizabeth, id: "eliz-2" }, { ...elizabeth, id: "unfared", price: undefined, currency: undefined }] });
    expect(partial.match(/data-trip-fare-row/g)).toHaveLength(2);
    expect(partial).not.toContain("Fare for every departure");
  });

  it("badges the next departure, the fastest and the cheapest relative to the result set", () => {
    const html = render({ time: "10:00", now: at("10:00") });
    const next = html.indexOf(">Next<");
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(html.indexOf("10:06"));
    expect(html).toContain(">Fastest<");
    expect(html).toContain(">Cheapest<");
    expect(html).toContain("Departs in 6 min");
    // One journey shares the fastest time with nothing, so there is no badge to hand out.
    expect(render({ results: [elizabeth] })).not.toContain(">Fastest<");
    // Next, fastest and cheapest can all land on one card; none hides another.
    expect(render({ results: [piccadilly, { ...elizabeth, departureTime: "10:30", arrivalTime: "11:09" }] })).toContain(">Cheapest<");
    // Another day gets no countdown: the searched time only picks the next departure.
    const tomorrow = render({ date: "2026-09-23", time: "10:00" });
    expect(tomorrow).not.toContain("Departs in");
    expect(tomorrow).toContain(">Next<");
  });

  it("names the change, its wait and its pressure on a transfer card", () => {
    const html = render();
    expect(html).toContain("Change at Piccadilly Circus to Bakerloo · 3 min wait");
    expect(html).toContain("Very short connection");
    expect(html).toContain("Direct · 8 stops");
    expect(html).toContain("On time");
    // Live status sits beside the platform, never in place of it.
    const platformed = render({ results: [{ ...elizabeth, platform: "2" }] });
    expect(platformed).toMatch(/Plat(form)? 2<\/span><span[^>]*>On time/);
  });

  it("folds departed trips behind one line instead of listing them", () => {
    const html = render({ now: at("10:07") });
    expect(html).toContain("1 departed");
    expect(html).not.toContain("Elizabeth line</h2>");
    expect(render({ now: at("10:00") })).not.toContain("departed");
    // A snapshot of another day never folds: the wall clock says nothing about it.
    expect(render({ date: "2026-09-21", now: at("23:00") })).not.toContain("departed");
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

  it("heads a long day by hour, and offers a jump only to hours that have rows", () => {
    const at10 = Array.from({ length: 15 }, (_, i) => ({ ...elizabeth, id: `ten-${i}`, departureTime: `10:${String(i * 2).padStart(2, "0")}`, arrivalTime: "13:30" }));
    const at12 = Array.from({ length: 15 }, (_, i) => ({ ...elizabeth, id: `noon-${i}`, departureTime: `12:${String(i * 2).padStart(2, "0")}`, arrivalTime: "13:30" }));
    const html = render({ results: [...at10, ...at12] });
    expect(html.match(/id="[^"]*-hour-\d+"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Jump to hour"');
    // No row at 11, so no heading and no jump: a gap is not a claim about service.
    expect(html).not.toContain("11:00");
    // A short list needs neither.
    expect(render()).not.toContain("-hour-");
  });

  it("counts down every departure within the hour, not only the next", () => {
    const html = render({ now: at("10:00") });
    expect(html).toContain("Departs in 6 min");
    expect(html).toContain("Departs in 7 min");
    // A delay replaces the countdown rather than contradicting it.
    const late = render({ now: at("10:00"), results: [{ ...elizabeth, delayMinutes: 4 }] });
    expect(late).toContain("+4");
    expect(late).not.toContain("Departs in");
  });

  it("says when every listed departure has left and never badges a departed train as next", () => {
    const html = render({ now: at("11:30") });
    expect(html).toContain("Every listed departure has left");
    expect(html).toContain("10:07.");
    expect(html).not.toContain(">Next<");
  });

  it("offers one sort rail for every market, hidden when there is nothing to sort", () => {
    for (const country of ["japan", "korea", "hong_kong", "united_kingdom"] as const) {
      const trip = { ...elizabeth, country };
      expect(render({ country, results: [trip] })).toContain('aria-label="Sort"');
      expect(render({ country, results: [] })).not.toContain('aria-label="Sort"');
    }
  });
});
