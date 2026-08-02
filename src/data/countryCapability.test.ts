import { describe, expect, it } from "vitest";
import { configuredCountryOptions, countryOptions } from "./countries";
import type { Country } from "../types";
import {
  automatedScrapeCountries,
  getCountryCapability,
  timetableScrapeCountries,
} from "./countryCapability";

describe("getCountryCapability — search / scrape / result view policy", () => {
  it("keeps Korea public while retaining its scheduled scraper", () => {
    expect(countryOptions).toContain("korea");
    expect(timetableScrapeCountries()).toContain("korea");
  });

  it("Hong Kong: scraped at request time, provider-backed scrape, metro results", () => {
    // Search exposes only the current local service day for MTR data.
    expect(getCountryCapability("hong_kong")).toMatchObject({
      search: { kind: "scraped" },
      scrape: "provider_backed",
      resultView: "metro",
      liveOnly: true,
    });
  });

  it("United Kingdom: live provider at request time, no scrape fallback, live_rail london", () => {
    // Live at request time, but not today-only: unlike the MTR feed, the TfL
    // journey planner answers a future date from the published schedule.
    expect(getCountryCapability("united_kingdom")).toMatchObject({
      search: { kind: "provider", provider: "tfl" },
      scrape: "provider_backed",
      resultView: "live_rail",
      liveRailMarket: "london",
      liveOnly: false,
    });
  });

  it("Switzerland: try provider, fall back to scraped when empty", () => {
    expect(getCountryCapability("switzerland")).toMatchObject({
      search: { kind: "provider_then_scraped", provider: "swiss" },
      scrape: "provider_backed",
      resultView: "live_rail",
      liveRailMarket: "switzerland",
    });
  });

  it("Malaysia: station catalog only — no timetable search", () => {
    expect(getCountryCapability("malaysia")).toMatchObject({
      search: { kind: "catalog_only" },
      scrape: "catalog_sync",
      resultView: "catalog",
      liveOnly: false,
    });
  });

  it("United States: live MBTA, seven-day scheduled range", () => {
    expect(getCountryCapability("united_states")).toMatchObject({
      search: { kind: "provider", provider: "mbta" },
      scrape: "provider_backed",
      resultView: "live_rail",
      liveRailMarket: "boston",
      liveOnly: false,
      dateRangeDays: 7,
    });
  });

  it("Japan family countries share intercity result chrome and scraped search", () => {
    for (const country of ["japan", "germany", "france", "china"] as Country[]) {
      expect(getCountryCapability(country)).toMatchObject({
        search: { kind: "scraped" },
        resultView: "japan",
      });
    }
    expect(getCountryCapability("japan").scrape).toBe("provider_backed");
    expect(getCountryCapability("germany").scrape).toBe("provider_backed");
    expect(getCountryCapability("france").scrape).toBe("provider_backed");
    expect(getCountryCapability("korea").scrape).toBe("provider_backed");
  });

  it("defines capability for every selectable country", () => {
    for (const country of countryOptions) {
      const cap = getCountryCapability(country);
      expect(cap.search.kind).toBeTruthy();
      expect(cap.scrape).toBeTruthy();
      expect(cap.resultView).toBeTruthy();
      expect(typeof cap.liveOnly).toBe("boolean");
      expect(["supported", "partial", "unavailable"]).toContain(cap.serviceDay.coverage);
      expect(cap.serviceDay.source.length).toBeGreaterThan(0);
      expect(cap.serviceDay.scope.length).toBeGreaterThan(0);
    }
  });

  it("does not silently promote a market without a qualifying source", () => {
    expect(getCountryCapability("united_kingdom").serviceDay.coverage).toBe("supported");
    expect(getCountryCapability("united_states").serviceDay.coverage).toBe("supported");
    expect(getCountryCapability("france").serviceDay.coverage).toBe("supported");
    expect(getCountryCapability("thailand").serviceDay.coverage).toBe("partial");
    expect(getCountryCapability("singapore").serviceDay.coverage).toBe("partial");
    for (const country of ["japan", "korea", "malaysia", "hong_kong", "germany", "belgium", "norway", "switzerland", "china"] as Country[]) {
      expect(getCountryCapability(country).serviceDay.coverage).toBe("unavailable");
    }
  });

  it("lists every configured country as an automated scrape or catalog job", () => {
    // No orphan markets: UI countries all have a scrape/catalog strategy.
    expect(new Set(automatedScrapeCountries()).size).toBe(configuredCountryOptions.length);
    for (const country of configuredCountryOptions) {
      expect(automatedScrapeCountries()).toContain(country);
    }
  });

  it("timetable scrapers exclude catalog-only Malaysia", () => {
    expect(timetableScrapeCountries()).not.toContain("malaysia");
    expect(timetableScrapeCountries()).toContain("japan");
    expect(timetableScrapeCountries()).toContain("hong_kong");
    expect(getCountryCapability("malaysia").scrape).toBe("catalog_sync");
  });
});
