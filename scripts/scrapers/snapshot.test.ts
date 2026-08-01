import { describe, expect, it } from "vitest";
import { providerDateValue } from "../../src/data/countries";
import type { SearchResponse, TransitResult } from "../../src/types";
import { ProviderBackedScraper } from "./snapshot";
import type { ScrapedRoute, ScrapedRouteData } from "./types";

type ProviderSearch = (
  origin: string,
  destination: string,
  date: string,
) => Promise<{ status: number; body: SearchResponse & { error?: string } }>;

const route: ScrapedRoute = { origin: "Origin", destination: "Destination" };

function result(partial: Partial<TransitResult> = {}): TransitResult {
  return {
    id: "fallback-0",
    country: "united_kingdom",
    operator: "Operator",
    service: "Line A",
    departureTime: "08:00",
    arrivalTime: "08:30",
    origin: route.origin,
    destination: route.destination,
    direct: true,
    stops: [route.origin, route.destination],
    ...partial,
  };
}

class TestProviderBackedScraper extends ProviderBackedScraper {
  constructor(providerSearch: ProviderSearch) {
    super("Test provider", "united_kingdom", [route], providerSearch);
  }

  protected override loadSnapshot(): ScrapedRouteData {
    return {
      ...route,
      date: "2026-08-01",
      scrapedAt: "2026-08-01T08:00:00.000Z",
      source: "official timetable",
      provenance: "official",
      results: [result()],
    };
  }
}

describe("provider-backed source normalization", () => {
  it("stamps provider rows before validating a current live response", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => ({
      status: 200,
      body: {
        source: "https://api.tfl.gov.uk",
        results: [result({ id: "live-without-date", realtime: true })],
      },
    }));

    const data = await scraper.scrape(route, date);

    expect(data.source).toBe("https://api.tfl.gov.uk");
    expect(data.provenance).toBe("official");
    expect(data.results[0]).toMatchObject({ date, realtime: true });
  });

  it("persists only the requested service-day rows", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => ({
      status: 200,
      body: {
        source: "https://api.tfl.gov.uk",
        results: [
          result({ id: "today", date }),
          result({ id: "other-day", date: "2025-01-01" }),
        ],
      },
    }));

    const data = await scraper.scrape(route, date);

    expect(data.results).toHaveLength(1);
    expect(data.results[0].date).toBe(date);
  });

  it("falls back when the provider returns stale realtime rows", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => ({
      status: 200,
      body: {
        source: "https://api.tfl.gov.uk",
        results: [result({
          id: "uk-tfl-2025-01-01T08:37:00-0",
          realtime: true,
        })],
      },
    }));

    const data = await scraper.scrape(route, date);

    expect(data.source).toBe("Test provider curated snapshot fallback");
    expect(data.provenance).toBe("curated");
    expect(data.truthMode).toBe("indicative");
    expect(data.results[0].realtime).toBe(false);
  });

  it("falls back when the provider body is malformed", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => ({
      status: 200,
      body: { results: "not-an-array" } as unknown as SearchResponse,
    }));

    const data = await scraper.scrape(route, date);

    expect(data.source).toBe("Test provider curated snapshot fallback");
    expect(data.provenance).toBe("curated");
  });

  it("does not promote a provider response that omits its source", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => ({
      status: 200,
      body: {
        results: [result({ id: "provider-without-source" })],
      },
    }));

    const data = await scraper.scrape(route, date);

    expect(data.source).toBe("Test provider curated snapshot fallback");
    expect(data.provenance).toBe("curated");
  });

  it("falls back when the provider request rejects", async () => {
    const date = providerDateValue("united_kingdom");
    const scraper = new TestProviderBackedScraper(async () => {
      throw new Error("provider offline");
    });

    const data = await scraper.scrape(route, date);

    expect(data.source).toBe("Test provider curated snapshot fallback");
    expect(data.provenance).toBe("curated");
  });
});
