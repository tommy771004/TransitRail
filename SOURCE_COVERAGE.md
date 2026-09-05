# Source coverage and audit

Generated 2026-09-05T23:27:34.133Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 43,745 stored departures across 93 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 9/19 declared lines; 159/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | stale (2026-09-06); observed 00:02–23:59; 2026-09-05T13:30:19.032Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei | A, C | full-timetable | 46 | 20,344 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇰🇷 korea | Departure times | 1/1 declared regions; 9/12 declared lines; 268/332 declared stations: seoul-capital | stale (2026-09-06); 2026-08-30T12:46:47.256Z | kr-incheon-transit-csv<br>kr-seoul-metro-csv | A | full-timetable | 0 | 0 | 13,728 | — |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-09-06) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | stale (2026-09-06); observed 05:35–23:53; 2026-09-05T13:30:21.104Z | sg-lta-gtfs | A | full-timetable | 5 | 12,305 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 3/3 declared lines; 5/5 declared stations: malaysia-intercity | stale (2026-09-06); observed 06:19–22:04; 2026-09-05T13:30:21.140Z | my-ktmb-gtfs | A | full-timetable | 3 | 453 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-09-06); 2026-09-05T23:26:15.270Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-09-06); observed 07:26–08:00; 2026-09-05T23:26:20.721Z | hk-mtr-next-train | A | full-timetable | 4 | 16 | — | 2026-09-06 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | stale (2026-09-06); observed 05:21–23:13; 2026-09-05T13:31:25.464Z | uk-tfl-journey-planner | A | full-timetable | 4 | 1,048 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 4/6 declared lines; 6/263 declared stations: boston | sampled-service-day (2026-09-05); observed 00:00–23:59; 2026-09-05T13:32:38.923Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 4 | 5,854 | — | 2026-09-05 … 2026-09-13 (9) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 12/17 declared stations: germany-intercity | stale (2026-09-06); observed 00:01–23:28; 2026-09-05T13:32:39.302Z | de-gtfs | A | full-timetable | 4 | 814 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 14/18 declared stations: france-intercity | stale (2026-09-06); observed 06:03–22:05; 2026-09-05T13:32:43.813Z | fr-sncf-gtfs | A | full-timetable | 4 | 575 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 5/5 declared lines; 23/714 declared stations: belgium-intercity | stale (2026-09-06); observed 15:06–18:03; 2026-09-05T13:32:50.160Z | be-irail | A | full-timetable | 5 | 240 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 5/5 declared lines; 7/12 declared stations: norway-intercity | stale (2026-09-06); observed 08:20–12:10; 2026-09-05T13:32:55.942Z | no-entur | A | full-timetable | 5 | 214 | — | 2026-09-06 … 2026-09-13 (8) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | stale (2026-09-06); observed 00:08–23:36; 2026-09-05T13:32:55.953Z | ch-opentransportdata-gtfs | A | full-timetable | 5 | 1,882 | — | 2026-09-06 … 2026-09-13 (8) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇰🇷 korea | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇨🇳 china | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇸🇬 singapore | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇲🇾 malaysia | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇹🇭 thailand | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇭🇰 hong_kong | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇺🇸 united_states | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇩🇪 germany | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇫🇷 france | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇧🇪 belgium | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇳🇴 norway | 2026-09-05T23:26:22.334Z | 0 | — |
| 🇨🇭 switzerland | 2026-09-05T23:26:22.334Z | 0 | — |

## Cached station and line directories

These catalogs are fetched during a deliberate update step and committed as JSON. The runtime station picker reads the snapshot; it does not call the official map or Wikipedia per request.

| Market | Snapshot | Official directory | Lines | Stations | Wikipedia i18n |
| --- | --- | --- | ---: | ---: | ---: |
| 🇸🇬 singapore | [src/data/catalog/singapore.json](src/data/catalog/singapore.json) | <https://www.mytransport.sg/trainstatus> | 9 | 184 | 184/184 |
| 🇲🇾 malaysia | [src/data/catalog/malaysia.json](src/data/catalog/malaysia.json) | <https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily> | 0 | 216 | — |

## Registered sources

| Source | Market | Provider | Type | Tier | Max completeness | URL |
| --- | --- | --- | --- | --- | --- | --- |
| `jp-odpt-toei` | japan | Tokyo Metropolitan Bureau of Transportation (Toei) | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-odpt-tokyo-metro` | japan | Tokyo Metro | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-jr-central` | japan | Central Japan Railway Company (JR Central) | official-html | C | full-timetable | <https://railway.jr-central.co.jp/timetable/> |
| `jp-kotoden-gtfs` | japan | Takamatsu-Kotohira Electric Railroad (Kotoden) | official-gtfs | A | full-timetable | <https://www.kotoden.co.jp/publichtm/gtfs/index.html> |
| `kr-seoul-metro-csv` | korea | Seoul Metro | official-csv | A | full-timetable | <https://www.data.go.kr/data/15098251/fileData.do> |
| `kr-incheon-transit-csv` | korea | Incheon Transit Corporation | official-csv | A | full-timetable | <https://www.data.go.kr/data/15044363/fileData.do> |
| `sg-lta-gtfs` | singapore | Singapore Land Transport Authority | official-gtfs | A | full-timetable | <https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain> |
| `sg-smrt-service-hours` | singapore | SMRT Corporation | official-json | A | frequency-only | <https://journey.smrt.com.sg/journey/station_info/> |
| `my-data-gov-catalog` | malaysia | Ministry of Transport Malaysia (data.gov.my) | official-csv | A | service-hours | <https://data.gov.my/data-catalogue/ridership_headline> |
| `my-ktmb-gtfs` | malaysia | Ministry of Transport Malaysia / Keretapi Tanah Melayu Berhad | official-gtfs | A | full-timetable | <https://api.data.gov.my/gtfs-static/ktmb> |
| `th-bem-service-hours` | thailand | Bangkok Expressway and Metro (BEM) | official-html | C | frequency-only | <https://metro.bemplc.co.th/Train-Schedule> |
| `hk-mtr-next-train` | hong_kong | MTR Corporation | official-json | A | full-timetable | <https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data> |
| `hk-mtr-service-hours` | hong_kong | MTR Corporation | official-html | C | service-hours | <https://www.mtr.com.hk/en/customer/services/first_last_train_index.html> |
| `uk-tfl-journey-planner` | united_kingdom | Transport for London | official-json | A | full-timetable | <https://api.tfl.gov.uk> |
| `uk-tfl-journey-planner-web` | united_kingdom | Transport for London | official-browser | B | full-timetable | <https://tfl.gov.uk/plan-a-journey/> |
| `us-mbta-v3` | united_states | Massachusetts Bay Transportation Authority | official-json | A | full-timetable | <https://api-v3.mbta.com> |
| `us-mbta-journey-planner-web` | united_states | Massachusetts Bay Transportation Authority | official-browser | B | full-timetable | <https://www.mbta.com/trip-planner> |
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
| japan | 2026-09-05T13:23:28.252Z | 2026-09-05T13:30:19.032Z |
| korea | 2026-08-01T05:58:24.121Z | 2026-08-30T12:46:47.256Z |
| singapore | 2026-09-05T13:30:19.480Z | 2026-09-05T13:30:21.104Z |
| malaysia | 2026-09-05T13:30:21.131Z | 2026-09-05T13:30:21.140Z |
| thailand | 2026-09-05T23:26:15.268Z | 2026-09-05T23:26:15.270Z |
| hong_kong | 2026-09-05T23:26:18.157Z | 2026-09-05T23:26:20.721Z |
| united_kingdom | 2026-09-05T13:30:36.256Z | 2026-09-05T13:31:25.464Z |
| united_states | 2026-09-05T13:31:26.760Z | 2026-09-05T13:32:38.923Z |
| germany | 2026-09-05T13:32:39.089Z | 2026-09-05T13:32:39.302Z |
| france | 2026-09-05T13:32:40.505Z | 2026-09-05T13:32:43.813Z |
| belgium | 2026-09-05T13:32:48.245Z | 2026-09-05T13:32:50.160Z |
| norway | 2026-09-05T13:32:51.311Z | 2026-09-05T13:32:55.942Z |
| switzerland | 2026-09-05T13:32:55.943Z | 2026-09-05T13:32:55.953Z |

