import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import type { MtrStationBoard } from "../server/hongKongMtr";
import { StationBoardView, boardMinutes } from "./StationBoard";
import { CountryResultsView } from "./CountryResultsView";

vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
beforeAll(async () => { await i18n.changeLanguage("en"); });

const now = new Date("2026-10-15T14:00:00+08:00");
const at = (clock: string, platform?: string) => ({ at: `2026-10-15T${clock}:00+08:00`, platform });

const central: MtrStationBoard = {
  station: "Central",
  checkedAt: now.toISOString(),
  source: "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php",
  lines: [
    {
      code: "ISL", name: "Island Line", color: "#0075C2", delayed: false, unavailable: false,
      groups: [
        { direction: "UP", destination: "Chai Wan", departures: [at("14:02", "2"), at("14:05", "1"), at("14:08", "2"), at("14:12", "2")] },
        { direction: "DOWN", destination: "Kennedy Town", departures: [at("13:50", "1")] },
      ],
    },
    { code: "TWL", name: "Tsuen Wan Line", color: "#E2231A", delayed: true, unavailable: true, groups: [] },
  ],
};

const render = (lineCode?: string, board = central) =>
  renderToStaticMarkup(<StationBoardView board={board} now={now} lineCode={lineCode} onLineChange={vi.fn()} />);

describe("station board", () => {
  it("counts whole minutes and drops trains that have gone", () => {
    expect(boardMinutes([at("13:58"), at("13:59"), at("14:00"), at("14:07")], now).map((departure) => departure.minutes)).toEqual([0, 0, 7]);
  });

  it("shows each direction with a flap countdown and the later trains", () => {
    const html = render();
    expect(html).toContain("Towards Chai Wan");
    expect(html).toContain("Platform 2");
    expect(html).not.toContain("Platform 1");
    expect(html).toContain("data-split-flap");
    expect(html).toContain("5 · 8 · 12");
    // Kennedy Town's only train has left; its row is gone, not shown as zero.
    expect(html).not.toContain("Kennedy Town");
    expect(html.match(/data-board-group/g)).toHaveLength(1);
  });

  it("offers every line at an interchange as a pressed toggle", () => {
    const html = render();
    expect(html).toContain('aria-pressed="true" aria-label="Island Line"');
    expect(html).toContain('aria-pressed="false" aria-label="Tsuen Wan Line"');
  });

  it("says a silent feed is no live data, never no service", () => {
    const html = render("TWL");
    expect(html).toContain("live feed did not respond");
    expect(html).toContain("does not mean there is no service");
    expect(html).not.toContain("data-board-group");
  });

  it("says when every train on the line has gone from the feed", () => {
    const html = render(undefined, { ...central, lines: [{ ...central.lines[0], groups: [central.lines[0].groups[1]] }] });
    expect(html).toContain("No live data right now");
  });

  it("is reachable from Hong Kong results only", () => {
    const props = {
      origin: "Central", destination: "Tsuen Wan", date: "2026-10-15", results: [], savedIds: new Set<string>(),
      sortMode: "earliest" as const, koreaFilter: "all" as const, onSortChange: vi.fn(), onKoreaFilterChange: vi.fn(),
      onModify: vi.fn(), onSave: vi.fn(), onSelectSeat: vi.fn(), onOpenBoard: vi.fn(),
    };
    expect(renderToStaticMarkup(<CountryResultsView country="hong_kong" {...props} />)).toContain("data-board-entry");
    expect(renderToStaticMarkup(<CountryResultsView country="singapore" {...props} />)).not.toContain("data-board-entry");
  });
});
