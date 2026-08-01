# 08 — Verify all outputs and remove duplicate policy decisions

**What to build:** TransitRail proves that Journey search, the Station and line catalog, indicative fallback, no-result explanations, and Route publication agree for the same source fixtures. Once the shared behavior is verified, consumer-specific copies of Searchability policy are removed so future changes have one place of truth.

**Blocked by:** 03 — Apply Searchability policy to journey service days and no-result reasons; 04 — Make indicative fallback explicit in journey search; 05 — Filter the station catalog by service day and origin; 06 — Align line catalog with searchable routes; 07 — Preserve truth mode in route publication.

**Status:** ready-for-agent

- [ ] Shared fixtures prove identical verified, indicative, stale, and rejected outcomes across all four architecture areas.
- [ ] Shared fixtures prove identical alias, reachable-destination, service-day, provenance, and no-result decisions.
- [ ] No consumer independently reimplements country/date authenticity or indicative-fallback permission.
- [ ] A malformed or stale source fails closed consistently across search, catalog, and publication.
- [ ] The full project lint and test gate passes after duplicate policy logic is removed.
