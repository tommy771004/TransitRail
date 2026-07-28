# First/Last Train, Service Calendar, and Last-Train Risk

**Status:** ready-for-agent

## Problem Statement

TransitRail can return timetable results, but an international traveler still has to infer whether the selected date follows a weekday, weekend, holiday, or exceptional service pattern. The traveler also cannot reliably tell when service begins, when the final usable journey departs, or whether a selected departure time is dangerously close to the end of service.

This is especially risky in an unfamiliar city, where the published “last train” may vary by station, direction, destination, transfer, operating day, and service that continues after midnight. A generic network operating-hours label is not sufficient.

The current data pipeline also has uneven market coverage. Some countries have unauthenticated public APIs, some publish official HTML or PDF timetables suitable for Playwright extraction, some require API keys, and some have no reliable public timetable source. TransitRail must add this feature without fabricating coverage, treating partial journey results as a complete day, or exposing scraper and provider diagnostics to users.

## Solution

Add an optional service-day advisory to a journey search. For supported country and route combinations, the advisory tells the traveler:

- Which operating-day pattern applies to the selected date.
- The first usable departure for the requested journey.
- The last usable departure for the requested journey.
- How close the selected search time is to the final usable departure.
- Whether the selected time is safe, approaching the end of service, critical, or already after the last usable departure.
- Which official source supplied the information and when TransitRail last checked or updated it.

Coverage will be capability-based and released country by country. The first phase may use only:

- Official public APIs that work without an API key or secret.
- Official operator pages or downloadable public timetables collected with Playwright.

API-key, authenticated, unofficial, or reverse-engineered purchasing endpoints are excluded from the first phase.

TransitRail will preserve the last known good service-day artifact when an upstream source fails. It will record source, parsing, validation, fallback, and query failures in the server-side operational error log and mirror a reduced event to the Admin Console telemetry stream. The user interface will show a safe availability or freshness message, never a stack trace, selector, provider response body, or internal log message.

## User Stories

1. As an international traveler, I want to know the first usable departure for my route, so that I can plan an early journey confidently.
2. As an international traveler, I want to know the last usable departure for my route, so that I do not become stranded in an unfamiliar city.
3. As a traveler selecting a future date, I want to know which service-day pattern applies, so that I do not assume weekday service runs on a weekend or holiday.
4. As a traveler searching late at night, I want to see that the selected time is approaching the final departure, so that I can leave additional margin.
5. As a traveler searching after the last usable departure, I want a clear warning, so that I can choose another date, time, or transport mode.
6. As a traveler making a transfer, I want the “last train” to mean the last complete journey to my destination, so that I am not sent onto a first leg whose connection has already ended.
7. As a traveler, I want first and last departures to be direction- and destination-aware, so that a network-wide opening-hours label does not mislead me.
8. As a traveler, I want service after midnight to remain attached to the correct operating day, so that a 00:30 or GTFS-style 24:30 departure is interpreted correctly.
9. As a traveler, I want the advisory to use the transit market’s local timezone, so that my device timezone does not change the result.
10. As a traveler, I want exceptional service to override the normal weekly pattern, so that festivals, engineering work, and holiday schedules are represented when the official source publishes them.
11. As a traveler, I want a visible source and freshness timestamp, so that I can judge how current the advisory is.
12. As a traveler, I want a link to the official operator source when available, so that I can verify important travel details.
13. As a traveler, I want unsupported markets to say that service-day information is unavailable, so that missing data is not mistaken for unlimited service.
14. As a traveler, I want partially supported markets to be labeled accurately, so that a station-level first train is not presented as a guaranteed complete journey.
15. As a traveler, I want stale fallback data to be identified, so that I know to confirm it with the operator.
16. As a mobile user, I want the advisory summarized near the journey results, so that I can understand the risk without opening every result card.
17. As a mobile user, I want critical last-train warnings to be visually distinct and accessible, so that urgency is not communicated by color alone.
18. As a screen-reader user, I want the service-day and risk state expressed in text, so that the information is fully understandable without visual cues.
19. As a user of any supported language, I want service-day and risk labels localized, so that operational terminology is not shown only in English.
20. As a user reviewing saved searches, I want the selected date and time to reproduce the same advisory, so that reopening a search does not silently change its meaning.
21. As a user with a saved route, I want to be notified when the published first or last departure changes materially, so that I can revise my plans.
22. As a user, I want timetable-change notifications to identify the affected route and service date, so that I know whether the change matters to me.
23. As a user, I want normal “no service on this date” results distinguished from technical source failures, so that I receive an accurate explanation.
24. As an operator of TransitRail, I want each market’s service-day capability declared explicitly, so that the UI never assumes global coverage.
25. As an operator of TransitRail, I want the pipeline to reject empty, partial, malformed, or internally inconsistent service-day data, so that bad scrapes never replace valid data.
26. As an operator of TransitRail, I want the last known good artifact retained when an official source is unavailable, so that a temporary outage does not erase coverage.
27. As an operator of TransitRail, I want fallback use recorded as a warning, so that degraded sources can be maintained proactively.
28. As an operator of TransitRail, I want parsing and provider failures recorded with a stable daily fingerprint, so that repeated failures are aggregated rather than flooding storage.
29. As an operator of TransitRail, I want error context scrubbed of credentials, cookies, contact details, IP addresses, and full upstream response bodies, so that operational logging remains safe.
30. As an operator of TransitRail, I want a reduced error event mirrored to the Admin Console using server-only telemetry credentials, so that failures are visible across projects.
31. As an operator of TransitRail, I want scraper failures to remain invisible in public source labels and API messages, so that users never see internal diagnostics.
32. As a developer adding a country, I want one normalized service-day contract, so that country adapters do not introduce country-specific UI branches.
33. As a developer adding an HTML source, I want parsing to run against saved official fixtures, so that markup changes are detected before deployment.
34. As a developer adding a public API source, I want parsing to run against saved response fixtures, so that schema changes are detected deterministically.
35. As a developer, I want explicit evidence that a source represents a full service day or an official first/last declaration, so that truncated journey results are never used to infer first or last service.
36. As a maintainer, I want each source adapter to state its attribution, update cadence, timezone, and coverage limits, so that data provenance is reviewable.
37. As a maintainer, I want unsupported API-key sources to remain disabled rather than silently using missing credentials, so that production behavior does not depend on undeclared secrets.
38. As a maintainer, I want a country adapter failure to leave other countries and routes operational, so that one source cannot abort the complete scheduled run.
39. As a maintainer, I want source changes to be stored atomically, so that readers never observe a half-written service-day artifact.
40. As a maintainer, I want the feature to remain additive to the existing search contract, so that current result renderers continue to work for countries without advisory coverage.

## Implementation Decisions

- Coverage is capability-based and released by country or operator, not held until all TransitRail markets can support the feature.
- The first implementation phase accepts only unauthenticated official public APIs and Playwright extraction from official public pages or downloads.
- Sources that require API keys, bearer tokens, account registration, partner agreements, or undocumented purchasing endpoints are excluded.
- The feature uses a single normalized service-day advisory contract shared by all countries and result-view families.
- The journey-search response gains an optional advisory. Existing search results remain valid when the advisory is absent.
- The normalized advisory includes:
  - Coverage state: supported, partial, stale, or unavailable.
  - Selected service date and local service timezone.
  - Operating-day type: weekday, Saturday, Sunday/holiday, or special.
  - First usable journey departure.
  - Last usable journey departure.
  - Risk state: safe, approaching, critical, missed, or unavailable.
  - Minutes between the selected query time and the last usable departure when calculable.
  - Source attribution, source URL when safe, checked time, and upstream update time when published.
  - A concise coverage or freshness note suitable for users.
- Default risk thresholds are configurable rather than embedded in country adapters:
  - Safe: more than 60 minutes before the final usable departure.
  - Approaching: 16–60 minutes before the final usable departure.
  - Critical: 0–15 minutes before the final usable departure.
  - Missed: selected time is after the final usable departure.
- “Last departure” means the last journey that reaches the requested destination through its complete leg chain. A final first-leg departure with no valid onward connection does not qualify.
- A source is eligible to produce first/last data only when it exposes a complete service day, an explicit official first/last declaration, or a journey-planning operation specifically capable of returning the first and last journey.
- Truncated search results, “next train” feeds, historical ridership, and manually assumed network operating hours cannot be used to infer a route’s first or last journey.
- Service-day calculations use the market’s configured transit timezone, not the browser timezone.
- Times beyond 24:00 are preserved through normalization and compared as part of the originating service day.
- Official date exceptions override normal weekday/weekend rules. A generic public-holiday calendar may assist classification but cannot override an operator’s published service pattern.
- Service-day artifacts are stored separately from ordinary journey-result slices because their completeness and replacement rules differ.
- Each normalized artifact carries source, coverage scope, retrieved time, source update time when available, validity dates, and validation status.
- A new artifact replaces the prior artifact only after complete parsing and validation. Empty or invalid output never overwrites the last known good artifact.
- Writes are atomic from the reader’s perspective.
- Scheduled collection failures are isolated per source, country, and route. Other collectors continue running.
- Existing operational error logging is the common failure sink for API, Playwright, parser, validation, storage, fallback, and query errors.
- Normal unsupported coverage is not an error. An expected no-service day is represented as a valid advisory state. An unexpected zero-row result from a source that should contain service is a warning.
- Public responses contain safe availability text and an optional support reference ID for server failures. They never contain internal exception details.
- The telemetry mirror remains server-only and sends only a reduced, non-identifying envelope.
- The user interface presents one advisory summary near the result set rather than duplicating the same service-day state on every journey card.
- Risk states use text and iconography in addition to color and are localized with the existing language system.
- Saved searches preserve the selected country, route, date, and time required to recompute the advisory.
- First/last changes extend the existing timetable fingerprint concept so saved-route notifications can detect material service-boundary changes.
- The initial tracer source should be an existing no-key provider capable of returning route-aware first and last journeys, minimizing new source risk while establishing the normalized contract.

## Testing Decisions

- Tests assert externally observable behavior rather than private helper calls, selector implementation, database query shape, or React component state.
- The primary test seam is the journey-search orchestration response for a fixed country, route, service date, and selected time.
- At the primary seam, tests verify:
  - Correct operating-day classification.
  - Correct first and last complete journeys.
  - Correct risk state at safe, approaching, critical, and missed boundaries.
  - Correct service-timezone and after-midnight behavior.
  - Optional advisory behavior for unsupported countries.
  - Stale fallback labeling.
  - Safe generic errors and support reference IDs for server failures.
- Source adapters have one additional contract seam using saved official HTML or JSON fixtures. These tests verify normalized output, declared coverage, and failure on incomplete or changed source structures.
- Fixture tests never call live operator websites during the automated test suite.
- Validation tests prove that truncated results, empty scrapes, invalid dates, impossible time ordering, and incomplete transfer chains cannot replace a known-good artifact.
- Logging tests verify observable privacy and aggregation behavior: stable fingerprinting, route separation, daily aggregation, secret removal, and reduced telemetry fields.
- Notification tests verify that a changed first or last usable departure is material, while retrieval timestamps alone do not trigger an alert.
- UI verification focuses on rendered advisory states, localization, accessibility text, and the absence of technical diagnostics.
- Existing timetable canonical-day and country-capability tests are prior art for deterministic schedule normalization and explicit per-country policy.
- The normal project gate remains TypeScript typechecking plus the existing Vitest suite.

## Out of Scope

- Any source that requires an API key, secret, login, paid plan, partner agreement, or operator approval.
- Reverse engineering undocumented booking or ticket-inventory endpoints.
- Purchasing, reserving, changing, or refunding tickets.
- Seat availability and real-time ticket inventory.
- Personalized visa, immigration, customs, or legal eligibility advice.
- Guaranteeing a connection when an operator does not publish a guaranteed connection.
- Inferring first or last service from a limited “next departures” response.
- Presenting historical ridership as a timetable.
- Universal launch across all TransitRail markets in the first release.
- Live crowding, live vehicle location, and live platform prediction unless already supplied by an existing provider for another feature.
- A public or browser-accessible operational log viewer.
- Exposing telemetry credentials, database diagnostics, stack traces, selectors, or upstream response bodies.

## Further Notes

- Existing no-key integrations and official downloadable feeds should be preferred before adding new Playwright sources.
- Playwright is a fallback acquisition strategy for official pages, not permission to scrape unofficial aggregators or bypass access controls.
- Markets that currently expose only partial or curated timetable snapshots must remain unsupported or partial until a qualifying full-day source is connected.
- Markets excluded because of API-key requirements can be reconsidered in a later phase without changing the normalized advisory contract.
- The first implementation should prove one narrow, complete path from official source through scheduled normalization, journey-search response, mobile UI, tests, error logging, and freshness labeling.
