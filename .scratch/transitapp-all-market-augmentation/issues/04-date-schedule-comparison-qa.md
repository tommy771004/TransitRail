# 04 — Build a guarded date-schedule comparison QA tool

**What to build:** Add an operator-only comparison tool for Transit App’s Preview date schedule APIs. It should help identify potential coverage gaps or discrepancies in supported markets while enforcing that third-party Preview results can never become a searchable, published, or persisted timetable.

**Blocked by:** Ticket 01 — comparison requests require the same verified coverage and runtime identity resolution.

**Status:** ready-for-agent

- [ ] The tool accepts an exact requested date within Transit App’s documented request bound and reports the requested date, returned date identity when present, provider/network, retrieval time, freshness, and comparison classification.
- [ ] It classifies empty responses, non-matching dates, out-of-range requests, unknown/stale freshness, missing coverage, and Preview/API errors as `unavailable` or another explicitly non-service conclusion; none may mean “no trains”.
- [ ] It compares third-party information only against already verified TransitRail data and labels every output as an operator QA signal, not a product timetable.
- [ ] Output is intentionally bounded, redacts keys/raw personal data/unstable IDs, and cannot be reached by anonymous product traffic as a substitute for normal search.
- [ ] No comparison result writes scraped-route files, source registry entries, service-day artifacts, static catalog output, sitemap/SEO input, or search index data.
- [ ] Tests use pinned provider fixtures to cover matching and mismatched dates, each unavailable class, time-zone boundary handling, the Preview request limit, output redaction, and the non-persistence boundary.
- [ ] A regression test proves a generated comparison report cannot alter existing exact-date search responses or route-publication eligibility.
- [ ] The repository lint gate passes.
