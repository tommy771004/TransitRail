import { describe, expect, it, vi } from "vitest";
import {
  BrowserScraper,
  DownloadScraper,
  FrequencyScraper,
  HtmlScraper,
  OfficialFeedScraper,
  PdfScraper,
} from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { OfficialSourceId } from "../../src/data/sourceRegistry";
import type { Country } from "../../src/types";

const ROUTE: ScrapedRoute = { origin: "A", destination: "B" };

/** Build a minimal scraper of one kind pointed at one registered source. */
function scraperOf<T extends typeof DownloadScraper | typeof BrowserScraper | typeof HtmlScraper | typeof PdfScraper>(
  Kind: T,
  country: Country,
  sourceId: OfficialSourceId,
) {
  // @ts-expect-error abstract members are supplied below
  return new (class extends Kind {
    readonly name = "test";
    readonly country = country;
    readonly routes = [ROUTE];
    readonly sourceId = sourceId;
    async scrape(): Promise<ScrapedRouteData> {
      return { origin: "A", destination: "B", date: "2026-08-01", scrapedAt: "", source: "", results: [] };
    }
  })();
}

describe("a scraper kind may only claim the artifact family it fetches", () => {
  it.each([
    ["DownloadScraper", DownloadScraper, "germany", "de-gtfs", true],
    ["DownloadScraper on an HTML source", DownloadScraper, "japan", "jp-jr-central", false],
    ["HtmlScraper", HtmlScraper, "japan", "jp-jr-central", true],
    ["HtmlScraper on a GTFS source", HtmlScraper, "germany", "de-gtfs", false],
    ["BrowserScraper on a JSON source", BrowserScraper, "germany", "de-gtfs", false],
    ["PdfScraper on a JSON source", PdfScraper, "germany", "de-gtfs", false],
  ] as const)("%s", (_label, Kind, country, sourceId, allowed) => {
    const scraper = scraperOf(Kind as never, country, sourceId);
    if (allowed) {
      expect(() => scraper.assertRegisteredSources()).not.toThrow();
    } else {
      expect(() => scraper.assertRegisteredSources()).toThrow(/may not produce/);
    }
  });

  it("rejects a source belonging to another country", () => {
    const scraper = scraperOf(DownloadScraper as never, "france", "de-gtfs");
    expect(() => scraper.assertRegisteredSources()).toThrow(/belongs to germany/);
  });

  it("rejects an unregistered source before any network call", () => {
    const scraper = scraperOf(DownloadScraper as never, "china", "cn-12306" as OfficialSourceId);
    expect(() => scraper.assertRegisteredSources()).toThrow(/unregistered source/);
  });
});

describe("FrequencyScraper", () => {
  class TestFrequencyScraper extends FrequencyScraper {
    readonly name = "test";
    readonly country = "thailand" as const;
    readonly routes = [ROUTE];
    readonly sourceId = "th-bem-service-hours" as const;
    collected: string[] = [];
    protected async collectServiceDay(_routes: readonly ScrapedRoute[], date: string) {
      this.collected.push(date);
    }
  }

  it("emits no departures, whatever the source publishes", async () => {
    const scraper = new TestFrequencyScraper();
    const data = await scraper.scrape(ROUTE, "2026-08-01");
    expect(data.results).toEqual([]);
  });

  it("collects the service day alongside the empty route files", async () => {
    const scraper = new TestFrequencyScraper();
    (scraper as unknown as { saveRoute: () => void }).saveRoute = () => {};
    await scraper.runAll("2026-08-01");
    expect(scraper.collected).toEqual(["2026-08-01"]);
  });

  it("cannot be pointed at a source that would let it claim a full timetable", () => {
    // The register caps BEM at frequency-only; a source that publishes a full
    // timetable has no business behind a class that emits no departures.
    class Overreaching extends TestFrequencyScraper {
      override readonly sourceId = "de-gtfs" as never;
      override readonly country = "germany" as never;
      declaredCompleteness() {
        return this.completenessFor(ROUTE);
      }
    }
    expect(new Overreaching().declaredCompleteness()).toBe("frequency-only");
  });
});

describe("OfficialFeedScraper", () => {
  class TestFeedScraper extends OfficialFeedScraper {
    constructor(query: Parameters<typeof buildFeed>[0]) {
      super("test", "belgium", [ROUTE], "be-irail", query);
    }
  }
  const buildFeed = (query: (o: string, d: string, date: string) => Promise<{ status: number; body: Record<string, unknown> }>) => query;

  const row = {
    id: "r1",
    country: "belgium",
    date: "2026-08-01",
    operator: "SNCB",
    service: "IC 100",
    departureTime: "08:00",
    arrivalTime: "09:00",
    origin: "A",
    destination: "B",
    direct: true,
    stops: ["A", "B"],
  };

  it("returns the provider's rows on success", async () => {
    const scraper = new TestFeedScraper(async () => ({ status: 200, body: { results: [row] } }));
    await expect(scraper.scrape(ROUTE, "2026-08-01")).resolves.toMatchObject({ results: [row] });
  });

  it.each([
    ["a server error", { status: 503, body: { error: "UPSTREAM_DOWN" } }, /UPSTREAM_DOWN/],
    ["an empty 200", { status: 200, body: { results: [] } }, /no departures/],
  ])("throws on %s so the previous file is kept", async (_label, response, expected) => {
    const scraper = new TestFeedScraper(async () => response);
    await expect(scraper.scrape(ROUTE, "2026-08-01")).rejects.toThrow(expected);
  });

  it("never calls a live-only provider about another service day", async () => {
    class LiveOnly extends OfficialFeedScraper {
      constructor(query: Parameters<typeof buildFeed>[0]) {
        super("mtr", "hong_kong", [ROUTE], "hk-mtr-next-train", query);
      }
      protected override isProviderToday(date: string) {
        return date === "2026-08-01";
      }
    }
    const query = vi.fn(async () => ({ status: 200, body: { results: [row] } }));
    const scraper = new LiveOnly(query);

    const future = await scraper.scrape(ROUTE, "2026-08-02");

    // A next-train feed asked about tomorrow would answer about today, and
    // those arrivals would then be stored under tomorrow's date.
    expect(query).not.toHaveBeenCalled();
    expect(future.results).toEqual([]);
  });
});
