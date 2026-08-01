# Spec: Searchability policy across journeys, catalogs, and route publication

Status: ready-for-agent

## Problem Statement

TransitRail currently answers “Can this route be trusted for my service day?” inconsistently. Date-specific coverage, authenticity, aliases, reachable destinations, live-provider failure, canonical snapshots, no-result reasons, station discovery, line filtering, and route publication are distributed across multiple modules.

This creates visible drift: a station may appear in the station and line catalog but fail in journey search; a provider-backed country may fall back to a canonical snapshot without one consistent truth label; and route publication may recompute indicative versus verified status independently. Maintainers must update multiple policy copies whenever a country, source, alias, or service-day rule changes.

## Solution

Introduce one highest seam: a `Searchability policy` contract that determines whether a route is searchable for a country, service day, origin, destination, and provenance, and explains rejected answers.

The four architecture areas share this contract:

- `Journey search coordinator` resolves journeys through provider and snapshot adapters, then finalizes results using the policy decision.
- `Station and line catalog` presents stations and lines valid for the search context, including provenance and searchability.
- `Route publication` creates general route information and structured metadata from validated route facts, preserving indicative status and allowing date-specific claims only for verified timetables.
- Source adapters only read and normalize source data. They do not decide trust, silently synthesize a timetable, or reinterpret a service day.

When a preferred live provider cannot answer, an `indicative fallback` is allowed only when policy permits it and the result remains visibly indicative.

## User Stories

1. As a passenger, I want a route answer evaluated for my requested service day, so that a timetable from another date is not presented as exact.
2. As a passenger, I want a clear explanation when a route is not searchable, so that an empty result is not mistaken for an application failure.
3. As a passenger, I want indicative timetable information visibly marked, so that I can distinguish a representative service pattern from a verified timetable.
4. As a passenger, I want direct and transfer journeys to use the same searchability rules, so that transfer chaining does not bypass trust checks.
5. As a passenger, I want station aliases to resolve consistently, so that a familiar station name does not fail in one part of the product and succeed in another.
6. As a passenger, I want reachable destinations to reflect the requested origin and service day, so that the station picker does not offer dead-end choices.
7. As a passenger, I want provider failure to produce either a clearly marked indicative fallback or a useful rejection reason, so that the product never silently guesses.
8. As a passenger, I want line information to match routes I can actually search, so that line discovery does not promise unavailable service.
9. As a passenger, I want public route information to state when its timetable is indicative, so that general route guidance is not confused with a date-specific departure promise.
10. As a passenger, I want date-specific route publication to use only verified timetable information, so that indexed pages do not overstate certainty.
11. As a station-picker user, I want station options filtered by the same searchability policy as journey search, so that selecting an option leads to a meaningful search.
12. As a station-picker user, I want provenance exposed when it affects trust, so that I understand whether information is live, verified, or indicative.
13. As a line-picker user, I want line filtering to use the same service-day policy as station filtering, so that the catalog remains internally consistent.
14. As a route-publication consumer, I want general route pages to preserve indicative status in visible copy and structured metadata, so that search engines and readers receive the same truth mode.
15. As a route-publication consumer, I want route facts, timetable rows, and JSON-LD to agree on verified versus indicative status, so that no output channel makes a stronger claim than the source supports.
16. As a provider-adapter maintainer, I want adapters to normalize raw provider responses without owning searchability policy, so that provider-specific changes stay local.
17. As a snapshot maintainer, I want canonical snapshots treated as representative data rather than silently converted into exact dates, so that freshness limitations remain visible.
18. As a country maintainer, I want country-specific authenticity and fallback rules declared in one policy seam, so that adding a country does not require hunting through search, catalog, scraper, and publication logic.
19. As a maintainer, I want the same fixture to verify catalog, journey search, no-result classification, and route publication, so that cross-module drift is detected before release.
20. As a maintainer, I want a policy decision to carry provenance and truth mode, so that downstream modules do not infer trust from an empty field or source name.
21. As a maintainer, I want malformed, stale, or missing source data to fail closed when no permitted fallback exists, so that invalid data cannot become a plausible answer.
22. As a maintainer, I want existing provider, snapshot, and artifact sources to remain replaceable adapters, so that the architecture can evolve without changing the user-facing contract.
23. As a maintainer, I want route publication to consume validated route facts rather than reinterpret raw timetable files, so that publication cannot drift from runtime searchability.
24. As a maintainer, I want the journey search coordinator to own result finalization and fallback orchestration, so that API callers do not duplicate provider and snapshot policy.
25. As a maintainer, I want the station and line catalog to own discovery output and provenance assembly, so that UI and build-time catalog consumers see the same result model.
26. As a maintainer, I want all four architecture areas in scope under one coherent policy, so that improving one surface does not create a new source of truth elsewhere.

## Implementation Decisions

- The primary seam is the `Searchability policy` contract. It is the highest point at which service-day truth, provenance, truth mode, searchable-route decisions, and rejection reasons can be tested together.
- The policy is the sole owner of country/date authenticity, alias resolution, reachable destinations, canonical snapshot interpretation, indicative fallback permission, and no-result classification.
- A `service day` is the passenger’s requested travel date. A scrape date or source publication date is not a substitute for it.
- A `verified timetable` may make date-specific claims. An `indicative timetable` may describe a representative service pattern but may not be represented as an exact service-day answer.
- Source-specific readers are adapters. They read and normalize live provider data, scraped files, canonical snapshots, and country artifacts; they do not decide trust or synthesize departures.
- The `Journey search coordinator` consumes policy decisions while orchestrating provider and snapshot adapters, fallback behavior, journey result finalization, and result-level provenance.
- The `Station and line catalog` consumes the same policy decisions and must not maintain an independent country/date authenticity matrix.
- The `Route publication` module consumes validated route facts and preserves truth mode in page copy and structured metadata. Indicative information may be published as general route information; only verified information may make date-specific public claims.
- All four architecture areas are in scope. Migration must preserve permitted current behavior while removing duplicated policy logic as each consumer adopts the shared seam.
- No new timetable synthesis is introduced. The solution improves ownership and consistency of existing live, scraped, snapshot, and artifact data.

## Testing Decisions

- Tests assert externally observable behavior, not private helper structure, call counts, or internal module count.
- The highest-value test seam is the `Searchability policy` contract with table-driven fixtures covering country, service day, origin, destination, aliases, provenance, truth mode, and rejection reason.
- Reuse the same fixtures across station and line catalog, journey search, no-result classification, and route publication tests to detect cross-module drift.
- Search tests cover exact verified data, permitted indicative fallback, forbidden fallback, future service days, unavailable service days, alias resolution, direct journeys, transfer journeys, and reachable-destination filtering.
- Catalog tests cover station/line consistency with searchability, origin-aware destinations, provenance, strict authenticity filtering, live-source failure, and snapshot-backed countries.
- Route publication tests cover general indicative route information, verified date-specific claims, visible truth labels, structured metadata truth labels, and exclusion of unsupported date-specific claims.
- Adapter tests cover source normalization and malformed or stale source behavior; they do not duplicate policy tests.
- Data-lifecycle tests cover canonical snapshot round trips, date slicing, snapshot fallback equivalence, and fail-closed behavior for malformed or empty inputs.
- Extend the existing station coverage, catalog, journey search, scraper merge, authenticity, and data-integrity test patterns rather than creating isolated policy copies.

## Out of Scope

- Adding new live transit providers or new countries.
- Rewriting provider adapters, scrapers, or Seoul artifacts beyond normalization required by the shared policy seam.
- Inventing or synthesizing timetable departures when source data is absent.
- Changing visual design, station-picker interaction model, or route-page information architecture.
- Replacing the existing API transport or introducing a new persistence layer.
- Making every indicative timetable searchable; country and source policy still controls permission.
- Making indicative information eligible for date-specific public claims.
- Treating a successful HTTP response, non-empty file, or provider name as proof of a verified timetable.

## Further Notes

- The domain glossary is recorded in `CONTEXT.md` and is free of implementation details.
- The proposed ADR records the policy-controlled indicative fallback and its publication constraint because the choice is hard to reverse, surprising without context, and reflects a coverage-versus-certainty trade-off.
- The existing architecture review remains rationale for the four candidates; this local spec is the implementation source of truth for the agreed direction.
