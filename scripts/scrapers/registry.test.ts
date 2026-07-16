import { describe, expect, it } from "vitest";
import { getCountryCapability, timetableScrapeCountries } from "../../src/data/countryCapability";
import { createTimetableScrapers } from "./registry";

describe("scraper registry ↔ country capability", () => {
  it("creates one scraper per timetable scrape country from countryConfig", () => {
    const scrapers = createTimetableScrapers();
    const countries = scrapers.map((s) => s.country).sort();
    expect(countries).toEqual([...timetableScrapeCountries()].sort());
  });

  it("every factory country is a timetable-scrape strategy in countryConfig", () => {
    for (const scraper of createTimetableScrapers()) {
      const strategy = getCountryCapability(scraper.country as Parameters<typeof getCountryCapability>[0]).scrape;
      expect(["generated", "snapshot", "provider_backed"]).toContain(strategy);
    }
  });

  it("covers expected markets once (no dual strategy map)", () => {
    const countries = new Set(createTimetableScrapers().map((s) => s.country));
    expect(countries.has("japan")).toBe(true);
    expect(countries.has("korea")).toBe(true);
    expect(countries.has("hong_kong")).toBe(true);
    expect(countries.has("united_kingdom")).toBe(true);
    expect(countries.has("switzerland")).toBe(true);
    expect(countries.has("malaysia")).toBe(false);
  });
});
