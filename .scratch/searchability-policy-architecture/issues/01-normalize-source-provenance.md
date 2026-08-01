# 01 — Normalize source provenance and canonical snapshots

**What to build:** When TransitRail reads a live provider response, scraped route, canonical snapshot, or country artifact, the resulting timetable facts carry a consistent provenance and service-day meaning. A canonical snapshot remains representative data; stale, malformed, or date-mismatched data is distinguishable before searchability is decided.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A source fact identifies its provenance and whether it is verified, indicative, stale, or unusable for the requested service day.
- [x] Canonical snapshot data cannot be silently presented as a verified timetable.
- [x] Malformed, empty, or date-mismatched source data fails closed or is explicitly classified for policy handling.
- [x] Existing valid source behavior remains unchanged for the covered source fixtures.
- [x] Tests cover live, scraped, canonical snapshot, stale, malformed, and empty source cases.

## Answer

Implemented source-fact normalization across scraped loaders, snapshot/provider-backed scrapers, and Seoul artifact search. Canonical and LLM snapshots remain indicative; malformed, empty, stale, mismatched, unknown-provenance, wrong-country, and malformed provider inputs fail closed. Live rows are date-stamped before validation and requested-date slices are persisted. Official ODPT Tokyo Metro and fallback ODPT source labels are allowlisted and covered by regression tests.

Verification: `npm run lint` passed with 46 test files and 307 tests; 85 routes load successfully.
