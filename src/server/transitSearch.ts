/**
 * Journey search orchestration: country policy → provider and/or scraped snapshots.
 * Express handlers stay thin HTTP over this module.
 */
import type { Country, SearchDataStatus, SearchResponse } from "../types";
import { countryOptions } from "../data/countries";
import { getCountryCapability, type ProviderId } from "../data/countryCapability";
import { findScrapedResults, getScrapedCountryFreshness } from "../data/scraped";
import { getLinesForCountry } from "./catalog";
import { enrichTransitResultsWithLineStations } from "../utils/metroEnricher";
import { searchTflJourney } from "./tfl";
import { searchMbtaJourney } from "./mbta";
import { searchBelgiumJourney } from "./belgium";
import { searchNorwayJourney } from "./norway";
import { searchSwissJourney } from "./swiss";

export type TransitSearchInput = {
  origin: string;
  destination: string;
  date: string;
  country?: string;
  time?: string;
};

export type TransitSearchPayload = SearchResponse & {
  error?: string;
  message?: string;
};

export type TransitSearchResult = {
  statusCode: number;
  payload: TransitSearchPayload;
};

type ProviderResponse = { status: number; body: SearchResponse & { error?: string; message?: string } };

async function runProvider(
  provider: ProviderId,
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<ProviderResponse> {
  switch (provider) {
    case "tfl":
      return searchTflJourney(origin, destination, date, time);
    case "mbta":
      return searchMbtaJourney(origin, destination, date);
    case "belgium":
      return searchBelgiumJourney(origin, destination, date, time);
    case "norway":
      return searchNorwayJourney(origin, destination, date, time);
    case "swiss":
      return searchSwissJourney(origin, destination, date, time);
  }
}

function describeSearchData(source: string | undefined, country: string | undefined): SearchDataStatus {
  const checkedAt = new Date().toISOString();

  if (source === "scraped") {
    return {
      kind: "snapshot",
      source: "Pre-scraped timetable snapshot",
      updatedAt: country ? getScrapedCountryFreshness(country as Country) : undefined,
    };
  }

  if (source?.includes("historical ridership station catalog")) {
    return {
      kind: "catalog",
      source,
      checkedAt,
    };
  }

  return {
    kind: "provider",
    source: source || "Transit provider",
    checkedAt,
  };
}

function filterByTime(results: NonNullable<ReturnType<typeof findScrapedResults>>, time?: string) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return results;
  return results.filter((r) => r.departureTime >= time);
}

function tryScraped(
  country: Country | undefined,
  origin: string,
  destination: string,
  date: string,
  time?: string,
): TransitSearchPayload | undefined {
  if (!country) {
    // Unknown country string: cannot type as Country — return nothing.
    return undefined;
  }
  let scraped = findScrapedResults(country, origin, destination, date);
  if (!scraped || scraped.length === 0) return undefined;
  scraped = filterByTime(scraped, time);
  if (scraped.length === 0) return undefined;
  return { results: scraped, source: "scraped" };
}

/**
 * Resolve a journey search. Does not write audit logs — the HTTP edge does that.
 */
export async function runTransitSearch(input: TransitSearchInput): Promise<TransitSearchResult> {
  const { origin, destination, date, time } = input;
  const countryValue = input.country;
  const resolvedCountry =
    countryValue && countryOptions.includes(countryValue as Country)
      ? (countryValue as Country)
      : undefined;

  let statusCode = 200;
  let payload: TransitSearchPayload | undefined;

  if (resolvedCountry) {
    const { search } = getCountryCapability(resolvedCountry);

    if (search.kind === "catalog_only") {
      statusCode = 422;
      payload = {
        error: "Timetable unavailable",
        message:
          "Malaysia currently provides an official station catalog derived from historical data.gov.my ridership files. Those files do not contain train schedules or real-time arrivals, so no timetable is shown.",
        results: [],
        source: "data.gov.my historical ridership station catalog",
      };
    } else if (search.kind === "provider" || search.kind === "provider_then_scraped") {
      const providerResponse = await runProvider(search.provider, origin, destination, date, time);
      if (search.kind === "provider") {
        statusCode = providerResponse.status;
        payload = providerResponse.body;
      } else if (
        providerResponse.status >= 200 &&
        providerResponse.status < 300 &&
        providerResponse.body.results.length > 0
      ) {
        statusCode = providerResponse.status;
        payload = providerResponse.body;
      }
    }

    if (!payload && (search.kind === "scraped" || search.kind === "provider_then_scraped")) {
      payload = tryScraped(resolvedCountry, origin, destination, date, time);
    }
  } else if (countryValue) {
    // Non-option country string: refuse rather than cast to Country.
    statusCode = 400;
    payload = {
      error: "Invalid country",
      message: `Country must be one of ${countryOptions.join(", ")}.`,
      results: [],
    };
  } else {
    // No country: try nothing for scrapes (need country key for cache).
    payload = undefined;
  }

  if (!payload) {
    statusCode = 404;
    payload = {
      error: "No data available",
      message: `No supported timetable data found for ${origin} → ${destination}. This route may not be covered yet.`,
      results: [],
      source: "scraped",
    };
  }

  if (payload.results && payload.results.length > 0 && resolvedCountry) {
    try {
      const countryLines = await getLinesForCountry(resolvedCountry);
      if (countryLines && countryLines.length > 0) {
        payload.results = enrichTransitResultsWithLineStations(
          payload.results,
          countryLines,
          resolvedCountry,
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  payload.dataStatus = describeSearchData(payload.source, resolvedCountry);
  return { statusCode, payload };
}
