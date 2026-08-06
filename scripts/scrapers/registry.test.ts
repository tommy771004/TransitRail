import { describe, expect, it } from "vitest";
import { getCountryCapability, timetableScrapeCountries } from "../../src/data/countryCapability";
import { createTimetableScrapers } from "./registry";

describe("scraper registry ↔ country capability", () => {
  it("covers exactly the timetable-scrape countries from countryConfig", () => {
    const scrapers = createTimetableScrapers();
    // A country may have several scrapers, so compare the sets: Japan reads
    // ODPT and JR Central, which are different sources at different tiers.
    const countries = [...new Set(scrapers.map((s) => s.country))].sort();
    expect(countries).toEqual([...timetableScrapeCountries()].sort());
  });

  it("every factory country is on the official-source strategy in countryConfig", () => {
    for (const scraper of createTimetableScrapers()) {
      const strategy = getCountryCapability(scraper.country as Parameters<typeof getCountryCapability>[0]).scrape;
      expect(strategy).toBe("official_source");
    }
  });

  it("runs both of Japan's sources rather than only the last registered one", () => {
    const japan = createTimetableScrapers().filter((scraper) => scraper.country === "japan");
    expect(japan.map((scraper) => scraper.name).sort()).toEqual(["JR Central", "ODPT"]);
  });

  it("excludes markets with no registered official source", () => {
    const countries = new Set(createTimetableScrapers().map((s) => s.country));
    expect(countries.has("japan")).toBe(true);
    expect(countries.has("korea")).toBe(true);
    expect(countries.has("hong_kong")).toBe(true);
    expect(countries.has("united_kingdom")).toBe(true);
    expect(countries.has("switzerland")).toBe(true);
    // Catalog-only, and no source wired up at all, respectively.
    expect(countries.has("malaysia")).toBe(false);
    expect(countries.has("china")).toBe(false);
  });
});
