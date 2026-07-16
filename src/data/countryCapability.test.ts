import { describe, expect, it } from "vitest";
import { countryOptions } from "./countries";
import type { Country } from "../types";
import {
  automatedScrapeCountries,
  getCountryCapability,
  timetableScrapeCountries,
} from "./countryCapability";

describe("getCountryCapability — search / scrape / result view policy", () => {
  it("Hong Kong: scraped at request time, provider-backed scrape, metro results", () => {
    // Live MTR is used by the nightly scraper only — search reads snapshots.
    expect(getCountryCapability("hong_kong")).toMatchObject({
      search: { kind: "scraped" },
      scrape: "provider_backed",
      resultView: "metro",
      liveOnly: false,
    });
  });

  it("United Kingdom: live provider at request time, no scrape fallback, live_rail london", () => {
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

  it("United States: live MBTA, date locked to today", () => {
    expect(getCountryCapability("united_states")).toMatchObject({
      search: { kind: "provider", provider: "mbta" },
      scrape: "provider_backed",
      resultView: "live_rail",
      liveRailMarket: "boston",
      liveOnly: true,
    });
  });

  it("Japan family countries share intercity result chrome and scraped search", () => {
    for (const country of ["japan", "germany", "france", "china"] as Country[]) {
      expect(getCountryCapability(country)).toMatchObject({
        search: { kind: "scraped" },
        resultView: "japan",
      });
    }
    expect(getCountryCapability("japan").scrape).toBe("generated");
    expect(getCountryCapability("germany").scrape).toBe("snapshot");
    expect(getCountryCapability("korea").scrape).toBe("snapshot");
  });

  it("defines capability for every selectable country", () => {
    for (const country of countryOptions) {
      const cap = getCountryCapability(country);
      expect(cap.search.kind).toBeTruthy();
      expect(cap.scrape).toBeTruthy();
      expect(cap.resultView).toBeTruthy();
      expect(typeof cap.liveOnly).toBe("boolean");
    }
  });

  it("lists every countryOptions entry as automated scrape or catalog job", () => {
    // No orphan markets: UI countries all have a scrape/catalog strategy.
    expect(new Set(automatedScrapeCountries()).size).toBe(countryOptions.length);
    for (const country of countryOptions) {
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
