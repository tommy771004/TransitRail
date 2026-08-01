# 02 — Establish the Searchability policy truth-mode contract

**What to build:** TransitRail has one policy decision for a route, country, service day, origin, destination, and provenance. The decision states whether the route is searchable, its truth mode, and the reason when it is rejected, so downstream consumers no longer infer trust from source names or empty results.

**Blocked by:** 01 — Normalize source provenance and canonical snapshots.

**Status:** ready-for-agent

- [ ] The policy distinguishes searchable verified timetable, permitted indicative timetable, stale data, and no usable data.
- [ ] The policy applies alias resolution and reachable-destination rules consistently.
- [ ] The policy returns a stable rejection reason for unsupported date, unavailable route, unavailable coverage, and no departures.
- [ ] The same table-driven fixtures cover country, service day, origin, destination, provenance, and truth mode.
- [ ] Existing covered routes retain their current externally visible searchability unless the source is classified as untrustworthy.
