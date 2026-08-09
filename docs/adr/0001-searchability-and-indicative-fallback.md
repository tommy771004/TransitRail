# Searchability policy and indicative fallback

Status: proposed

TransitRail will centralize the decision about whether a route is searchable for a service day, including provenance and the explanation for a rejected answer. When a preferred live provider cannot answer, a canonical snapshot may be used as an indicative fallback only when country and source policy permits it; the result must remain visibly indicative and must never be represented as an exact timetable. This keeps search, station discovery, and route publication aligned while preserving a fail-closed path when no trustworthy answer exists.

## Considered Options

- Fail closed whenever the preferred live provider is unavailable.
- Allow a policy-controlled, explicitly marked indicative fallback.

The second option preserves useful coverage for curated snapshot-backed countries without hiding the difference between an exact service-day answer and a representative timetable.

Indicative timetable information may enter route publication as general route information. It must retain its indicative status across page copy and structured metadata; only verified timetable information may make date-specific public claims.
