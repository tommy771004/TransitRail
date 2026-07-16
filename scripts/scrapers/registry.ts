/**
 * Timetable scraper registry. Factories are the only schedule of scraper
 * classes; which countries run is owned by countryConfig.scrape via
 * {@link timetableScrapeCountries}. No dual instanceof policy check.
 */
import type { Country } from "../../src/types";
import { getCountryCapability, timetableScrapeCountries } from "../../src/data/countryCapability";
import { JapanScraper } from "./japan";
import { KoreaScraper } from "./korea";
import {
  BelgiumScraper,
  NorwayScraper,
  ChinaScraper,
  FranceScraper,
  GermanyScraper,
  HongKongScraper,
  SingaporeScraper,
  SwitzerlandScraper,
  ThailandScraper,
  UnitedKingdomScraper,
  UnitedStatesScraper,
} from "./metro";
import type { BaseScraper } from "./base";

/** One factory per timetable-scrape country. Keys must match timetableScrapeCountries(). */
const FACTORIES: Record<string, () => BaseScraper> = {
  japan: () => new JapanScraper(),
  korea: () => new KoreaScraper(),
  china: () => new ChinaScraper(),
  singapore: () => new SingaporeScraper(),
  thailand: () => new ThailandScraper(),
  hong_kong: () => new HongKongScraper(),
  united_kingdom: () => new UnitedKingdomScraper(),
  united_states: () => new UnitedStatesScraper(),
  germany: () => new GermanyScraper(),
  france: () => new FranceScraper(),
  belgium: () => new BelgiumScraper(),
  norway: () => new NorwayScraper(),
  switzerland: () => new SwitzerlandScraper(),
};

/**
 * Build the timetable scrapers that run in `npm run scrape`.
 * Throws if capability lists a timetable country with no factory, or if a
 * factory key is not a timetable-scrape country.
 */
export function createTimetableScrapers(): BaseScraper[] {
  const expected = timetableScrapeCountries();
  const scrapers: BaseScraper[] = [];

  for (const country of expected) {
    const factory = FACTORIES[country];
    if (!factory) {
      throw new Error(
        `No scraper factory for "${country}" (countryConfig.scrape=${getCountryCapability(country).scrape})`,
      );
    }
    const scraper = factory();
    if (scraper.country !== country) {
      throw new Error(`Scraper country mismatch: factory key ${country}, scraper.country ${scraper.country}`);
    }
    scrapers.push(scraper);
  }

  for (const key of Object.keys(FACTORIES)) {
    if (!expected.includes(key as Country)) {
      throw new Error(
        `Orphan scraper factory "${key}" — not in timetableScrapeCountries() (scrape=${getCountryCapability(key as Country).scrape})`,
      );
    }
  }

  return scrapers;
}

export function scraperDisplayNames(
  scrapers: Array<{ country: string; name: string }>,
): Record<string, string> {
  return Object.fromEntries([
    ...scrapers.map((scraper) => [scraper.country, scraper.name]),
    ["malaysia", "data.gov.my historical-ridership station catalog"],
  ]);
}
