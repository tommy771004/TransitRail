# TransitRail Context

TransitRail helps people find cross-border transit journeys from verified timetable data. This context defines the language shared by search, station discovery, and public route information.

## Searchability

**Searchable route**:
A transit route that TransitRail may present as an answer for a specific service day, origin, destination, and data source.
_Avoid_: available route, supported route

**Searchability policy**:
The rules that determine whether a route is searchable and, when it is not, the reason that should be explained.
_Avoid_: coverage check, availability flag

**Service day**:
The calendar day on which a passenger intends to travel and for which a journey answer is requested.
_Avoid_: scrape date, data date

**Indicative timetable**:
Timetable information that describes an expected service pattern but is not verified for the requested service day.
_Avoid_: exact timetable, live result

**Verified timetable**:
Timetable information whose departures and service conditions are confirmed for the requested service day.
_Avoid_: live timetable, current timetable

**Canonical snapshot**:
A stable representative timetable used as the source for indicative timetable information.
_Avoid_: fallback schedule

**Indicative fallback**:
An explicitly marked indicative timetable shown when the preferred source cannot answer the requested service day and policy permits a representative answer.
_Avoid_: silent fallback, exact fallback

**Provenance**:
The source identity and trust context attached to timetable, station, or line information.
_Avoid_: source label

## Journeys and discovery

**Journey**:
A passenger's requested movement from an origin station to a destination station, including direct travel or transfer legs.
_Avoid_: trip result, route result

**Station and line catalog**:
The set of stations and lines that TransitRail may present for a country and search context, together with their provenance and searchability.
_Avoid_: station menu, station list

## Public information

**Route publication**:
The public representation of validated route data, including route facts, readable timetable pages, and structured metadata.
_Avoid_: SEO page, generated page

Indicative timetable information may appear in route publication as general route information, but only verified timetable information may make date-specific claims.
