# 03 — France GTFS service-day advisory

**What to build:** A supported France journey search derives its service-day type and first/last usable journeys from a qualifying official, unauthenticated GTFS download collected on schedule. The user receives the shared advisory while TransitRail safely retains the last valid feed when downloads or validation fail.

**Blocked by:** 01 — London first/last advisory tracer.

**Status:** ready-for-agent

- [ ] The selected official feed is publicly downloadable without a key, login, partner agreement, or undocumented endpoint, and its attribution and coverage limits are recorded.
- [ ] Scheduled collection produces a validated service-day artifact containing its validity range, source, retrieval time, source update time when available, timezone, and coverage scope.
- [ ] Weekly calendars and date-specific additions or removals classify the selected service date correctly, with explicit exceptions overriding the regular weekly pattern.
- [ ] First and last departures are route-, direction-, origin-, and destination-aware and exclude incomplete transfer chains.
- [ ] GTFS times greater than 24:00 retain their originating service day and are ordered correctly in first/last and risk calculations.
- [ ] A supported France search returns the shared advisory and renders it through the common localized result UI.
- [ ] Feed fixtures cover regular service, a holiday exception, service removal, service addition, times beyond 24:00, and an invalid or partial archive.
- [ ] Empty, expired, malformed, or inconsistent feeds are rejected before publication and never overwrite the last known good artifact.
- [ ] Artifact publication is atomic from the search reader's perspective; a collection failure records sanitized operational context and does not interrupt other collectors.
- [ ] Stale fallback data is clearly labeled to the user without revealing downloader, parser, storage, or telemetry diagnostics.
- [ ] Typechecking and the existing automated test suite pass.
