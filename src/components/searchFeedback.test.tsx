import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { renderMissBlock } from "./ResultShell";
import { CountryResultsView, type CountryResultsViewProps } from "./CountryResultsView";
import { SearchForm } from "./SearchForm";
import { countryConfig, providerDateValues } from "../data/countries";

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
  it("keeps a provider failure retryable even when the provider also reports no verified data", () => {
    const html = renderToStaticMarkup(renderMissBlock({
      ...miss,
      reason: "no_verified_data",
      failureKind: "provider_unavailable",
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry search");
    expect(html).toContain("Unable to fetch");
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
  it("keeps offline cache provenance visible beside the original timetable source", () => {
    const html = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      dataStatus={{ kind: "snapshot", source: "Test operator", sourceUrl: "https://example.com", completeness: "full-timetable" }}
      deliveryStatus={{ kind: "offline-cache", fetchedAt: "2026-09-13T01:23:00.000Z" }}
    />);
    expect(html).toContain("Offline cached result");
    expect(html).toContain('dateTime="2026-09-13T01:23:00.000Z"');
    expect(html).toContain("Test operator");
  });
  it("announces successful results and places the first trip before supplemental overview content", () => {
    const html = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      error={undefined}
      noResultReason={undefined}
      dataStatus={{ kind: "snapshot", source: "Test operator", sourceUrl: "https://example.com", completeness: "full-timetable" }}
      results={[{
        id: "first-trip",
        country: "japan",
        operator: "Test operator",
        service: "FIRST-TRIP-MARKER",
        departureTime: "10:00",
        arrivalTime: "12:00",
        origin: "Asakusa",
        destination: "Shimbashi",
        direct: true,
        stops: [],
      }]}
      overview={<div>OVERVIEW-MARKER</div>}
    />);
    expect(html).toContain("Found 1 verified departure");
    expect(html.indexOf("Test operator")).toBeLessThan(html.indexOf("Earliest departure"));
    expect(html.indexOf("Earliest departure")).toBeLessThan(html.indexOf("FIRST-TRIP-MARKER"));
    expect(html.indexOf("FIRST-TRIP-MARKER")).toBeLessThan(html.indexOf("OVERVIEW-MARKER"));
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

it("offers the nearest answerable day as an explicit action, never applied on its own", () => {
  const onChange = vi.fn();
  const props = {
    isSearching: false, recentHistory: [], favorites: [],
    onToggleFavorite: vi.fn(), onRemoveFavorite: vi.fn(), onRepeatFavoriteSearch: vi.fn(),
    onChange, onSearch: async () => {}, onOpenStations: vi.fn(), onOpenWorkflow: vi.fn(),
    onRepeatSearch: vi.fn(), onTogglePinHistory: vi.fn(),
  };
  const base = { country: "japan" as const, origin: "Asakusa", destination: "Shimbashi" };

  // Without the station API the picker falls back to the market's contracted
  // range, which is what renderToStaticMarkup sees.
  const offered = providerDateValues("japan", countryConfig.japan.dateRangeDays);
  expect(offered.length).toBeGreaterThan(1);

  // Past the window: the nearest offered day is its far end, not today, which
  // is what a naive "reset to the first date" would have picked.
  const far = renderToStaticMarkup(<SearchForm {...props} params={{ ...base, date: "2099-01-01" }} />);
  expect(far).toContain(`Use ${offered[offered.length - 1]} instead`);

  // Before the window: the nearest is the first day the picker can answer.
  const past = renderToStaticMarkup(<SearchForm {...props} params={{ ...base, date: "1999-01-01" }} />);
  expect(past).toContain(`Use ${offered[0]} instead`);

  // The notice and its button are the only route out; nothing moved the date.
  expect(onChange).not.toHaveBeenCalled();
});
