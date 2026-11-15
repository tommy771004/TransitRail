# Source coverage and audit

Generated 2026-11-15T01:55:32.141Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 146,445 stored departures across 471 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 11/19 declared lines; 191/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | full-timetable (2026-11-15); observed 00:02–23:59; 2026-11-15T01:31:10.015Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei<br>jp-odpt-tokyo-metro | A, C | full-timetable | 53 | 31,281 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇰🇷 korea | Departure times | 2/2 declared regions; 28/31 declared lines; 518/587 declared stations: seoul-capital, korail-intercity | stale (2026-11-15); observed 00:00–23:28; 2026-11-12T02:35:47.443Z | kr-incheon-transit-csv<br>kr-korail-timetable-xlsx<br>kr-seoul-metro-csv | A | full-timetable | 194 | 5,873 | 13,675 | 2026-11-15 … 2026-11-20 (6) |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-11-15) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | full-timetable (2026-11-15); observed 00:02–23:58; 2026-11-15T01:25:23.755Z | sg-lta-gtfs | A | full-timetable | 10 | 31,778 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 6/3 declared lines; 5/5 declared stations: malaysia-intercity | full-timetable (2026-11-15); observed 06:19–23:26; 2026-11-15T01:25:33.357Z | my-ktmb-gtfs | A | full-timetable | 6 | 1,002 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-11-15); 2026-11-15T01:25:32.094Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-11-15); observed 09:25–10:00; 2026-11-15T01:25:36.091Z | hk-mtr-next-train | A | full-timetable | 8 | 32 | — | 2026-11-15 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | sampled-service-day (2026-11-15); observed 05:21–23:13; 2026-11-15T01:54:13.597Z | uk-tfl-journey-planner | A | full-timetable | 8 | 2,373 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 8/6 declared lines; 6/263 declared stations: boston | stale (2026-11-14); 2026-11-15T01:53:19.985Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 8 | 10,380 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 5/17 declared stations: germany-intercity | full-timetable (2026-11-15); observed 00:01–23:59; 2026-11-15T01:31:13.103Z | de-gtfs | A | full-timetable | 8 | 1,602 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 7/18 declared stations: france-intercity | full-timetable (2026-11-15); observed 06:03–22:05; 2026-11-15T01:34:53.083Z | fr-sncf-gtfs | A | full-timetable | 8 | 1,259 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 10/5 declared lines; 21/714 declared stations: belgium-intercity | sampled-service-day (2026-11-15); observed 04:29–08:28; 2026-11-15T01:36:11.027Z | be-irail | A | full-timetable | 10 | 534 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 10/5 declared lines; 7/12 declared stations: norway-intercity | sampled-service-day (2026-11-15); observed 08:15–11:27; 2026-11-15T01:37:34.601Z | no-entur | A | full-timetable | 10 | 445 | — | 2026-11-15 … 2026-11-23 (9) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | full-timetable (2026-11-15); observed 00:02–23:59; 2026-11-15T01:44:11.797Z | ch-opentransportdata-gtfs | A | full-timetable | 144 | 59,886 | — | 2026-11-15 … 2026-11-23 (9) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇰🇷 korea | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇨🇳 china | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇸🇬 singapore | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇲🇾 malaysia | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇹🇭 thailand | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇭🇰 hong_kong | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-11-15T01:54:13.607Z | 1 | 1 attempt(s): Transit data is temporarily unavailable. Please try again later. (Oxford Circus Underground Station → King's Cross St. Pancras Underground Station) |
| 🇺🇸 united_states | 2026-11-15T01:54:13.607Z | 6 | 6 attempt(s): MBTA returned no scheduled journeys for this station pair on the selected date. (Park Street → Andrew, Andrew → Park Street) |
| 🇩🇪 germany | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇫🇷 france | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇧🇪 belgium | 2026-11-15T01:54:13.607Z | 1 | 1 attempt(s): iRail returned HTTP 504. (Brussels-Central → Antwerpen-Centraal) |
| 🇳🇴 norway | 2026-11-15T01:54:13.607Z | 0 | — |
| 🇨🇭 switzerland | 2026-11-15T01:54:13.607Z | 88 | 1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-15. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-15. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-15. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-15. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Genève → Yverdon-les-Bains service for 2026-11-15. (Genève → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Yverdon-les-Bains service for 2026-11-15. (Genève-Aéroport → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-15. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-15. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-15. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-15. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève service for 2026-11-15. (Yverdon-les-Bains → Genève)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève-Aéroport service for 2026-11-15. (Yverdon-les-Bains → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-16. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-16. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-16. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-16. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-16. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-16. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-16. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-16. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-17. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-17. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-17. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-17. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-17. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-17. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-17. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-17. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-18. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-18. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-18. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-18. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-18. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-18. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-18. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-18. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-19. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-19. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-19. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-19. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-19. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-19. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-19. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-19. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-20. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-20. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-20. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-20. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-20. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-20. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-20. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-20. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-21. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Basel SBB → Zürich Flughafen service for 2026-11-21. (Basel SBB → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-21. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-21. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-21. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Genève → Yverdon-les-Bains service for 2026-11-21. (Genève → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Yverdon-les-Bains service for 2026-11-21. (Genève-Aéroport → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-21. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Basel SBB service for 2026-11-21. (Zürich Flughafen → Basel SBB)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-21. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-21. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-21. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève service for 2026-11-21. (Yverdon-les-Bains → Genève)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève-Aéroport service for 2026-11-21. (Yverdon-les-Bains → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-22. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Basel SBB → Zürich Flughafen service for 2026-11-22. (Basel SBB → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-22. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-22. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-22. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Genève → Yverdon-les-Bains service for 2026-11-22. (Genève → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Yverdon-les-Bains service for 2026-11-22. (Genève-Aéroport → Yverdon-les-Bains)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-22. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Basel SBB service for 2026-11-22. (Zürich Flughafen → Basel SBB)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-22. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-22. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-22. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève service for 2026-11-22. (Yverdon-les-Bains → Genève)<br>1 attempt(s): Swiss GTFS published no Yverdon-les-Bains → Genève-Aéroport service for 2026-11-22. (Yverdon-les-Bains → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-11-23. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-11-23. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-11-23. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-11-23. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-11-23. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-11-23. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-11-23. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-11-23. (Genève-Aéroport → Biel/Bienne) |

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
| japan | 2026-11-15T01:25:31.088Z | 2026-11-15T01:31:10.015Z |
| korea | 2026-09-09T17:27:18.865Z | 2026-11-12T02:35:47.443Z |
| singapore | 2026-11-15T01:25:21.240Z | 2026-11-15T01:25:23.755Z |
| malaysia | 2026-11-15T01:25:33.338Z | 2026-11-15T01:25:33.357Z |
| thailand | 2026-11-15T01:25:32.093Z | 2026-11-15T01:25:32.094Z |
| hong_kong | 2026-11-15T01:25:33.811Z | 2026-11-15T01:25:36.091Z |
| united_kingdom | 2026-11-15T01:52:33.488Z | 2026-11-15T01:54:13.597Z |
| united_states | 2026-11-15T01:28:05.239Z | 2026-11-15T01:53:19.985Z |
| germany | 2026-11-15T01:31:12.902Z | 2026-11-15T01:31:13.103Z |
| france | 2026-11-15T01:34:41.948Z | 2026-11-15T01:34:53.083Z |
| belgium | 2026-11-15T01:36:05.854Z | 2026-11-15T01:36:11.027Z |
| norway | 2026-11-15T01:37:26.152Z | 2026-11-15T01:37:34.601Z |
| switzerland | 2026-10-17T23:55:46.215Z | 2026-11-15T01:44:11.797Z |

