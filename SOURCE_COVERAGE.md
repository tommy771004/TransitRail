# Source coverage and audit

Generated 2026-10-21T00:46:21.063Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 12 of 14 configured markets serve departure times.
- 151,289 stored departures across 471 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Network today | Timetable as of fetch | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | 3/3 declared regions; 11/19 declared lines; 191/221 declared stations: tokyo-urban, japan-intercity, takamatsu-kotoden | full-timetable (2026-10-21); observed 00:02–23:58; 2026-10-21T00:19:35.112Z | jp-jr-central<br>jp-kotoden-gtfs<br>jp-odpt-toei<br>jp-odpt-tokyo-metro | A, C | full-timetable | 53 | 31,693 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇰🇷 korea | Departure times | 2/2 declared regions; 28/31 declared lines; 513/587 declared stations: seoul-capital, korail-intercity | full-timetable (2026-10-21); observed 00:00–23:28; 2026-10-21T00:15:09.078Z | kr-incheon-transit-csv<br>kr-korail-timetable-xlsx<br>kr-seoul-metro-csv | A | full-timetable | 194 | 8,743 | 13,675 | 2026-10-21 … 2026-10-29 (9) |
| 🇨🇳 china | **No data** — no registered source | No searchable network (0/1 declared regions; 0/6 declared lines; 0/17 declared stations) — stations.no_registered_timetable_source | unavailable (2026-10-21) | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Departure times | Directory only (1/1 declared regions; 9/9 declared lines; 184/184 declared stations) — stations.no_verified_timetable_for_date | full-timetable (2026-10-21); observed 00:01–23:58; 2026-10-21T00:14:08.617Z | sg-lta-gtfs | A | full-timetable | 10 | 32,518 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇲🇾 malaysia | Departure times | 1/1 declared regions; 6/3 declared lines; 5/5 declared stations: malaysia-intercity | full-timetable (2026-10-21); observed 05:54–23:21; 2026-10-21T00:14:15.140Z | my-ktmb-gtfs | A | full-timetable | 6 | 992 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇹🇭 thailand | Service hours / frequency only | Directory only (1/1 declared regions; 7/5 declared lines; 167/119 declared stations) — stations.no_verified_timetable_for_date | frequency-or-service-hours (2026-10-21); 2026-10-21T00:14:15.142Z | th-bem-service-hours | C | frequency-only | 4 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | 1/1 declared regions; 10/6 declared lines; 98/23 declared stations: hong-kong | bounded-upcoming (2026-10-21); observed 08:14–08:50; 2026-10-21T00:14:22.650Z | hk-mtr-next-train | A | full-timetable | 8 | 32 | — | 2026-10-21 |
| 🇬🇧 united_kingdom | Departure times | No searchable network (0/1 declared regions; 0/11 declared lines; 0/961 declared stations) — stations.no_verified_searchable_lines_for_date | sampled-service-day (2026-10-21); observed 05:31–23:36; 2026-10-21T00:44:32.953Z | uk-tfl-journey-planner | A | full-timetable | 8 | 2,375 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇺🇸 united_states | Departure times | 1/1 declared regions; 8/6 declared lines; 6/263 declared stations: boston | stale (2026-10-20); 2026-10-21T00:43:07.963Z | us-mbta-journey-planner-web<br>us-mbta-v3 | A, B | full-timetable | 8 | 11,910 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇩🇪 germany | Departure times | 1/1 declared regions; 4/6 declared lines; 5/17 declared stations: germany-intercity | full-timetable (2026-10-21); observed 00:01–23:55; 2026-10-21T00:19:39.347Z | de-gtfs | A | full-timetable | 8 | 1,380 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇫🇷 france | Departure times | 1/1 declared regions; 3/4 declared lines; 7/18 declared stations: france-intercity | full-timetable (2026-10-21); observed 04:44–21:04; 2026-10-21T00:24:52.799Z | fr-sncf-gtfs | A | full-timetable | 8 | 1,287 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇧🇪 belgium | Departure times | 1/1 declared regions; 10/5 declared lines; 29/714 declared stations: belgium-intercity | sampled-service-day (2026-10-21); observed 04:08–08:03; 2026-10-21T00:26:01.743Z | be-irail | A | full-timetable | 10 | 540 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇳🇴 norway | Departure times | 1/1 declared regions; 10/5 declared lines; 7/12 declared stations: norway-intercity | sampled-service-day (2026-10-21); observed 08:00–12:06; 2026-10-21T00:27:30.081Z | no-entur | A | full-timetable | 10 | 462 | — | 2026-10-21 … 2026-10-29 (9) |
| 🇨🇭 switzerland | Departure times | 1/1 declared regions; 5/5 declared lines; 21/23 declared stations: switzerland-intercity | full-timetable (2026-10-21); observed 00:00–23:59; 2026-10-21T00:34:38.505Z | ch-opentransportdata-gtfs | A | full-timetable | 144 | 59,357 | — | 2026-10-21 … 2026-10-29 (9) |

## Latest committed scrape attempt

This section is read from each market's committed `metadata.json`, which the daily GitHub Action writes after scraping. A failed route is reported here even when its previous verified snapshot remains in service.

| Market | Metadata built at | Failed attempts | Details |
| --- | --- | ---: | --- |
| 🇯🇵 japan | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇰🇷 korea | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇨🇳 china | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇸🇬 singapore | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇲🇾 malaysia | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇹🇭 thailand | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇭🇰 hong_kong | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇬🇧 united_kingdom | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇺🇸 united_states | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇩🇪 germany | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇫🇷 france | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇧🇪 belgium | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇳🇴 norway | 2026-10-21T00:44:32.963Z | 0 | — |
| 🇨🇭 switzerland | 2026-10-21T00:44:32.963Z | 101 | 1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-21. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-21. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-21. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-21. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-21. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-21. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-21. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-21. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-22. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-22. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-22. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-22. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-22. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-22. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-22. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-22. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-23. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-23. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-23. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-23. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-23. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-23. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-23. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-23. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-24. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Bern → St. Gallen service for 2026-10-24. (Bern → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Fribourg/Freiburg → St. Gallen service for 2026-10-24. (Fribourg/Freiburg → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Fribourg/Freiburg → Winterthur service for 2026-10-24. (Fribourg/Freiburg → Winterthur)<br>1 attempt(s): Swiss GTFS published no Genève → St. Gallen service for 2026-10-24. (Genève → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Genève → Winterthur service for 2026-10-24. (Genève → Winterthur)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → St. Gallen service for 2026-10-24. (Genève-Aéroport → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Winterthur service for 2026-10-24. (Genève-Aéroport → Winterthur)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-24. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-24. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-24. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-24. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Bern service for 2026-10-24. (St. Gallen → Bern)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Fribourg/Freiburg service for 2026-10-24. (St. Gallen → Fribourg/Freiburg)<br>1 attempt(s): Swiss GTFS published no Winterthur → Fribourg/Freiburg service for 2026-10-24. (Winterthur → Fribourg/Freiburg)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Genève service for 2026-10-24. (St. Gallen → Genève)<br>1 attempt(s): Swiss GTFS published no Winterthur → Genève service for 2026-10-24. (Winterthur → Genève)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Genève-Aéroport service for 2026-10-24. (St. Gallen → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Winterthur → Genève-Aéroport service for 2026-10-24. (Winterthur → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-24. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-24. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-24. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-25. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Bern → St. Gallen service for 2026-10-25. (Bern → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Fribourg/Freiburg → St. Gallen service for 2026-10-25. (Fribourg/Freiburg → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Fribourg/Freiburg → Winterthur service for 2026-10-25. (Fribourg/Freiburg → Winterthur)<br>1 attempt(s): Swiss GTFS published no Genève → St. Gallen service for 2026-10-25. (Genève → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Genève → Winterthur service for 2026-10-25. (Genève → Winterthur)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → St. Gallen service for 2026-10-25. (Genève-Aéroport → St. Gallen)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Winterthur service for 2026-10-25. (Genève-Aéroport → Winterthur)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-25. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-25. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-25. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-25. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Bern service for 2026-10-25. (St. Gallen → Bern)<br>1 attempt(s): Swiss GTFS published no Winterthur → Bern service for 2026-10-25. (Winterthur → Bern)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Fribourg/Freiburg service for 2026-10-25. (St. Gallen → Fribourg/Freiburg)<br>1 attempt(s): Swiss GTFS published no Winterthur → Fribourg/Freiburg service for 2026-10-25. (Winterthur → Fribourg/Freiburg)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Genève service for 2026-10-25. (St. Gallen → Genève)<br>1 attempt(s): Swiss GTFS published no Winterthur → Genève service for 2026-10-25. (Winterthur → Genève)<br>1 attempt(s): Swiss GTFS published no St. Gallen → Genève-Aéroport service for 2026-10-25. (St. Gallen → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Winterthur → Genève-Aéroport service for 2026-10-25. (Winterthur → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-25. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-25. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-25. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-26. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-26. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-26. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-26. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-26. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-26. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-26. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-26. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-27. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-27. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-27. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-27. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-27. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-27. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-27. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-27. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-28. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-28. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-28. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-28. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-28. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-28. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-28. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-28. (Genève-Aéroport → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Bern → Interlaken Ost service for 2026-10-29. (Bern → Interlaken Ost)<br>1 attempt(s): Swiss GTFS published no Chur → Zürich Flughafen service for 2026-10-29. (Chur → Zürich Flughafen)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève service for 2026-10-29. (Biel/Bienne → Genève)<br>1 attempt(s): Swiss GTFS published no Biel/Bienne → Genève-Aéroport service for 2026-10-29. (Biel/Bienne → Genève-Aéroport)<br>1 attempt(s): Swiss GTFS published no Interlaken Ost → Bern service for 2026-10-29. (Interlaken Ost → Bern)<br>1 attempt(s): Swiss GTFS published no Zürich Flughafen → Chur service for 2026-10-29. (Zürich Flughafen → Chur)<br>1 attempt(s): Swiss GTFS published no Genève → Biel/Bienne service for 2026-10-29. (Genève → Biel/Bienne)<br>1 attempt(s): Swiss GTFS published no Genève-Aéroport → Biel/Bienne service for 2026-10-29. (Genève-Aéroport → Biel/Bienne) |

## Cached station and line directories

These catalogs are fetched during a deliberate update step and committed as JSON. The runtime station picker reads the snapshot; it does not call the official map or Wikipedia per request.

| Market | Snapshot | Official directory | Lines | Stations | Wikipedia i18n |
| --- | --- | --- | ---: | ---: | ---: |
| 🇸🇬 singapore | [src/data/catalog/singapore.json](src/data/catalog/singapore.json) | <https://www.mytransport.sg/trainstatus> | 9 | 184 | 184/184 |
| 🇲🇾 malaysia | [src/data/catalog/malaysia.json](src/data/catalog/malaysia.json) | <https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily> | 0 | 236 | — |

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
| japan | 2026-10-21T00:14:12.750Z | 2026-10-21T00:19:35.112Z |
| korea | 2026-09-09T17:27:18.865Z | 2026-10-21T00:15:09.078Z |
| singapore | 2026-10-21T00:14:06.053Z | 2026-10-21T00:14:08.617Z |
| malaysia | 2026-10-21T00:14:15.122Z | 2026-10-21T00:14:15.140Z |
| thailand | 2026-10-21T00:14:15.141Z | 2026-10-21T00:14:15.142Z |
| hong_kong | 2026-10-21T00:14:18.717Z | 2026-10-21T00:14:22.650Z |
| united_kingdom | 2026-10-21T00:42:50.427Z | 2026-10-21T00:44:32.953Z |
| united_states | 2026-10-21T00:18:06.115Z | 2026-10-21T00:43:07.963Z |
| germany | 2026-10-21T00:19:39.070Z | 2026-10-21T00:19:39.347Z |
| france | 2026-10-21T00:24:37.062Z | 2026-10-21T00:24:52.799Z |
| belgium | 2026-10-21T00:25:56.843Z | 2026-10-21T00:26:01.743Z |
| norway | 2026-10-21T00:27:21.557Z | 2026-10-21T00:27:30.081Z |
| switzerland | 2026-10-17T23:55:46.215Z | 2026-10-21T00:34:38.505Z |

