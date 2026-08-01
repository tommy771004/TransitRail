# Service-day source coverage

Service-day advisories are read from scheduled artifacts during journey search.
Upstream retrieval runs only in the scheduled scraper and publishes artifacts
atomically; a missing or old artifact is shown as `unavailable` or `stale`.

| Market | Coverage | Source and scope | Timezone |
| --- | --- | --- | --- |
| United Kingdom | supported | TfL Journey API, route-aware first/last journeys; the planner also answers future dates from the published schedule, so London route snapshots are sampled across the operating day rather than captured once | Europe/London |
| United States | supported | MBTA public API, scheduled route journeys; realtime is current-day only | America/New_York |
| France | supported | SNCF Open Data GTFS, published route/date journeys | Europe/Paris |
| Thailand | partial | BEM MRT HTML, Blue Line Sukhumvit → Hua Lamphong station-direction values | Asia/Bangkok |
| Singapore | partial | SMRT station information API, direction-specific first/last trains | Asia/Singapore |
| Hong Kong | partial | MTR official service hours, per-direction first/last trains | Asia/Hong_Kong |
| Japan, Korea, Malaysia, Germany, Belgium, Norway, Switzerland, China | unavailable | No qualifying full-day public source in this phase | Per-country config |

Hong Kong is the clearest case of why this artifact exists. MTR publishes no
departure-by-departure timetable for its urban lines — the Next Train API
answers "the next four trains" and nothing about any other date — so the route
snapshots carry live rows for today and **no rows at all** for future dates.
The official first/last train per direction is real and does cover future dates,
so it is what a future service day can honestly say. Two limits are recorded on
every Hong Kong advisory: MTR publishes one first/last pair per direction rather
than one per service-day type, and train frequency lives on a separate page that
is not collected.

All sources are public and do not require API keys, login, cookies, or
purchasing endpoints. The normalized `ServiceDayAdvisory` contract includes
coverage, service date, timezone, operating-day type, first/last journey,
risk, source attribution, checked time, upstream update time, and freshness
note. Operational failures go to the server-only `error_log` and reduced
telemetry envelope; public responses never contain provider diagnostics.
