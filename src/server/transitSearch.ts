/**
 * Journey search orchestration: country policy → provider and/or scraped snapshots.
 * Express handlers stay thin HTTP over this module.
 */
import type {
  Country,
  CoverageGap,
  NoResultReason,
  SearchDataStatus,
  SearchResponse,
  TimetableProvenance,
} from "../types";
import { configuredCountryOptions } from "../data/countries";
import { getCountryCapability, type ProviderId } from "../data/countryCapability";
import {
  findScrapedResults,
  findScrapedSearchability,
  getScrapedRoutes,
  getScrapedCountryFreshness,
  getScrapedCoverageNames,
} from "../data/scraped";
import {
  decideSearchability,
  tagResultsWithDecision,
  decideRouteContextSearchability,
  toNoResultReason,
  type SearchabilityDecision,
} from "../data/searchabilityPolicy";
import {
  normalizeTimetableSource,
  providerResponseAuthenticityOptions,
} from "../data/timetableAuthenticity";
import {
  coverageModeFor,
  hasCoverage,
} from "../data/stationCoverage";
import { stationSearchKey } from "../data/stationKey";
import { getLinesForCountry, officialTimetableUrls } from "./catalog";
import { enrichTransitResultsWithLineStations } from "../utils/metroEnricher";
import { searchTflJourney } from "./tfl";
import { searchMbtaJourney } from "./mbta";
import { searchBelgiumJourney } from "./belgium";
import { searchNorwayJourney } from "./norway";
import { searchSwissJourney } from "./swiss";
import { recordError } from "./errorLog";
import { getFranceServiceDayAdvisory } from "./franceGtfs";
import { getThailandServiceDayAdvisory } from "./thailandBem";
import { getSingaporeServiceDayAdvisory } from "./singaporeSmrt";

export type TransitSearchInput = {
  origin: string;
  destination: string;
  date: string;
  country?: string;
  time?: string;
};

/**
 * A search request once its country string has been validated.
 *
 * The country/origin/destination/date group travelled through five helpers as
 * separate parameters — four adjacent strings, where swapping two is a silent
 * bug the compiler cannot see. Bundling them removes that class and keeps the
 * pieces that always move together in one place.
 */
type ResolvedQuery = {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
};

export type TransitSearchPayload = SearchResponse & {
  error?: string;
  message?: string;
  /** Safe support reference for a server-side error_log row. */
  referenceId?: string;
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
      return searchMbtaJourney(origin, destination, date, time);
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

function providerPayloadWithPolicy(
  query: ResolvedQuery,
  body: SearchResponse & { error?: string; message?: string },
): { payload: TransitSearchPayload; decision: SearchabilityDecision } {
  const { country, origin, destination, date } = query;
  // Provider adapters return the requested service day as a query argument;
  // attaching it to rows records source context without inventing a departure.
  const results = body.results.map((result) => ({ ...result, date: result.date || date }));
  const source = {
    origin,
    destination,
    date,
    source: body.source,
    provenance: "official" as TimetableProvenance,
    results,
  };
  const sourceFact = normalizeTimetableSource(
    source,
    date,
    providerResponseAuthenticityOptions(country),
  );
  const decision = decideSearchability({
    country,
    serviceDay: date,
    origin,
    destination,
    sourceFact,
  });
  return {
    decision,
    payload: {
      ...body,
      results: decision.searchable ? tagResultsWithDecision(results, decision) : [],
      provenance: decision.provenance,
      truthMode: decision.truthMode,
      ...(decision.searchable || !decision.reason
        ? {}
        : {
            noResultReason: toNoResultReason(decision.reason),
            message: noDataMessage(origin, destination, undefined, toNoResultReason(decision.reason), country),
          }),
    },
  };
}

function providerFailurePayload(
  query: ResolvedQuery,
  response: ProviderResponse,
): TransitSearchPayload {
  const { country, origin, destination } = query;
  const reason: NoResultReason = response.body.noResultReason
    || (response.status >= 500 || response.status === 501 ? "no_verified_data" : "unsupported_route");
  return {
    ...response.body,
    results: [],
    truthMode: "unusable",
    provenance: "unknown",
    noResultReason: reason,
    message: response.body.message || noDataMessage(origin, destination, undefined, reason, country),
    officialSourceUrl: officialTimetableUrls[country],
  };
}

function tryScraped(
  query: ResolvedQuery,
  indicativeFallback = false,
): TransitSearchPayload | undefined {
  const { country, origin, destination, date, time } = query;
  const found = findScrapedSearchability(country, origin, destination, date);
  if (!found || found.results.length === 0) return undefined;
  const scraped = filterByTime(found.results, time);
  if (scraped.length === 0) {
    return {
      results: [],
      source: "scraped",
      provenance: found.decision.provenance,
      truthMode: found.decision.truthMode,
      noResultReason: "no_service",
    };
  }
  return {
    results: scraped,
    source: "scraped",
    provenance: found.decision.provenance,
    truthMode: found.decision.truthMode,
    ...(indicativeFallback && found.decision.truthMode === "indicative" ? { fallback: "indicative" as const } : {}),
  };
}

/**
 * Which requested endpoint has no timetable behind it.
 *
 * Only meaningful for `scraped` countries: their picker lists a full line map
 * while the data covers a few corridors, so a 404 is usually "we never had this
 * station" rather than "the fetch failed". Returns undefined when both
 * endpoints are covered — then the pair itself is the gap, not the stations.
 */
function findCoverageGap(
  country: Country | undefined,
  origin: string,
  destination: string,
  date?: string,
): CoverageGap | undefined {
  if (!country || coverageModeFor(country) !== "scraped") return undefined;

  // A date with no rows does not mean the endpoints disappeared from the
  // network. Fall back to all dated slices so the response can distinguish an
  // uncovered station from a covered route with no service on this day.
  const names = getScrapedCoverageNames(country, date);
  const coverageNames = names.length > 0 ? names : getScrapedCoverageNames(country);
  if (coverageNames.length === 0) return undefined;

  const keys = new Set(coverageNames.map(stationSearchKey));
  const uncovered = [origin, destination].filter(
    (name) => name && !hasCoverage(keys, name, country),
  );
  if (uncovered.length === 0) return undefined;

  return { uncovered, suggestions: coverageNames };
}

function noDataMessage(
  origin: string,
  destination: string,
  gap: CoverageGap | undefined,
  reason?: NoResultReason,
  country?: Country,
): string {
  if (reason === "future_date_unavailable") {
    // Only name the today-only rule when this country actually has it. Without a
    // country we cannot know, so fall through to the generic range wording
    // rather than borrowing another market's capability flag.
    return country !== undefined && getCountryCapability(country).liveOnly
      ? "This data source is available only for the current local service day. Choose today to search it."
      : "This timetable is available only within its published service-date range. Choose a date in that range to search it.";
  }
  if (reason === "no_verified_data") {
    return "No verified timetable data is available for this country or date. Check the operator's official timetable.";
  }
  if (reason === "no_service") {
    return `The route exists, but no departures are published for ${origin} → ${destination} on this service day.`;
  }
  if (!gap) {
    return `No supported timetable data found for ${origin} → ${destination}. This route may not be covered yet.`;
  }
  const stations = gap.uncovered.join(" and ");
  const noun = gap.uncovered.length > 1 ? "stations are" : "station is";
  return (
    `No timetable data covers ${stations} — ${
      gap.uncovered.length > 1 ? "those" : "that"
    } ${noun} in the station map but not yet in TransitRail's timetables. ` +
    `Covered stations for this country: ${gap.suggestions.join(", ")}.`
  );
}

function noResultReasonFor(
  country: Country | undefined,
  origin: string,
  destination: string,
  date: string,
  gap: CoverageGap | undefined,
  providerNoService = false,
): NoResultReason {
  if (providerNoService) return "no_service";
  const dateDecision = country
    ? decideSearchability({ country, serviceDay: date })
    : undefined;
  if (dateDecision?.reason === "unsupported_date") {
    return "future_date_unavailable";
  }
  if (country && getCountryCapability(country).search.kind === "catalog_only") {
    return "no_verified_data";
  }
  if (country && coverageModeFor(country) === "scraped") {
    const decision = noResultPolicyDecision(country, origin, destination, date);
    if (decision?.reason) return toNoResultReason(decision.reason);
    if (gap?.uncovered.length) return "no_verified_data";
  }
  return "unsupported_route";
}

function noResultPolicyDecision(
  country: Country | undefined,
  origin: string,
  destination: string,
  date: string,
): SearchabilityDecision | undefined {
  if (!country || coverageModeFor(country) !== "scraped") return undefined;
  return decideRouteContextSearchability(getScrapedRoutes(country), {
    country,
    serviceDay: date,
    origin,
    destination,
  });
}

/**
 * Resolve a journey search. Does not write audit logs — the HTTP edge does that.
 */
export async function runTransitSearch(input: TransitSearchInput): Promise<TransitSearchResult> {
  const { origin, destination, date, time } = input;
  const countryValue = input.country;
  const resolvedCountry =
    countryValue && configuredCountryOptions.includes(countryValue as Country)
      ? (countryValue as Country)
      : undefined;

  let statusCode = 200;
  let payload: TransitSearchPayload | undefined;
  let providerNoService = false;

  const requestedDateDecision = resolvedCountry
    ? decideSearchability({ country: resolvedCountry, serviceDay: date })
    : undefined;

  if (resolvedCountry && requestedDateDecision?.reason === "unsupported_date") {
    statusCode = 422;
    payload = {
      error: "Date unavailable",
      message: noDataMessage(origin, destination, undefined, "future_date_unavailable", resolvedCountry),
      results: [],
      noResultReason: "future_date_unavailable",
      truthMode: "unusable",
      provenance: "unknown",
      officialSourceUrl: officialTimetableUrls[resolvedCountry],
    };
  } else if (resolvedCountry) {
    const { search } = getCountryCapability(resolvedCountry);
    // Non-optional inside this branch. `strictNullChecks` is off in this repo,
    // so passing the outer optional here would compile even when it is
    // undefined — state the guarantee instead of assuming it.
    const resolvedQuery: ResolvedQuery = { country: resolvedCountry, origin, destination, date, time };

    if (search.kind === "catalog_only") {
      statusCode = 422;
      payload = {
        error: "Timetable unavailable",
        message:
          "Malaysia currently provides an official station catalog derived from historical data.gov.my ridership files. Those files do not contain train schedules or real-time arrivals, so no timetable is shown.",
        results: [],
        source: "data.gov.my historical ridership station catalog",
        truthMode: "unusable",
        provenance: "unknown",
      };
    } else if (search.kind === "provider" || search.kind === "provider_then_scraped") {
      const providerResponse = await runProvider(search.provider, origin, destination, date, time);
      if (search.kind === "provider") {
        statusCode = providerResponse.status;
        payload = providerResponse.status >= 200 && providerResponse.status < 300
          ? providerPayloadWithPolicy(resolvedQuery, providerResponse.body).payload
          : providerFailurePayload(resolvedQuery, providerResponse);
        providerNoService = providerResponse.status >= 200
          && providerResponse.status < 300
          && providerResponse.body.results.length === 0;
      } else if (
        providerResponse.status >= 200 &&
        providerResponse.status < 300 &&
        providerResponse.body.results.length > 0
      ) {
        const governed = providerPayloadWithPolicy(resolvedQuery, providerResponse.body);
        if (governed.decision.searchable) {
          statusCode = providerResponse.status;
          payload = governed.payload;
        }
      }
    }

    if (!payload && (search.kind === "scraped" || search.kind === "provider_then_scraped")) {
      payload = tryScraped(resolvedQuery, search.kind === "provider_then_scraped");
    }
  } else if (countryValue) {
    // Non-option country string: refuse rather than cast to Country.
    statusCode = 400;
    payload = {
      error: "Invalid country",
      message: `Country must be one of ${configuredCountryOptions.join(", ")}.`,
      results: [],
    };
  } else {
    // No country: try nothing for scrapes (need country key for cache).
    payload = undefined;
  }

  if (!payload) {
    statusCode = 404;
    const coverageGap = findCoverageGap(resolvedCountry, origin, destination, date);
    const policyDecision = noResultPolicyDecision(resolvedCountry, origin, destination, date);
    const noResultReason = noResultReasonFor(
      resolvedCountry,
      origin,
      destination,
      date,
      coverageGap,
      providerNoService,
    );
    payload = {
      error: "No data available",
      message: noDataMessage(origin, destination, coverageGap, noResultReason, resolvedCountry),
      results: [],
      source: "scraped",
      truthMode: policyDecision?.truthMode || "unusable",
      provenance: policyDecision?.provenance || "unknown",
      coverageGap,
      noResultReason,
      officialSourceUrl: resolvedCountry ? officialTimetableUrls[resolvedCountry] : undefined,
    };
  }

  if (payload.results.length === 0 && resolvedCountry && !payload.noResultReason) {
    const coverageGap = payload.coverageGap || findCoverageGap(resolvedCountry, origin, destination, date);
    const noResultReason = noResultReasonFor(
      resolvedCountry,
      origin,
      destination,
      date,
      coverageGap,
      providerNoService,
    );
    payload.noResultReason = noResultReason;
    payload.coverageGap = coverageGap;
    payload.officialSourceUrl = payload.officialSourceUrl || officialTimetableUrls[resolvedCountry];
    payload.message = payload.message || noDataMessage(origin, destination, coverageGap, noResultReason, resolvedCountry);
  }

  // Service-day availability is a separate public contract from journey rows.
  // Keep it visible for an expected no-service/unknown-route response too;
  // otherwise an empty result would be indistinguishable from a source failure.
  if (payload && resolvedCountry === "france") {
    payload.serviceDayAdvisory = await getFranceServiceDayAdvisory(
      origin,
      destination,
      date,
      time,
    );
  }

  if (payload && resolvedCountry === "thailand") {
    payload.serviceDayAdvisory = await getThailandServiceDayAdvisory(
      origin,
      destination,
      date,
      time,
    );
  }

  if (payload && resolvedCountry === "singapore") {
    payload.serviceDayAdvisory = await getSingaporeServiceDayAdvisory(
      origin,
      destination,
      date,
      time,
    );
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
      await recordError({
        severity: "warning",
        module: "transit-search",
        operation: "results.enrich-lines",
        errorCode: "RESULT_ENRICHMENT_FAILED",
        error: e,
        country: resolvedCountry,
        context: { origin, destination, date },
      });
    }
  }

  payload.dataStatus = describeSearchData(payload.source, resolvedCountry);
  return { statusCode, payload };
}
