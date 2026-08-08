# Source coverage and audit

Generated 2026-08-08T06:49:45.435Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 10 of 14 configured markets serve departure times.
- 21,935 stored departures across 56 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 2/2 declared regions; 5/16 declared lines; 105/168 declared stations: tokyo-urban, japan-intercity | full-timetable (2026-08-08); observed 00:00–23:57; 2026-08-07T22:41:57.572Z | jp-jr-central<br>jp-odpt-toei | A, C | full-timetable | 13 | 11,414 | — | 2026-08-08 … 2026-08-14 (7) |
| 🇰🇷 korea | Departure times | 1/1 declared regions; 9/12 declared lines; 268/332 declared stations: seoul-capital | stale (2026-08-08); 2026-08-02T13:52:27.505Z | kr-incheon-transit-csv<br>kr-seoul-metro-csv | A | full-timetable | 0 | 0 | 13,728 | — |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — No verified timetable source is registered for this market. | unavailable (2026-08-08) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Service hours / frequency only | No searchable network (0/1 declared regions; 0/6 declared lines; 0/145 declared stations) — No verified timetable data is available for this country on the selected date. | frequency-or-service-hours (2026-08-08); 2026-08-07T22:41:57.574Z | sg-smrt-service-hours | A | frequency-only | 4 | 0 | — | — |
| 🇲🇾 malaysia | Station names only | No searchable network (0/1 declared regions; 0/0 declared lines; 0/216 declared stations) — Station names are available, but no verified timetable is available for this market. | catalog-only (2026-08-08) | — | — | — | 0 | 0 | — | — |
| 🇹🇭 thailand | Service hours / frequency only | No searchable network (0/1 declared regions; 0/5 declared lines; 0/119 declared stations) — No verified timetable data is available for this country on the selected date. | frequency-or-service-hours (2026-08-08); 2026-08-07T22:41:57.576Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 3/6 declared lines; 22/23 declared stations: hong-kong | bounded-upcoming (2026-08-08); observed 06:24–07:02; 2026-08-07T22:24:40.720Z | hk-mtr-next-train | A | full-timetable | 4 | 16 | — | 2026-08-08 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — No verified searchable lines are available for this country on the selected date. | stale (2026-08-08); observed 05:21–23:36; 2026-08-05T23:06:12.967Z | uk-tfl-journey-planner | A | full-timetable | 4 | 1,974 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 4/6 declared lines; 6/263 declared stations: boston | stale (2026-08-08); observed 00:00–23:59; 2026-08-07T22:42:59.605Z | us-mbta-v3 | A | full-timetable | 4 | 5,327 | — | 2026-08-07 … 2026-08-14 (8) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 12/17 declared stations: germany-intercity | full-timetable (2026-08-08); observed 00:01–23:16; 2026-08-07T22:42:59.773Z | de-gtfs | A | full-timetable | 4 | 741 | — | 2026-08-08 … 2026-08-14 (7) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 14/18 declared stations: france-intercity | full-timetable (2026-08-08); observed 06:03–20:25; 2026-08-07T22:43:14.672Z | fr-sncf-gtfs | A | full-timetable | 4 | 443 | — | 2026-08-08 … 2026-08-14 (7) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 5/5 declared lines; 46/714 declared stations: belgium-intercity | sampled-service-day (2026-08-08); observed 00:40–08:03; 2026-08-07T22:43:32.161Z | be-irail | A | full-timetable | 5 | 215 | — | 2026-08-08 … 2026-08-14 (7) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 5/5 declared lines; 7/12 declared stations: norway-intercity | sampled-service-day (2026-08-08); observed 08:23–11:21; 2026-08-07T22:43:38.639Z | no-entur | A | full-timetable | 5 | 175 | — | 2026-08-08 … 2026-08-14 (7) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 4/5 declared lines; 18/23 declared stations: switzerland-intercity | full-timetable (2026-08-08); observed 00:02–23:58; 2026-08-07T22:43:38.646Z | ch-opentransportdata-gtfs | A | full-timetable | 5 | 1,630 | — | 2026-08-08 … 2026-08-14 (7) |

## Registered sources

| Source | Market | Provider | Type | Tier | Max completeness | URL |
| --- | --- | --- | --- | --- | --- | --- |
| `jp-odpt-toei` | japan | Tokyo Metropolitan Bureau of Transportation (Toei) | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-odpt-tokyo-metro` | japan | Tokyo Metro | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-jr-central` | japan | Central Japan Railway Company (JR Central) | official-html | C | full-timetable | <https://railway.jr-central.co.jp/timetable/> |
| `kr-seoul-metro-csv` | korea | Seoul Metro | official-csv | A | full-timetable | <https://www.data.go.kr/data/15098251/fileData.do> |
| `kr-incheon-transit-csv` | korea | Incheon Transit Corporation | official-csv | A | full-timetable | <https://www.data.go.kr/data/15044363/fileData.do> |
| `sg-smrt-service-hours` | singapore | SMRT Corporation | official-json | A | frequency-only | <https://journey.smrt.com.sg/journey/station_info/> |
| `my-data-gov-catalog` | malaysia | Ministry of Transport Malaysia (data.gov.my) | official-csv | A | service-hours | <https://data.gov.my/data-catalogue/ridership_headline> |
| `th-bem-service-hours` | thailand | Bangkok Expressway and Metro (BEM) | official-html | C | frequency-only | <https://metro.bemplc.co.th/Train-Schedule> |
| `hk-mtr-next-train` | hong_kong | MTR Corporation | official-json | A | full-timetable | <https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data> |
| `hk-mtr-service-hours` | hong_kong | MTR Corporation | official-html | C | service-hours | <https://www.mtr.com.hk/en/customer/services/first_last_train_index.html> |
| `uk-tfl-journey-planner` | united_kingdom | Transport for London | official-json | A | full-timetable | <https://api.tfl.gov.uk> |
| `us-mbta-v3` | united_states | Massachusetts Bay Transportation Authority | official-json | A | full-timetable | <https://api-v3.mbta.com> |
| `de-gtfs` | germany | gtfs.de | official-gtfs | A | full-timetable | <https://gtfs.de/en/feeds/de_fv/> |
| `fr-sncf-gtfs` | france | SNCF Voyageurs | official-gtfs | A | full-timetable | <https://ressources.data.sncf.com/explore/dataset/horaires-des-train-voyages-tgvinouiouigo/> |
| `be-irail` | belgium | NMBS/SNCB (via iRail) | official-json | A | full-timetable | <https://api.irail.be> |
| `no-entur` | norway | Entur AS | official-json | A | full-timetable | <https://api.entur.io/journey-planner/v3/graphql> |
| `ch-opentransportdata-gtfs` | switzerland | Swiss Federal Railways / opentransportdata.swiss | official-gtfs | A | full-timetable | <https://opentransportdata.swiss/en/dataset/timetable-2025-gtfs2020> |
| `ch-ojp` | switzerland | opentransportdata.swiss | official-xml | A | full-timetable | <https://opentransportdata.swiss/en/cookbook/open-journey-planner-ojp/> |

## Expansion gaps outside the declared product market

These gaps come from the same `countryConfig` market boundary that the catalog and coverage ratio use.

| Operator | Market | Why there is no data |
| --- | --- | --- |
| National Rail | united_kingdom | National and intercity services are outside the TfL product market. |
| US national and non-Boston transit | united_states | Only the MBTA Boston product market is currently integrated. |

## Freshness

| Market | Oldest fetch | Newest fetch |
| --- | --- | --- |
| japan | 2026-08-07T22:41:14.947Z | 2026-08-07T22:41:57.572Z |
| korea | 2026-08-01T05:58:24.121Z | 2026-08-02T13:52:27.505Z |
| singapore | 2026-08-07T22:41:57.573Z | 2026-08-07T22:41:57.574Z |
| thailand | 2026-08-07T22:41:57.575Z | 2026-08-07T22:41:57.576Z |
| hong_kong | 2026-08-07T22:24:38.805Z | 2026-08-07T22:24:40.720Z |
| united_kingdom | 2026-08-05T23:05:28.154Z | 2026-08-05T23:06:12.967Z |
| united_states | 2026-08-07T01:29:49.209Z | 2026-08-07T22:42:59.605Z |
| germany | 2026-08-07T22:42:59.657Z | 2026-08-07T22:42:59.773Z |
| france | 2026-08-07T22:43:03.515Z | 2026-08-07T22:43:14.672Z |
| belgium | 2026-08-07T22:43:29.905Z | 2026-08-07T22:43:32.161Z |
| norway | 2026-08-07T22:43:33.651Z | 2026-08-07T22:43:38.639Z |
| switzerland | 2026-08-07T22:43:38.640Z | 2026-08-07T22:43:38.646Z |

