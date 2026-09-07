import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { renderMissBlock } from "./ResultShell";
import { CountryResultsView, type CountryResultsViewProps } from "./CountryResultsView";
import { SearchForm } from "./SearchForm";

// Leaflet requires a browser; these regressions exercise search feedback, not maps.
vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));

beforeAll(async () => { await i18n.changeLanguage("en"); });

const miss = {
  message: "Query detail", country: "japan" as const, errorTitle: "Unable to fetch",
  onModify: vi.fn(), onRetry: vi.fn(), sourceUrl: "https://example.com/timetable",
};

describe("search recovery", () => {
  it("offers retry only for a fetch failure and preserves the actual callbacks", () => {
    const node = renderMissBlock(miss);
    const html = renderToStaticMarkup(node);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry search");
    const actions = node.props.children[1].props.children;
    actions[0].props.onClick();
    actions[1].props.onClick();
    expect(miss.onRetry).toHaveBeenCalledOnce();
    expect(miss.onModify).toHaveBeenCalledOnce();
  });
  it.each(["unsupported_route", "no_verified_data", "future_date_unavailable", "no_service"] as const)("%s is not a fetch error", (reason) => {
    const html = renderToStaticMarkup(renderMissBlock({ ...miss, reason }));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Retry search");
    expect(html).not.toContain("Unable to fetch");
    expect(html).toContain("Change stations or date");
    expect(html).toContain(miss.sourceUrl);
  });
  it("does not retry a catalog gap", () => {
    const html = renderToStaticMarkup(renderMissBlock({ ...miss, coverageGap: { uncovered: ["Unknown"], suggestions: [] } }));
    expect(html).not.toContain("Retry search");
    expect(html).toContain("Change stations or date");
  });
});

const resultProps: CountryResultsViewProps = {
  country: "japan", origin: "Asakusa", destination: "Shimbashi", date: "2026-09-06",
  error: "No verified data", noResultReason: "no_verified_data", results: [], savedIds: new Set(),
  sortMode: "earliest", koreaFilter: "all", onSortChange: vi.fn(), onKoreaFilterChange: vi.fn(),
  onModify: vi.fn(), onSave: vi.fn(), onSelectSeat: vi.fn(),
};

describe("source hierarchy and completeness", () => {
  it.each(["japan", "korea", "singapore", "united_kingdom"] as const)("wires recovery through the %s result view", (country) => {
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} country={country} noResultReason={undefined} onRetry={vi.fn()} />);
    expect(html).toContain("Retry search");
    expect(html).toContain("Change stations or date");
  });
  it.each([
    ["sampled-service-day", "Selected departures only"],
    ["bounded-upcoming", "Live upcoming departures only"],
    [undefined, "Timetable completeness is not confirmed"],
    ["full-day", "Full timetable"],
  ] as const)("labels %s without assuming completeness", (temporalCoverage, label) => {
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} dataStatus={{ kind: "snapshot", source: "Test operator", sourceUrl: "https://example.com", completeness: "full-timetable", temporalCoverage }} />);
    expect(html).toContain(label);
    if (temporalCoverage !== "full-day") expect(html).not.toContain("Full timetable");
    expect(html.indexOf("<main")).toBeLessThan(html.indexOf("Test operator"));
    expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf("Test operator"));
  });
});

it("keeps an unavailable requested date visible instead of silently selecting today", () => {
  const noop = vi.fn();
  const html = renderToStaticMarkup(<SearchForm
    params={{ country: "japan", origin: "Asakusa", destination: "Shimbashi", date: "2099-01-01" }}
    isSearching={false} recentHistory={[]} favorites={[]}
    onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
    onChange={noop} onSearch={async () => {}} onOpenStations={noop} onOpenWorkflow={noop}
    onRepeatSearch={noop} onTogglePinHistory={noop}
  />);
  expect(html).toContain("2099-01-01 is outside the currently offered dates");
  // No day in the rail may render selected — the M3 date chip's class opens
  // with the shape/state tokens, so this tracks that prefix.
  expect(html).not.toContain('aria-pressed="true" class="m3-card m3-state');
  expect(noop).not.toHaveBeenCalled();
});
