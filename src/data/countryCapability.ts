/**
 * Country policy accessors. Policy data lives in {@link countryConfig}
 * (single table: product chrome + search/scrape/result view).
 */
import type { Country } from "../types";
import {
  countryConfig,
  countryOptions,
  type LiveRailMarket,
  type ProviderId,
  type ResultViewFamily,
  type ScrapeStrategy,
  type SearchKind,
} from "./countries";

export type {
  LiveRailMarket,
  ProviderId,
  ResultViewFamily,
  ScrapeStrategy,
  SearchKind,
};

/** Policy slice used by search, scrapers, and result chrome. */
export interface CountryCapability {
  search: SearchKind;
  scrape: ScrapeStrategy;
  resultView: ResultViewFamily;
  liveRailMarket?: LiveRailMarket;
  liveOnly: boolean;
}

export function getCountryCapability(country: Country): CountryCapability {
  const {
    search,
    scrape,
    resultView,
    liveRailMarket,
    liveOnly,
  } = countryConfig[country];
  return { search, scrape, resultView, liveRailMarket, liveOnly };
}

/** Countries whose scrape job is a timetable scraper (not catalog-only / none). */
export function timetableScrapeCountries(): Country[] {
  return countryOptions.filter((country) => {
    const strategy = countryConfig[country].scrape;
    return strategy === "generated" || strategy === "snapshot" || strategy === "provider_backed";
  });
}

/** Countries that run any automated data job (timetable scrapers + catalog sync). */
export function automatedScrapeCountries(): Country[] {
  return countryOptions.filter((country) => countryConfig[country].scrape !== "none");
}
