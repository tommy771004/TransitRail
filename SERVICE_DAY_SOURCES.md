# Service-day source coverage

Service-day advisories are read from scheduled artifacts during journey search.
Upstream retrieval runs only in the scheduled scraper and publishes artifacts
atomically; a missing or old artifact is shown as `unavailable` or `stale`.

| Market | Coverage | Source and scope | Timezone |
| --- | --- | --- | --- |
| United Kingdom | supported | TfL Journey API, route-aware first/last journeys | Europe/London |
| United States | supported | MBTA public API, scheduled route journeys; realtime is current-day only | America/New_York |
| France | supported | SNCF Open Data GTFS, published route/date journeys | Europe/Paris |
| Thailand | partial | BEM MRT HTML, Blue Line Sukhumvit → Hua Lamphong station-direction values | Asia/Bangkok |
| Japan, Korea, Singapore, Malaysia, Hong Kong, Germany, Belgium, Norway, Switzerland, China | unavailable | No qualifying full-day public source in this phase | Per-country config |

All sources are public and do not require API keys, login, cookies, or
purchasing endpoints. The normalized `ServiceDayAdvisory` contract includes
coverage, service date, timezone, operating-day type, first/last journey,
risk, source attribution, checked time, upstream update time, and freshness
note. Operational failures go to the server-only `error_log` and reduced
telemetry envelope; public responses never contain provider diagnostics.
