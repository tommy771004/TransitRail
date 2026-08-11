/**
 * Timetable scraper registry.
 *
 * A country may run more than one scraper, because a country's data may come
 * from more than one operator through more than one kind of source: Japan reads
 * ODPT's official JSON for Tokyo's metro and JR Central's own timetable search
 * for the Tokaido Shinkansen, and those are different tiers with different
 * failure modes. Collapsing them into one class is what made "Japan's scraper
 * succeeded" a statement that could be true while most of Japan's routes were
 * generated from a headway table.
 *
 * Which countries run at all is owned by `countryConfig.scrape` via
 * {@link timetableScrapeCountries}.
 */
import type { Country } from "../../src/types";
import { getCountryCapability, timetableScrapeCountries } from "../../src/data/countryCapability";
import { JapanOdptScraper, JapanJrCentralScraper } from "./japan";
import { KoreaScraper } from "./korea";
import { MalaysiaKtmbScraper } from "./malaysiaTimetable";
import {
  BelgiumScraper,
  NorwayScraper,
  FranceScraper,
  GermanyScraper,
  HongKongScraper,
  SingaporeScraper,
  SwitzerlandScraper,
  ThailandScraper,
  UnitedKingdomScraper,
  UnitedStatesBrowserScraper,
  UnitedStatesScraper,
} from "./metro";
import type { BaseScraper } from "./base";

/** One or more factories per timetable-scrape country. */
const FACTORIES: Record<string, Array<() => BaseScraper>> = {
  japan: [() => new JapanOdptScraper(), () => new JapanJrCentralScraper()],
  korea: [() => new KoreaScraper()],
  singapore: [() => new SingaporeScraper()],
  malaysia: [() => new MalaysiaKtmbScraper()],
  thailand: [() => new ThailandScraper()],
  hong_kong: [() => new HongKongScraper()],
  united_kingdom: [() => new UnitedKingdomScraper()],
  united_states: [() => new UnitedStatesScraper(), () => new UnitedStatesBrowserScraper()],
  germany: [() => new GermanyScraper()],
  france: [() => new FranceScraper()],
  belgium: [() => new BelgiumScraper()],
  norway: [() => new NorwayScraper()],
  switzerland: [() => new SwitzerlandScraper()],
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
    const factories = FACTORIES[country];
    if (!factories?.length) {
      throw new Error(
        `No scraper factory for "${country}" (countryConfig.scrape=${getCountryCapability(country).scrape})`,
      );
    }
    for (const factory of factories) {
      const scraper = factory();
      if (scraper.country !== country) {
        throw new Error(`Scraper country mismatch: factory key ${country}, scraper.country ${scraper.country}`);
      }
      scrapers.push(scraper);
    }
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
  const byCountry = new Map<string, string[]>();
  for (const scraper of scrapers) {
    byCountry.set(scraper.country, [...(byCountry.get(scraper.country) || []), scraper.name]);
  }
  return Object.fromEntries([
    ...[...byCountry].map(([country, names]) => [country, names.join(" + ")]),
  ]);
}
