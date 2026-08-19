# Source coverage and audit

Generated 2026-08-19T05:57:22.445Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 11 of 14 configured markets serve departure times.
- 20,867 stored departures across 59 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 2/2 declared regions; 5/16 declared lines; 105/168 declared stations: tokyo-urban, japan-intercity | full-timetable (2026-08-19); observed 00:00–23:58; 2026-08-18T22:38:18.557Z | jp-jr-central<br>jp-odpt-toei | A, C | full-timetable | 13 | 11,414 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇰🇷 korea | Departure times | 1/1 declared regions; 9/12 declared lines; 268/332 declared stations: seoul-capital | stale (2026-08-19); 2026-08-02T13:52:27.505Z | kr-incheon-transit-csv<br>kr-seoul-metro-csv | A | full-timetable | 0 | 0 | 13,728 | — |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-08-19) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Service hours / frequency only | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-08-19); 2026-08-07T22:41:57.574Z | sg-smrt-service-hours | A | frequency-only | 4 | 0 | — | — |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 3/3 declared lines; 5/5 declared stations: malaysia-intercity | full-timetable (2026-08-19); observed 05:54–22:04; 2026-08-18T22:38:20.420Z | my-ktmb-gtfs | A | full-timetable | 3 | 297 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇹🇭 thailand | Service hours / frequency only | No searchable network (0/1 declared regions; 0/5 declared lines; 0/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-08-19); 2026-08-18T22:04:34.015Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 3/6 declared lines; 22/23 declared stations: hong-kong | bounded-upcoming (2026-08-19); observed 06:04–06:45; 2026-08-18T22:04:40.351Z | hk-mtr-next-train | A | full-timetable | 4 | 15 | — | 2026-08-19 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_timetable_for_date | stale (2026-08-19); 2026-08-09T13:00:57.665Z | uk-tfl-journey-planner-web | B | full-timetable | 4 | 1,109 | — | 2026-08-09 … 2026-08-15 (7) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 4/6 declared lines; 6/263 declared stations: boston | stale (2026-08-19); observed 00:01–23:59; 2026-08-18T22:42:11.420Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 4 | 4,749 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 12/17 declared stations: germany-intercity | full-timetable (2026-08-19); observed 00:01–23:28; 2026-08-18T22:42:11.773Z | de-gtfs | A | full-timetable | 4 | 802 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 14/18 declared stations: france-intercity | full-timetable (2026-08-19); observed 06:03–21:00; 2026-08-18T22:42:16.809Z | fr-sncf-gtfs | A | full-timetable | 4 | 437 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 5/5 declared lines; 25/714 declared stations: belgium-intercity | sampled-service-day (2026-08-19); observed 00:20–07:05; 2026-08-18T22:42:24.149Z | be-irail | A | full-timetable | 5 | 217 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 5/5 declared lines; 7/12 declared stations: norway-intercity | sampled-service-day (2026-08-19); observed 08:00–10:30; 2026-08-18T22:42:30.278Z | no-entur | A | full-timetable | 5 | 180 | — | 2026-08-19 … 2026-08-25 (7) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 4/5 declared lines; 18/23 declared stations: switzerland-intercity | full-timetable (2026-08-19); observed 00:02–23:36; 2026-08-18T22:42:30.289Z | ch-opentransportdata-gtfs | A | full-timetable | 5 | 1,647 | — | 2026-08-19 … 2026-08-25 (7) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇰🇷 korea | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇨🇳 china | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇸🇬 singapore | 2026-08-18T22:42:30.291Z | 28 | 28 attempt(s): LTA DataMall GTFS Schedule (Train) returned HTTP 401. (Changi Airport → Jurong East, HarbourFront → Punggol, Jurong East → Raffles Place, Woodlands → Orchard) |
| 🇲🇾 malaysia | 2026-08-18T22:42:30.291Z | 4 | 1 attempt(s): data.gov.my published no KTMB Batu Caves → Kuala Lumpur service for 2026-08-22. (Batu Caves → Kuala Lumpur)<br>1 attempt(s): data.gov.my published no KTMB Klang → Subang Jaya service for 2026-08-22. (Klang → Subang Jaya)<br>1 attempt(s): data.gov.my published no KTMB Batu Caves → Kuala Lumpur service for 2026-08-23. (Batu Caves → Kuala Lumpur)<br>1 attempt(s): data.gov.my published no KTMB Klang → Subang Jaya service for 2026-08-23. (Klang → Subang Jaya) |
| 🇹🇭 thailand | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇭🇰 hong_kong | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-08-18T22:42:30.291Z | 28 | 28 attempt(s): page.waitForFunction: Timeout 45000ms exceeded. (Heathrow Terminals 2&3 → Oxford Circus Underground Station, King's Cross St. Pancras Underground Station → Oxford Circus Underground Station, Leicester Square → Camden Town, Paddington Station → Liverpool Street Station) |
| 🇺🇸 united_states | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇩🇪 germany | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇫🇷 france | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇧🇪 belgium | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇳🇴 norway | 2026-08-18T22:42:30.291Z | 0 | — |
| 🇨🇭 switzerland | 2026-08-18T22:42:30.291Z | 0 | — |

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
| `kr-seoul-metro-csv` | korea | Seoul Metro | official-csv | A | full-timetable | <https://www.data.go.kr/data/15098251/fileData.do> |
| `kr-incheon-transit-csv` | korea | Incheon Transit Corporation | official-csv | A | full-timetable | <https://www.data.go.kr/data/15044363/fileData.do> |
| `sg-lta-gtfs` | singapore | Singapore Land Transport Authority | official-gtfs | A | full-timetable | <https://datamall.lta.gov.sg/content/dam/datamall/datasets/PublicTransportRelated/GTFSScheduleTrain.zip> |
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
| japan | 2026-08-18T22:37:32.695Z | 2026-08-18T22:38:18.557Z |
| korea | 2026-08-01T05:58:24.121Z | 2026-08-02T13:52:27.505Z |
| singapore | 2026-08-07T22:41:57.573Z | 2026-08-07T22:41:57.574Z |
| malaysia | 2026-08-18T22:38:20.386Z | 2026-08-18T22:38:20.420Z |
| thailand | 2026-08-18T22:04:34.015Z | 2026-08-18T22:04:34.015Z |
| hong_kong | 2026-08-18T22:04:38.263Z | 2026-08-18T22:04:40.351Z |
| united_kingdom | 2026-08-09T12:59:40.208Z | 2026-08-09T13:00:57.665Z |
| united_states | 2026-08-18T22:41:22.582Z | 2026-08-18T22:42:11.420Z |
| germany | 2026-08-18T22:42:11.572Z | 2026-08-18T22:42:11.773Z |
| france | 2026-08-18T22:42:13.027Z | 2026-08-18T22:42:16.809Z |
| belgium | 2026-08-18T22:42:22.293Z | 2026-08-18T22:42:24.149Z |
| norway | 2026-08-18T22:42:25.362Z | 2026-08-18T22:42:30.278Z |
| switzerland | 2026-08-18T22:42:30.280Z | 2026-08-18T22:42:30.289Z |

