# 01 — Establish the date-qualified service-region catalog

**What to build:** Give every station-browser caller one authoritative, date-qualified catalog containing service regions, searchable lines, searchable stations, coverage/provenance context, and an honest no-data message. The new contract must coexist with current catalog consumers so this foundational change can land without breaking the application. This ticket implements the catalog foundation defined by parent spec tommy771004/TransitRail#19.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A catalog request for a country and exact service date returns stable service-region identities with ordered lines and stations.
- [ ] Urban networks are assigned to their product service area, while cross-area rail is assigned once to a national/intercity service region.
- [ ] Every exposed line is independently searchable on the requested date and contains at least two date-qualified stations.
- [ ] Empty regions are omitted, and markets with no verified searchable departures return no regions, lines, or stations plus a clear policy-derived message.
- [ ] Frequency-only and service-hours data remain available as advisory/source context but do not make catalog entries searchable.
- [ ] Existing station and line catalog consumers continue to work as projections of the same authoritative catalog result.
- [ ] Runtime and generated catalogs use the same hierarchy construction behavior and do not allow a dateless or stale artifact to bypass exact-date verification.
- [ ] Contract tests cover a mixed metro/intercity market, an artifact-backed metro market, frequency-only, catalog-only, and no-source markets using a pinned market-local clock.
- [ ] Tests prove hierarchy construction does not perform pairwise journey searches for every station combination.
- [ ] The repository lint gate passes.
