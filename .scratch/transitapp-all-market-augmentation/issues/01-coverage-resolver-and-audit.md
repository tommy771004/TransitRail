# 01 — Establish Transit App coverage resolution and audit

**What to build:** Create the server-side Transit App integration foundation that can prove whether an existing TransitRail station is covered by a non-beta Transit App network, without changing any timetable search result. Deliver a repeatable all-market audit report and a typed runtime resolver that later user-facing features can safely consume.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A server-only `TRANSIT_APP_API_KEY` configuration is documented and optional; a missing key produces an explicit unavailable state and never reaches browser code, public artifacts, telemetry, or logs.
- [ ] The adapter normalizes upstream errors, timeouts, rate limits, empty responses, freshness metadata, and provider/network identity into a stable supplementary-data contract.
- [ ] Given a TransitRail station coordinate and country, coverage discovery checks available networks, excludes beta and unapproved networks, then confirms the resolved Transit App stop belongs to the selected network.
- [ ] A missing coordinate, ambiguous stop match, unavailable network, or upstream failure is classified as unavailable/ambiguous coverage; the implementation never invents a third-party stop ID.
- [ ] Transit App network, stop, and trip IDs are runtime-only and use bounded short-term caching with expiry; no IDs are added to the station catalog or persisted scraped route data.
- [ ] A repeatable audit command writes or prints per-market counts for resolved, uncovered, ambiguous, missing-coordinate, and unavailable stations, with enough identifiers for an operator to investigate safely.
- [ ] Fixture tests cover accepted networks, beta exclusion, station/network mismatch, duplicate candidate stations, empty results, timeouts, cache expiry, and secret redaction.
- [ ] A regression test proves the existing exact-date timetable search does not instantiate or call the Transit App adapter.
- [ ] The repository lint gate passes.
