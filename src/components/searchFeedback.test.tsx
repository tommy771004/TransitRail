import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { renderMissBlock, ResultShellHeader } from "./ResultShell";
import { CountryResultsView, type CountryResultsViewProps } from "./CountryResultsView";
import { SearchForm } from "./SearchForm";
import { countryConfig, providerDateValue, providerDateValues } from "../data/countries";

// Leaflet requires a browser; these regressions exercise search feedback, not maps.
vi.mock("./D3LeafletRouteMap", () => ({ D3LeafletRouteMap: () => null }));
vi.mock("./AffiliateMarquee", () => ({
  AffiliateMarquee: ({ variant }: { variant?: string }) => <aside data-affiliate-offers={variant} />,
}));

beforeAll(async () => { await i18n.changeLanguage("en"); });

const miss = {
  message: "Query detail", country: "japan" as const, errorTitle: "Unable to fetch",
  onModify: vi.fn(), onRetry: vi.fn(), sourceUrl: "https://example.com/timetable",
};

it("keeps the result title and actions in one responsive horizontal row", () => {
  const html = renderToStaticMarkup(<ResultShellHeader
    country="japan"
    origin="Tokyo"
    destination="Shin-Osaka"
    meta={null}
    weatherDate="2026-09-13"
    onModify={vi.fn()}
    onOpenLegend={vi.fn()}
  />);
  expect(html).toContain("min-w-0 flex-row items-center justify-between");
  expect(html).not.toContain("flex-col");
  expect(html.indexOf("data-weather-compact")).toBeLessThan(html.indexOf("Modify search"));
});

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
  it.each(["japan", "korea", "singapore", "united_kingdom"] as const)("keeps all %s departures ahead of supplementary content", country => {
    const trip = { id: "one", country, operator: "Test", service: "FIRST-TRIP", origin: "Asakusa", destination: "Shimbashi", departureTime: "10:00", direct: true, stops: [] };
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} country={country} error={undefined} noResultReason={undefined}
      results={[trip, { ...trip, id: "two", service: "SECOND-TRIP" }]} overview={<p>AFTER-ALL-TRIPS</p>} />);
    expect(html.indexOf("FIRST-TRIP")).toBeLessThan(html.indexOf("SECOND-TRIP"));
    expect(html.indexOf("SECOND-TRIP")).toBeLessThan(html.indexOf("AFTER-ALL-TRIPS"));
    expect(html.indexOf("data-weather-compact")).toBeLessThan(html.indexOf("FIRST-TRIP"));
    expect(html).not.toMatch(/1 Adult/i);
  });
  it.each(["japan", "korea", "singapore", "united_kingdom"] as const)("omits the visible search-condition summary above %s results", country => {
    const trip = { id: "one", country, operator: "Test", service: "TEST-TRIP", origin: "Asakusa", destination: "Shimbashi", departureTime: "10:00", direct: true, stops: [] };
    const html = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      country={country}
      error={undefined}
      noResultReason={undefined}
      timeMode="specified"
      time="00:05"
      results={[trip]}
    />);
    expect(html).not.toContain("data-search-conditions");
    expect(html).not.toContain(countryConfig[country].timeZone);
  });
  it.each(["japan", "korea"] as const)("hides invalid %s sorting tabs on both errors and empty success", country => {
    for (const error of [undefined, "Provider unavailable"]) {
      const html = renderToStaticMarkup(<CountryResultsView {...resultProps} country={country} error={error} onRetry={vi.fn()} />);
      expect(html).not.toContain("Fastest");
      expect(html).not.toContain("Earliest departure");
      expect(html).not.toContain("Cheapest first");
      expect(html).toContain("Change stations or date");
    }
  });
  it("offers all-day recovery and a way to clear filters that hide every Korean departure", () => {
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} country="korea" timeMode="specified" time="23:30"
      error="No matching departures" noResultReason="no_service" koreaFilter="first_class" onRecover={vi.fn()} onResetFilters={vi.fn()} />);
    expect(html).toContain("Search all day");
    expect(html).toContain("Show all departures");
  });
  it("does not offer all-day as a fix for missing data and keeps the operator link on coverage gaps", () => {
    const noDataHtml = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      timeMode="specified"
      time="23:30"
      onRecover={vi.fn()}
    />);
    expect(noDataHtml).not.toContain("Search all day");

    const coverageHtml = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      error="This route is not covered"
      noResultReason="unsupported_route"
      coverageGap={{ uncovered: ["Unknown"], suggestions: [] }}
      officialSourceUrl="https://example.com/operator-timetable"
      onChangeStations={vi.fn()}
    />);
    expect(coverageHtml).toContain("Open the operator timetable");
  });
  it("keeps a filtered-empty result distinct from a missing timetable", () => {
    const html = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      country="korea"
      error={undefined}
      noResultReason={undefined}
      totalResults={2}
      koreaFilter="first_class"
      onResetFilters={vi.fn()}
    />);
    expect(html).toContain("No matching departures");
    expect(html).toContain("Show all departures");
    expect(html).not.toContain("No verified timetable available.");
  });
  it.each(["japan", "korea", "singapore", "united_kingdom"] as const)("wires recovery through the %s result view", (country) => {
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} country={country} noResultReason={undefined} onRetry={vi.fn()} />);
    expect(html).toContain("Retry search");
    expect(html).toContain("Change stations or date");
  });
  it("does not render timetable provenance above country results", () => {
    const html = renderToStaticMarkup(<CountryResultsView {...resultProps} dataStatus={{ kind: "snapshot", source: "SOURCE-MARKER", sourceUrl: "https://example.com", completeness: "full-timetable", temporalCoverage: "bounded-upcoming" }} />);
    expect(html).not.toContain("SOURCE-MARKER");
    expect(html).not.toContain("Live upcoming departures only");
    expect(html).not.toContain("Details");
  });
  it("keeps the offline cache warning visible without the timetable provenance block", () => {
    const html = renderToStaticMarkup(<CountryResultsView
      {...resultProps}
      dataStatus={{ kind: "snapshot", source: "SOURCE-MARKER", sourceUrl: "https://example.com", completeness: "full-timetable" }}
      deliveryStatus={{ kind: "offline-cache", fetchedAt: "2026-09-13T01:23:00.000Z" }}
    />);
    expect(html).toContain("Offline cached result");
    expect(html).toContain('dateTime="2026-09-13T01:23:00.000Z"');
    expect(html).not.toContain("SOURCE-MARKER");
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
    expect(html).toContain('<p role="status" aria-live="polite" class="sr-only">Found 1 verified departures.</p>');
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

it("places departure-time context on the same row as the offered date range", () => {
  const noop = vi.fn();
  const html = renderToStaticMarkup(<SearchForm
    params={{ country: "japan", origin: "Asakusa", destination: "Shimbashi", date: providerDateValue("japan"), timeMode: "all_day" }}
    isSearching={false} recentHistory={[]} favorites={[]}
    onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
    onChange={noop} onSearch={async () => {}} onOpenStations={noop} onOpenWorkflow={noop}
    onRepeatSearch={noop} onTogglePinHistory={noop}
  />);
  const rowStart = html.indexOf("data-search-capability");
  const rowEnd = html.indexOf("</div>", rowStart);
  const capabilityRow = html.slice(rowStart, rowEnd);
  expect(capabilityRow).toContain("9/13");
  expect(capabilityRow).toContain("9/19");
  expect(capabilityRow).toContain("Departure time");
  expect(capabilityRow).toContain("Asia/Tokyo local time");
  expect(html).not.toContain("lucide-calendar-days");
  expect(html).toContain('role="group" aria-label="Date of Travel"');
  expect(html).toContain('data-time-mode-control="true"');
  expect(html).toContain("m3-shape-full grid grid-cols-3 overflow-hidden divide-x");
  expect(html).toContain('section class="mx-auto min-w-0 w-full max-w-md');
});

it("keeps tool links horizontal and places affiliate offers above popular routes", () => {
  const noop = vi.fn();
  const html = renderToStaticMarkup(<SearchForm
    params={{ country: "japan", origin: "Asakusa", destination: "Shimbashi", date: providerDateValue("japan"), timeMode: "all_day" }}
    isSearching={false} recentHistory={[]} favorites={[]}
    onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
    onChange={noop} onSearch={async () => {}} onOpenStations={noop} onOpenWorkflow={noop}
    onRepeatSearch={noop} onTogglePinHistory={noop}
  />);
  expect(html).toContain("mt-6 flex flex-row gap-2 sm:gap-3");
  expect(html).not.toContain("mt-6 flex flex-col");
  expect(html.indexOf('data-affiliate-offers="inline"')).toBeLessThan(html.indexOf("Popular Routes"));
});

it("places the route directory link to the right of the popular routes heading", () => {
  const noop = vi.fn();
  const html = renderToStaticMarkup(<SearchForm
    params={{ country: "japan", origin: "Asakusa", destination: "Shimbashi", date: providerDateValue("japan"), timeMode: "all_day" }}
    isSearching={false} recentHistory={[]} favorites={[]}
    onToggleFavorite={noop} onRemoveFavorite={noop} onRepeatFavoriteSearch={noop}
    onChange={noop} onSearch={async () => {}} onOpenStations={noop} onOpenWorkflow={noop}
    onRepeatSearch={noop} onTogglePinHistory={noop}
  />);
  const headingRowStart = html.indexOf("mb-4 flex min-w-0 items-center justify-between");
  const headingRowEnd = html.indexOf("</div>", headingRowStart);
  const headingRow = html.slice(headingRowStart, headingRowEnd);
  expect(headingRow).toContain("Popular Routes");
  expect(headingRow).toContain('href="/routes/"');
  expect(headingRow).toContain("Browse all route timetables →");
  expect(headingRow).toContain("min-h-12 max-w-[55%]");
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
