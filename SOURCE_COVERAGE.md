# Source coverage and audit

Generated 2026-11-11T01:34:11.431Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 119,269 stored departures across 471 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 11/19 declared lines; 191/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | stale (2026-11-11); observed 00:02–23:58; 2026-11-09T01:23:10.365Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei<br>jp-odpt-tokyo-metro | A, C | full-timetable | 53 | 24,467 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇰🇷 korea | Departure times | 2/2 declared regions; 28/31 declared lines; 516/587 declared stations: seoul-capital, korail-intercity | stale (2026-11-11); observed 00:00–23:28; 2026-11-09T01:18:00.273Z | kr-incheon-transit-csv<br>kr-korail-timetable-xlsx<br>kr-seoul-metro-csv | A | full-timetable | 194 | 6,909 | 13,675 | 2026-11-11 … 2026-11-17 (7) |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-11-11) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | stale (2026-11-11); observed 00:01–23:58; 2026-11-09T01:17:48.151Z | sg-lta-gtfs | A | full-timetable | 10 | 24,966 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 6/3 declared lines; 5/5 declared stations: malaysia-intercity | stale (2026-11-11); observed 05:54–23:21; 2026-11-09T01:17:56.920Z | my-ktmb-gtfs | A | full-timetable | 6 | 778 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-11-11); 2026-11-11T01:32:54.335Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-11-11); observed 09:32–10:04; 2026-11-11T01:32:58.619Z | hk-mtr-next-train | A | full-timetable | 8 | 28 | — | 2026-11-11 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | stale (2026-11-11); observed 05:31–23:36; 2026-11-09T01:45:21.516Z | uk-tfl-journey-planner | A | full-timetable | 8 | 1,847 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 8/6 declared lines; 6/263 declared stations: boston | stale (2026-11-10); observed 00:01–23:59; 2026-11-09T01:51:46.415Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 8 | 10,858 | — | 2026-11-10 … 2026-11-17 (8) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 5/17 declared stations: germany-intercity | stale (2026-11-11); observed 00:01–23:29; 2026-11-09T01:23:13.714Z | de-gtfs | A | full-timetable | 8 | 1,311 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 7/18 declared stations: france-intercity | stale (2026-11-11); observed 06:03–21:11; 2026-11-09T01:26:39.703Z | fr-sncf-gtfs | A | full-timetable | 8 | 960 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 10/5 declared lines; 18/714 declared stations: belgium-intercity | stale (2026-11-11); observed 04:35–08:32; 2026-11-09T01:27:50.296Z | be-irail | A | full-timetable | 10 | 420 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 10/5 declared lines; 7/12 declared stations: norway-intercity | stale (2026-11-11); observed 08:00–12:20; 2026-11-09T01:29:17.155Z | no-entur | A | full-timetable | 10 | 345 | — | 2026-11-11 … 2026-11-17 (7) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | stale (2026-11-11); observed 00:00–23:59; 2026-11-09T01:35:27.252Z | ch-opentransportdata-gtfs | A | full-timetable | 144 | 46,380 | — | 2026-11-11 … 2026-11-17 (7) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇰🇷 korea | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇨🇳 china | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇸🇬 singapore | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇲🇾 malaysia | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇹🇭 thailand | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇭🇰 hong_kong | 2026-11-11T01:33:00.658Z | 1 | 1 attempt(s): Could not reach the MTR live data service. (Hong Kong → Airport) |
| 🇬🇧 united_kingdom | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇺🇸 united_states | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇩🇪 germany | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇫🇷 france | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇧🇪 belgium | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇳🇴 norway | 2026-11-11T01:33:00.658Z | 0 | — |
| 🇨🇭 switzerland | 2026-11-11T01:33:00.658Z | 54 | 1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-09. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-09. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-09. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-09. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-09. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-09. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-10. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-10. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-10. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-10. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-10. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-10. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-11. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-11. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-11. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-11. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-11. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-11. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-12. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-12. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-12. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-12. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-12. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-12. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-13. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-13. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-13. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-13. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-13. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-13. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-14. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-14. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-14. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-14. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-14. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-14. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-15. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-15. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-15. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-15. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-15. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-15. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-16. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-16. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-16. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-16. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-16. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-16. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-17. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-17. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-17. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-17. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-17. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-17. (Genève-Aéroport → Biel/Bienne) |

## Cached station and line directories

These catalogs are fetched during a deliberate update step and committed as JSON. The runtime station picker reads the snapshot; it does not call the official map or Wikipedia per request.

| Market | Snapshot | Official directory | Lines | Stations | Wikipedia i18n |
| --- | --- | --- | ---: | ---: | ---: |
| 🇸🇬 singapore | [src/data/catalog/singapore.json](src/data/catalog/singapore.json) | <https://www.mytransport.sg/trainstatus> | 9 | 184 | 184/184 |
| 🇲🇾 malaysia | [src/data/catalog/malaysia.json](src/data/catalog/malaysia.json) | <https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily> | 0 | 237 | — |

## Registered sources

| Source | Market | Provider | Type | Tier | Max completeness | URL |
| --- | --- | --- | --- | --- | --- | --- |
| `jp-odpt-toei` | japan | Tokyo Metropolitan Bureau of Transportation (Toei) | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-odpt-tokyo-metro` | japan | Tokyo Metro | official-json | A | full-timetable | <https://developer.odpt.org/en/datasets> |
| `jp-jr-central` | japan | Central Japan Railway Company (JR Central) | official-html | C | full-timetable | <https://railway.jr-central.co.jp/timetable/> |
| `jp-kotoden-gtfs` | japan | Takamatsu-Kotohira Electric Railroad (Kotoden) | official-gtfs | A | full-timetable | <https://www.kotoden.co.jp/publichtm/gtfs/index.html> |
| `kr-korail-timetable-xlsx` | korea | Korail | official-download | A | full-timetable | <https://www.korail.com/ticket/reserve/train-timeTable> |
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
| japan | 2026-11-09T01:17:54.338Z | 2026-11-09T01:23:10.365Z |
| korea | 2026-09-09T17:27:18.865Z | 2026-11-09T01:18:00.273Z |
| singapore | 2026-11-09T01:17:46.015Z | 2026-11-09T01:17:48.151Z |
| malaysia | 2026-11-09T01:17:56.902Z | 2026-11-09T01:17:56.920Z |
| thailand | 2026-11-11T01:32:53.974Z | 2026-11-11T01:32:54.335Z |
| hong_kong | 2026-11-10T03:52:56.906Z | 2026-11-11T01:32:58.619Z |
| united_kingdom | 2026-11-09T01:43:40.028Z | 2026-11-09T01:45:21.516Z |
| united_states | 2026-11-09T01:21:04.235Z | 2026-11-09T01:51:46.415Z |
| germany | 2026-11-09T01:23:13.504Z | 2026-11-09T01:23:13.714Z |
| france | 2026-11-09T01:26:29.055Z | 2026-11-09T01:26:39.703Z |
| belgium | 2026-11-09T01:27:45.041Z | 2026-11-09T01:27:50.296Z |
| norway | 2026-11-09T01:29:08.789Z | 2026-11-09T01:29:17.155Z |
| switzerland | 2026-10-17T23:55:46.215Z | 2026-11-09T01:35:27.252Z |

