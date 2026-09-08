# Source coverage and audit

Generated 2026-09-08T23:46:12.981Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 39,139 stored departures across 93 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 9/19 declared lines; 159/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | stale (2026-09-09); observed 00:02–23:58; 2026-09-06T23:54:09.155Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei | A, C | full-timetable | 46 | 17,981 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇰🇷 korea | Departure times | 1/1 declared regions; 9/12 declared lines; 268/332 declared stations: seoul-capital | stale (2026-09-09); 2026-08-30T12:46:47.256Z | kr-incheon-transit-csv<br>kr-seoul-metro-csv | A | full-timetable | 0 | 0 | 13,728 | — |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-09-09) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | stale (2026-09-09); observed 05:16–23:56; 2026-09-06T23:54:10.937Z | sg-lta-gtfs | A | full-timetable | 5 | 10,921 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 3/3 declared lines; 5/5 declared stations: malaysia-intercity | stale (2026-09-09); observed 05:54–22:04; 2026-09-06T23:54:10.967Z | my-ktmb-gtfs | A | full-timetable | 3 | 381 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-09-09); 2026-09-08T23:44:02.480Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-09-09); observed 07:43–08:20; 2026-09-08T23:44:07.879Z | hk-mtr-next-train | A | full-timetable | 4 | 16 | — | 2026-09-09 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | stale (2026-09-09); observed 05:32–23:36; 2026-09-06T23:55:35.182Z | uk-tfl-journey-planner | A | full-timetable | 4 | 896 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 4/6 declared lines; 6/263 declared stations: boston | stale (2026-09-08); observed 00:01–23:59; 2026-09-06T23:56:27.181Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 4 | 5,652 | — | 2026-09-08 … 2026-09-15 (8) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 12/17 declared stations: germany-intercity | stale (2026-09-09); observed 04:41–23:28; 2026-09-06T23:56:27.504Z | de-gtfs | A | full-timetable | 4 | 735 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 14/18 declared stations: france-intercity | stale (2026-09-09); observed 06:03–20:25; 2026-09-06T23:56:31.935Z | fr-sncf-gtfs | A | full-timetable | 4 | 511 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 5/5 declared lines; 21/714 declared stations: belgium-intercity | stale (2026-09-09); observed 04:11–08:03; 2026-09-06T23:56:38.561Z | be-irail | A | full-timetable | 5 | 210 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 5/5 declared lines; 7/12 declared stations: norway-intercity | stale (2026-09-09); observed 08:10–12:06; 2026-09-06T23:56:43.146Z | no-entur | A | full-timetable | 5 | 187 | — | 2026-09-09 … 2026-09-15 (7) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | stale (2026-09-09); observed 00:02–23:36; 2026-09-06T23:56:43.155Z | ch-opentransportdata-gtfs | A | full-timetable | 5 | 1,649 | — | 2026-09-09 … 2026-09-15 (7) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇰🇷 korea | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇨🇳 china | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇸🇬 singapore | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇲🇾 malaysia | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇹🇭 thailand | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇭🇰 hong_kong | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇺🇸 united_states | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇩🇪 germany | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇫🇷 france | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇧🇪 belgium | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇳🇴 norway | 2026-09-08T23:44:10.062Z | 0 | — |
| 🇨🇭 switzerland | 2026-09-08T23:44:10.062Z | 0 | — |

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
| japan | 2026-09-06T23:52:52.892Z | 2026-09-06T23:54:09.155Z |
| korea | 2026-08-01T05:58:24.121Z | 2026-08-30T12:46:47.256Z |
| singapore | 2026-09-06T23:54:09.513Z | 2026-09-06T23:54:10.937Z |
| malaysia | 2026-09-06T23:54:10.960Z | 2026-09-06T23:54:10.967Z |
| thailand | 2026-09-08T23:44:02.479Z | 2026-09-08T23:44:02.480Z |
| hong_kong | 2026-09-08T23:44:05.588Z | 2026-09-08T23:44:07.879Z |
| united_kingdom | 2026-09-06T23:54:35.377Z | 2026-09-06T23:55:35.182Z |
| united_states | 2026-09-06T23:55:36.411Z | 2026-09-06T23:56:27.181Z |
| germany | 2026-09-06T23:56:27.319Z | 2026-09-06T23:56:27.504Z |
| france | 2026-09-06T23:56:28.627Z | 2026-09-06T23:56:31.935Z |
| belgium | 2026-09-06T23:56:36.810Z | 2026-09-06T23:56:38.561Z |
| norway | 2026-09-06T23:56:39.530Z | 2026-09-06T23:56:43.146Z |
| switzerland | 2026-09-06T23:56:43.148Z | 2026-09-06T23:56:43.155Z |

