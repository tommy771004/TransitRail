/**
 * The single decision seam shared by journey search, station/line discovery,
 * and route publication.
 *
 * Adapters may normalize source facts before calling this module, but they do
 * not decide whether a fact is trustworthy for the passenger's service day.
 * This module owns that decision, including station aliases and the bounded
 * route graph used by scraped/catalog-backed markets.
 */
import type {
  Country,
  NoResultReason,
  TimetableProvenance,
  TransitResult,
} from "../types";
import {
  configuredCountryOptions,
  countryConfig,
  isSearchDateAllowed,
} from "./countries";
import { getCountryCapability } from "./countryCapability";
import { resolveStationAlias } from "./stationAliases";
import { stationSearchKey } from "./stationKey";
import {
  classifyTimetable,
  authenticityOptionsFor,
  isVerifiableTimetable,
  normalizeTimetableSource,
  timetableSliceForDate,
  truthModeFor,
  type TimetableAuthenticity,
  type NormalizedTimetableProvenance,
  type TimetableAuthenticityOptions,
  type TimetableSnapshot,
  type TimetableSourceFact,
  type TimetableTruthMode,
} from "./timetableAuthenticity";
import { findInRoutes, type ScrapedRouteData } from "./scraped/timetableDay";

/** Stable policy reasons. API-specific reason names are mapped at the edge. */
export type SearchabilityRejectionReason =
  | "unsupported_date"
  | "unavailable_route"
  | "unavailable_coverage"
  | "no_departures";

export interface SearchabilityPolicyRequest {
  country: Country;
  /** Passenger-requested service day, never a scrape/publication date. */
  serviceDay?: string;
  origin?: string;
  destination?: string;
  /** Raw adapter output, normalized here when sourceFact is not supplied. */
  source?: unknown;
  /** Already-normalized adapter fact for callers that own source I/O. */
  sourceFact?: TimetableSourceFact;
  /** Optional fixed clock for deterministic policy tests. */
  now?: Date;
}

export interface SearchabilityDecision {
  searchable: boolean;
  truthMode: TimetableTruthMode;
  provenance: NormalizedTimetableProvenance;
  reason?: SearchabilityRejectionReason;
  country: Country;
  serviceDay: string;
  origin?: string;
  destination?: string;
  resolvedOrigin?: string;
  resolvedDestination?: string;
  /** True when the selected rows carry no exact passenger service date. */
  canonicalSnapshot: boolean;
  sourceServiceDay?: string;
  sourceFact?: TimetableSourceFact;
  reachableDestinations: string[];
}

export interface SearchabilityRouteSelection {
  routes: ScrapedRouteData[];
  decisions: SearchabilityDecision[];
  covered: string[];
  reachableDestinations: string[];
}

export interface SearchabilitySummary {
  searchable: boolean;
  truthMode: TimetableTruthMode;
  provenance: NormalizedTimetableProvenance;
  reason?: SearchabilityRejectionReason;
}

/**
 * Stamp results with the verdict the policy reached for them.
 *
 * Every path that returns rows to a caller has to carry the same two fields,
 * including the `"unknown"` → `undefined` narrowing that keeps an unrecognised
 * provenance off the wire. Three copies of this shape had drifted apart across
 * the journey and snapshot paths; keep it in one place next to the decision.
 */
export function tagResultsWithDecision<T extends object>(
  results: readonly T[],
  decision: Pick<SearchabilityDecision, "provenance" | "truthMode">,
): Array<T & { provenance: TimetableProvenance | undefined; truthMode: TimetableTruthMode }> {
  return results.map((result) => ({
    ...result,
    provenance: decision.provenance === "unknown" ? undefined : decision.provenance,
    truthMode: decision.truthMode,
  }));
}

/**
 * Whether a country's station and line menus are trimmed to what its committed
 * timetables can actually answer.
 *
 * This is the one remaining per-country gate. The timetable gate that used to
 * sit beside it is now unconditional — every market rejects unverified rows —
 * so it is no longer a country's decision to make and no longer stored.
 */
export function usesStrictCatalogGate(country?: Country): boolean {
  return country !== undefined && countryConfig[country].authenticityGates.catalog;
}

function equivalentStation(country: Country, left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return stationSearchKey(resolveStationAlias(country, left))
    === stationSearchKey(resolveStationAlias(country, right));
}

/**
 * Normalize whatever the caller supplied into one source fact.
 *
 * Routes read from disk and routes handed over by an adapter go down the same
 * path. They used to diverge — an "already normalized" adapter route got a
 * looser classifier that trusted its own `provenance` field and accepted a
 * dateless snapshot as an answer — which meant the same rows could be verified
 * or unusable depending on which door they came through.
 */
function normalizeRequestSource(request: SearchabilityPolicyRequest): TimetableSourceFact | undefined {
  if (request.sourceFact) return request.sourceFact;
  if (request.source === undefined) return undefined;
  return normalizeTimetableSource(
    request.source,
    request.serviceDay,
    authenticityOptionsFor(request.country, request.now),
  );
}

function canonicalSnapshotFor(fact: TimetableSourceFact | undefined): boolean {
  const rows = fact?.snapshot?.results || [];
  return rows.length > 0 && rows.every((result) => !result.date);
}

function pairIsCovered(
  country: Country,
  snapshot: TimetableSnapshot | undefined,
  origin: string | undefined,
  destination: string | undefined,
): boolean {
  if (!snapshot || !origin || !destination) return true;
  if (equivalentStation(country, snapshot.origin, origin)
    && equivalentStation(country, snapshot.destination, destination)) return true;
  return snapshot.results.some((result) => (
    equivalentStation(country, result.origin, origin)
    && equivalentStation(country, result.destination, destination)
  ));
}

function rejectionForFact(
  fact: TimetableSourceFact,
  pairCovered: boolean,
): SearchabilityRejectionReason {
  if (!pairCovered) return "unavailable_route";
  if (fact.issue === "malformed" || fact.issue === "unknown_provenance") {
    return "unavailable_coverage";
  }
  if (
    fact.issue === "empty"
    || fact.issue === "service_day_mismatch"
    || (fact.snapshot && fact.snapshot.results.length === 0)
  ) {
    return "no_departures";
  }
  return "unavailable_coverage";
}

/**
 * Decide whether one normalized source fact can answer one passenger query.
 * The returned truth mode is retained even when the answer is rejected so UI,
 * catalogs, and publication can explain the same failed decision.
 */
export function decideSearchability(request: SearchabilityPolicyRequest): SearchabilityDecision {
  const resolvedOrigin = request.origin
    ? resolveStationAlias(request.country, request.origin)
    : undefined;
  const resolvedDestination = request.destination
    ? resolveStationAlias(request.country, request.destination)
    : undefined;
  const sourceFact = normalizeRequestSource(request);
  const base = {
    country: request.country,
    serviceDay: request.serviceDay || sourceFact?.serviceDay || "",
    origin: request.origin,
    destination: request.destination,
    resolvedOrigin,
    resolvedDestination,
    canonicalSnapshot: false,
    reachableDestinations: [] as string[],
  };

  const configured = configuredCountryOptions.includes(request.country);
  const dateOutsidePublishedRange = configured
    && request.serviceDay !== undefined
    && getCountryCapability(request.country).dateRangeEnforced
    && !isSearchDateAllowed(request.country, request.serviceDay, request.now);
  if (!configured || dateOutsidePublishedRange) {
    return {
      ...base,
      searchable: false,
      truthMode: "unusable",
      provenance: "unknown",
      reason: "unsupported_date",
    };
  }

  if (!sourceFact) {
    return {
      ...base,
      searchable: false,
      truthMode: "unusable",
      provenance: "unknown",
      reason: "unavailable_coverage",
    };
  }

  const pairCovered = pairIsCovered(request.country, sourceFact.snapshot, request.origin, request.destination);
  const canonicalSnapshot = canonicalSnapshotFor(sourceFact);
  // Verified or nothing. There is no longer an "indicative" tier that a market
  // may opt into: a route either has rows a registered official source stands
  // behind for this service day, or the answer is that none is available.
  const searchable = pairCovered && isVerifiableTimetable(sourceFact.authenticity);

  return {
    ...base,
    searchable,
    truthMode: sourceFact.truthMode,
    provenance: sourceFact.provenance,
    reason: searchable ? undefined : rejectionForFact(sourceFact, pairCovered),
    canonicalSnapshot,
    sourceServiceDay: sourceFact.sourceServiceDay,
    sourceFact,
  };
}

/**
 * Decide a source that can expose coverage but does not expose individual
 * timetable rows (for example, a validated compact operator artifact).
 * Keeping the fact construction here prevents adapters from assigning their
 * own truth mode before the shared policy has evaluated it.
 */
export function decideCoverageSearchability(request: {
  country: Country;
  serviceDay?: string;
  provenance: NormalizedTimetableProvenance;
  hasCoverage: boolean;
  sourceServiceDay?: string;
}): SearchabilityDecision {
  return decideSearchability({
    country: request.country,
    serviceDay: request.serviceDay,
    sourceFact: {
      provenance: request.provenance,
      serviceDay: request.serviceDay,
      sourceServiceDay: request.sourceServiceDay,
      authenticity: request.hasCoverage ? "scraped" : "none",
      truthMode: request.hasCoverage ? "verified" : "unusable",
      issue: request.hasCoverage ? undefined : "empty",
    },
  });
}

function addRouteNames(route: ScrapedRouteData, names: Map<string, string>, country: Country): void {
  const add = (name: string | undefined) => {
    if (!name) return;
    const key = stationSearchKey(resolveStationAlias(country, name));
    if (!names.has(key)) names.set(key, name);
  };
  add(route.origin);
  add(route.destination);
  for (const result of route.results || []) {
    add(result.origin);
    add(result.destination);
    for (const stop of result.stops || []) add(stop);
  }
}

function selectedRoute(route: ScrapedRouteData, fact: TimetableSourceFact): ScrapedRouteData {
  return {
    ...route,
    results: fact.snapshot?.results || [],
    provenance: fact.provenance === "unknown" ? route.provenance : fact.provenance,
    authenticity: fact.authenticity,
    truthMode: fact.truthMode,
    sourceServiceDay: fact.sourceServiceDay,
    sourceIssue: fact.issue,
  };
}

/**
 * Apply exactly the same policy to every route in a bounded timetable graph.
 * This is the catalog/search shared fixture seam: aliases, date slices, and
 * indicative permission are evaluated before endpoint reachability is built.
 */
export function searchableRoutesForContext(
  routes: readonly ScrapedRouteData[],
  request: Omit<SearchabilityPolicyRequest, "source" | "sourceFact" | "destination"> & {
    origin?: string;
    destination?: string;
    /** Reachability facts normalized by a non-route adapter, such as an artifact. */
    additionalReachableDestinations?: readonly string[];
  },
): SearchabilityRouteSelection {
  const decisions: SearchabilityDecision[] = [];
  const accepted: ScrapedRouteData[] = [];
  const names = new Map<string, string>();

  for (const route of routes) {
    const decision = decideSearchability({
      ...request,
      origin: route.origin,
      destination: route.destination,
      source: route,
    });
    decisions.push(decision);
    if (!decision.searchable || !decision.sourceFact) continue;
    const selected = selectedRoute(route, decision.sourceFact);
    accepted.push(selected);
    addRouteNames(selected, names, request.country);
  }

  const covered = [...names.values()].sort((left, right) => left.localeCompare(right));
  const routeReachableDestinations = request.origin
    ? covered
        .filter((destination) => !equivalentStation(request.country, destination, request.origin))
        .filter((destination) => {
          return Boolean(findInRoutes(
            accepted,
            request.origin!,
            destination,
            request.serviceDay,
            request.country,
          )?.length)
            || Boolean(findInRoutes(
            accepted,
            request.origin!,
            destination,
            undefined,
            request.country,
          )?.length);
        })
    : [];
  const reachable = new Map<string, string>(
    routeReachableDestinations.map((destination) => [
      stationSearchKey(resolveStationAlias(request.country, destination)),
      destination,
    ]),
  );
  for (const destination of request.additionalReachableDestinations || []) {
    if (!request.origin || equivalentStation(request.country, destination, request.origin)) continue;
    reachable.set(stationSearchKey(resolveStationAlias(request.country, destination)), destination);
  }

  return {
    routes: accepted,
    decisions,
    covered,
    reachableDestinations: [...reachable.values()].sort((left, right) => left.localeCompare(right)),
  };
}

function decisionFromAccepted(
  decisions: SearchabilityDecision[],
  origin: string,
  destination: string,
  reachableDestinations: string[],
  found?: TransitResult[],
): SearchabilityDecision | undefined {
  const matching = found && found.length > 0
    ? decisions.filter((decision) => decision.sourceFact?.snapshot?.results.some((row) => (
        found.some((result) => result.id === row.id)
      )))
    : [];
  const accepted = (matching.length > 0 ? matching : decisions).filter((decision) => decision.searchable);
  if (accepted.length === 0) return undefined;
  const provenance = new Set(accepted.map((decision) => decision.provenance));
  return {
    ...accepted[0],
    origin,
    destination,
    resolvedOrigin: resolveStationAlias(accepted[0].country, origin),
    resolvedDestination: resolveStationAlias(accepted[0].country, destination),
    truthMode: accepted[0].truthMode,
    provenance: provenance.size === 1 ? accepted[0].provenance : "unknown",
    reachableDestinations,
  };
}

/**
 * Classify an absent journey against both the selected service day and the
 * historical route graph. This separates "the pair exists but has no
 * departures today" from "the pair/station is not covered at all".
 */
export function decideRouteContextSearchability(
  routes: readonly ScrapedRouteData[],
  request: SearchabilityPolicyRequest & { destination: string },
): SearchabilityDecision {
  const empty = decideSearchability({
    ...request,
    source: undefined,
    sourceFact: undefined,
  });
  if (empty.reason === "unsupported_date") return empty;

  const current = searchableRoutesForContext(routes, {
    country: request.country,
    serviceDay: request.serviceDay,
    origin: request.origin,
  });
  const currentResult = request.origin
    ? findInRoutes(current.routes, request.origin, request.destination, request.serviceDay, request.country)
      || findInRoutes(current.routes, request.origin, request.destination, undefined, request.country)
    : null;
  if (currentResult?.length) {
    return decisionFromAccepted(
      current.decisions,
      request.origin || "",
      request.destination,
      current.reachableDestinations,
      currentResult,
    ) || empty;
  }

  const historical = request.serviceDay
    ? searchableRoutesForContext(routes, {
        country: request.country,
        origin: request.origin,
      })
    : current;
  const historicalNames = new Set(historical.covered.map((name) => stationSearchKey(resolveStationAlias(request.country, name))));
  const originCovered = Boolean(request.origin && historicalNames.has(stationSearchKey(resolveStationAlias(request.country, request.origin))));
  const destinationCovered = historicalNames.has(stationSearchKey(resolveStationAlias(request.country, request.destination)));
  const historicalResult = request.origin
    ? findInRoutes(historical.routes, request.origin, request.destination, undefined, request.country)
    : null;
  const reason: SearchabilityRejectionReason = !originCovered || !destinationCovered
    ? "unavailable_coverage"
    : historicalResult?.length
      ? "no_departures"
      : "unavailable_route";
  return {
    ...empty,
    origin: request.origin,
    destination: request.destination,
    resolvedOrigin: request.origin ? resolveStationAlias(request.country, request.origin) : undefined,
    resolvedDestination: resolveStationAlias(request.country, request.destination),
    reason,
    reachableDestinations: current.reachableDestinations,
  };
}

export function summarizeSearchability(decisions: readonly SearchabilityDecision[]): SearchabilitySummary {
  const accepted = decisions.filter((decision) => decision.searchable);
  if (accepted.length === 0) {
    const reason = [
      "unsupported_date",
      "no_departures",
      "unavailable_route",
      "unavailable_coverage",
    ].find((candidate) => decisions.some((decision) => decision.reason === candidate)) as
      | SearchabilityRejectionReason
      | undefined;
    return {
      searchable: false,
      truthMode: "unusable",
      provenance: "unknown",
      reason: reason || "unavailable_coverage",
    };
  }
  const provenance = new Set(accepted.map((decision) => decision.provenance));
  return {
    searchable: true,
    truthMode: "verified",
    provenance: provenance.size === 1 ? accepted[0].provenance : "unknown",
  };
}

/** Map the domain reason to the existing HTTP response reason contract. */
export function toNoResultReason(reason: SearchabilityRejectionReason): NoResultReason {
  switch (reason) {
    case "unsupported_date":
      return "future_date_unavailable";
    case "unavailable_coverage":
      return "no_verified_data";
    case "no_departures":
      return "no_service";
    case "unavailable_route":
      return "unsupported_route";
  }
}

/** Route-level helper for publication and catalog consumers. */
export function routeSearchability(
  route: ScrapedRouteData,
  country: Country,
  serviceDay?: string,
  now?: Date,
): SearchabilityDecision {
  const sourceFact = normalizeTimetableSource(
    route,
    serviceDay,
    authenticityOptionsFor(country, now),
  );
  return decideSearchability({
    country,
    serviceDay,
    origin: route.origin,
    destination: route.destination,
    sourceFact,
    now,
  });
}

/** Safe authenticity options for adapter code that still needs a classifier. */
export function policyAuthenticityOptions(country: Country, now?: Date): TimetableAuthenticityOptions {
  return authenticityOptionsFor(country, now);
}

/** Keep the classifier import at the policy seam for source adapters/tests. */
export { classifyTimetable };
