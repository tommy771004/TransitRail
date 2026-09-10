# Source coverage and audit

Generated 2026-09-10T12:24:33.777Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 100,120 stored departures across 367 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 11/19 declared lines; 191/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | full-timetable (2026-09-10); observed 00:02–23:58; 2026-09-10T12:06:24.907Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei<br>jp-odpt-tokyo-metro | A, C | full-timetable | 50 | 31,306 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇰🇷 korea | Departure times | 2/2 declared regions; 28/31 declared lines; 517/587 declared stations: seoul-capital, korail-intercity | full-timetable (2026-09-10); observed 00:00–23:28; 2026-09-10T12:03:06.648Z | kr-incheon-transit-csv<br>kr-korail-timetable-xlsx<br>kr-seoul-metro-csv | A | full-timetable | 193 | 8,885 | 13,675 | 2026-09-10 … 2026-09-18 (9) |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-09-10) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | full-timetable (2026-09-10); observed 05:16–23:56; 2026-09-10T12:01:58.997Z | sg-lta-gtfs | A | full-timetable | 5 | 14,171 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 3/3 declared lines; 5/5 declared stations: malaysia-intercity | full-timetable (2026-09-10); observed 05:54–22:04; 2026-09-10T12:02:09.271Z | my-ktmb-gtfs | A | full-timetable | 3 | 495 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-09-10); 2026-09-10T12:02:09.273Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-09-10); observed 20:02–20:40; 2026-09-10T12:02:22.221Z | hk-mtr-next-train | A | full-timetable | 4 | 16 | — | 2026-09-10 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | sampled-service-day (2026-09-10); observed 05:32–23:36; 2026-09-10T12:18:45.810Z | uk-tfl-journey-planner | A | full-timetable | 4 | 1,172 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 4/6 declared lines; 6/263 declared stations: boston | sampled-service-day (2026-09-10); observed 00:01–23:59; 2026-09-10T12:22:01.081Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 4 | 5,694 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 12/17 declared stations: germany-intercity | full-timetable (2026-09-10); observed 00:01–23:28; 2026-09-10T12:06:28.046Z | de-gtfs | A | full-timetable | 4 | 966 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 14/18 declared stations: france-intercity | full-timetable (2026-09-10); observed 06:03–21:05; 2026-09-10T12:07:19.852Z | fr-sncf-gtfs | A | full-timetable | 4 | 674 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 5/5 declared lines; 21/714 declared stations: belgium-intercity | sampled-service-day (2026-09-10); observed 13:49–16:28; 2026-09-10T12:07:51.950Z | be-irail | A | full-timetable | 5 | 270 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 5/5 declared lines; 7/12 declared stations: norway-intercity | sampled-service-day (2026-09-10); observed 08:10–11:56; 2026-09-10T12:09:00.223Z | no-entur | A | full-timetable | 5 | 241 | — | 2026-09-10 … 2026-09-18 (9) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | full-timetable (2026-09-10); observed 00:02–23:58; 2026-09-10T12:13:58.861Z | ch-opentransportdata-gtfs | A | full-timetable | 82 | 36,230 | — | 2026-09-10 … 2026-09-18 (9) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇰🇷 korea | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇨🇳 china | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇸🇬 singapore | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇲🇾 malaysia | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇹🇭 thailand | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇭🇰 hong_kong | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇺🇸 united_states | 2026-09-10T12:22:01.129Z | 9 | 7 attempt(s): MBTA returned no scheduled journeys for this station pair on the selected date. (Park Street → Andrew, Harvard → Logan International Airport, South Station → Harvard)<br>1 attempt(s): MBTA Trip Planner did not settle for 10:45 (10:45 am). Page state: Trip Planner From Swap origin and destination locations To When Now Leave at Arrive by 1 2 3 4 5 6 7 8 9 10 11 12 00 05 10 15 20 25 30 35 40 45 50 55 AM PM Modes All modes Prefer accessible routes Trips from Park Street to Boston College Leaving at 10:45 am on Thursday, September 10th MOST DIRECT 10:50 – 11:38 am 48 min GL B 0.1 mi $2.40 Similar trips depart at 10:58 am, 11:06 am, 11:14 am Details A B MapLibre | © OpenStreetMap (Park Street → Boston College)<br>1 attempt(s): MBTA Trip Planner did not settle for 21:10 (9:10 pm). Page state: Trip Planner From Swap origin and destination locations To When Now Leave at Arrive by 1 2 3 4 5 6 7 8 9 10 11 12 00 05 10 15 20 25 30 35 40 45 50 55 AM PM Modes All modes Prefer accessible routes Trips from Park Street to Boston College Leaving at 9:10 pm on Saturday, September 12th MOST DIRECT 9:18 – 10:06 pm 48 min GL B 0.1 mi $2.40 Similar trips depart at 9:29 pm, 9:39 pm, 9:50 pm Details A B MapLibre | © OpenStreetMap (Park Street → Boston College) |
| 🇩🇪 germany | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇫🇷 france | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇧🇪 belgium | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇳🇴 norway | 2026-09-10T12:22:01.129Z | 0 | — |
| 🇨🇭 switzerland | 2026-09-10T12:22:01.129Z | 42 | 1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-10. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-10. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-10. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-11. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-11. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-11. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-12. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-12. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-12. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → St. Gallen service for 2026-09-12. (Biel/Bienne → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Winterthur service for 2026-09-12. (Biel/Bienne → Winterthur)<br>1 attempt(s): Swiss GTFS published no Genève → Yverdon-les-Bains service for 2026-09-12. (Genève → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Yverdon-les-Bains service for 2026-09-12. (Genève-Aéroport → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Yverdon-les-Bains service for 2026-09-12. (St. Gallen → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Winterthur → Yverdon-les-Bains service for 2026-09-12. (Winterthur → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Zürich HB service for 2026-09-12. (Yverdon-les-Bains → Zürich HB)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-13. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-13. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-13. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → St. Gallen service for 2026-09-13. (Biel/Bienne → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Winterthur service for 2026-09-13. (Biel/Bienne → Winterthur)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Zürich HB service for 2026-09-13. (Biel/Bienne → Zürich HB)<br>1 attempt(s): Swiss GTFS published no Genève → Yverdon-les-Bains service for 2026-09-13. (Genève → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Yverdon-les-Bains service for 2026-09-13. (Genève-Aéroport → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Yverdon-les-Bains service for 2026-09-13. (St. Gallen → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Winterthur → Yverdon-les-Bains service for 2026-09-13. (Winterthur → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Zürich HB service for 2026-09-13. (Yverdon-les-Bains → Zürich HB)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-14. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-14. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-14. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-15. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-15. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-15. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-16. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-16. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-16. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-17. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-17. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-17. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-09-18. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-09-18. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-09-18. (Biel/Bienne → Genève-Aéroport) |

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
| japan | 2026-09-10T12:02:05.797Z | 2026-09-10T12:06:24.907Z |
| korea | 2026-09-09T17:27:18.865Z | 2026-09-10T12:03:06.648Z |
| singapore | 2026-09-10T12:01:57.842Z | 2026-09-10T12:01:58.997Z |
| malaysia | 2026-09-10T12:02:09.261Z | 2026-09-10T12:02:09.271Z |
| thailand | 2026-09-10T12:02:09.272Z | 2026-09-10T12:02:09.273Z |
| hong_kong | 2026-09-10T12:02:19.243Z | 2026-09-10T12:02:22.221Z |
| united_kingdom | 2026-09-10T12:17:48.627Z | 2026-09-10T12:18:45.810Z |
| united_states | 2026-09-10T12:06:02.099Z | 2026-09-10T12:22:01.081Z |
| germany | 2026-09-10T12:06:27.902Z | 2026-09-10T12:06:28.046Z |
| france | 2026-09-10T12:07:17.676Z | 2026-09-10T12:07:19.852Z |
| belgium | 2026-09-10T12:07:49.201Z | 2026-09-10T12:07:51.950Z |
| norway | 2026-09-10T12:08:54.752Z | 2026-09-10T12:09:00.223Z |
| switzerland | 2026-09-09T12:43:29.078Z | 2026-09-10T12:13:58.861Z |

