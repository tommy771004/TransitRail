import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { TransitResult } from "../types";
import { CountryResultsView, type CountryResultsViewProps } from "./CountryResultsView";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

const tsuenWan: TransitResult = {
  id: "twl-1402", country: "hong_kong", operator: "MTR", service: "Tsuen Wan Line",
  origin: "Central", destination: "Tsuen Wan", departureTime: "14:02", arrivalTime: "14:32",
  durationMinutes: 30, direct: true, stops: [], realtime: true, platform: "2", headsign: "Tsuen Wan",
  lineColor: "#e2231a",
  legs: [{
    lineName: "Tsuen Wan Line", lineCode: "TWL", origin: "Central", destination: "Tsuen Wan",
    departureTime: "14:02", arrivalTime: "14:32", platform: "2", headsign: "Tsuen Wan",
    upcomingDepartures: ["14:05", "14:08"],
  }],
};

// Pinned to the searched day on the Hong Kong clock.
const at = (clock: string) => () => new Date(`2026-10-15T${clock}:00+08:00`);

const base: CountryResultsViewProps = {
  country: "hong_kong", origin: "Central", destination: "Tsuen Wan", date: "2026-10-15",
  now: at("14:00"), results: [tsuenWan], savedIds: new Set(), sortMode: "earliest", koreaFilter: "all",
  onSortChange: vi.fn(), onKoreaFilterChange: vi.fn(), onModify: vi.fn(), onSave: vi.fn(), onSelectSeat: vi.fn(),
};
const render = (props: Partial<CountryResultsViewProps> = {}) =>
  renderToStaticMarkup(<CountryResultsView {...base} {...props} />);

describe("live next departure", () => {
  it("reads as a platform board: line badge, direction, platform, flap countdown and later trains", () => {
    const html = render();
    expect(html).toContain("data-live-departure");
    expect(html).toContain("data-split-flap");
    expect(html).toContain("Departs in 2 min");
    expect(html).toContain(">TWL<");
    expect(html).toContain("Towards");
    expect(html).toContain("14:05 · 14:08");
  });

  it("keeps the text countdown for a timetable departure", () => {
    const html = render({ results: [{ ...tsuenWan, realtime: false }] });
    expect(html).not.toContain("data-split-flap");
    expect(html).toContain("Departs in 2 min");
  });

  it("lets a delay replace the countdown", () => {
    const html = render({ results: [{ ...tsuenWan, delayMinutes: 4 }] });
    expect(html).not.toContain("data-split-flap");
    expect(html).toContain("+4");
  });

  it("does not flap a departure more than 99 minutes away", () => {
    const html = render({ now: at("12:00") });
    expect(html).not.toContain("data-split-flap");
  });
});
