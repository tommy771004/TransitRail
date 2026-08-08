# 04 — Report market-scoped current-day network coverage

**What to build:** Extend the existing source coverage audit with a network-coverage verdict that answers which parts of each configured product market can actually be browsed and searched today. The report must judge London as TfL and Boston as MBTA, while listing unintegrated national operators or cities separately instead of distorting the in-market verdict.

**Blocked by:** 01 — Establish the date-qualified service-region catalog.

**Status:** ready-for-agent

- [ ] Each configured market is evaluated on its own market-local current service date.
- [ ] The report states the searchable service regions, lines, and stations relative to the product's declared market topology.
- [ ] Network coverage is reported independently from source grade and timetable-time completeness.
- [ ] Markets with no verified searchable departures are reported as no searchable network rather than as an empty but complete catalog.
- [ ] Frequency-only and service-hours markets are not counted as having searchable timetable topology.
- [ ] Known operators and geographies outside the declared product market are listed as separate expansion gaps.
- [ ] The report remains generated from the authoritative catalog/source data rather than a second hand-maintained country table.
- [ ] Report generation performs no live provider query per route, station, or report row.
- [ ] Tests inject the clock and compact fixtures to verify market timezone handling, product-market denominators, partial coverage, and no-data coverage.
- [ ] The repository lint gate passes.
