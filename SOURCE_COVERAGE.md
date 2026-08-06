# Source coverage and audit

Generated 2026-08-06T02:33:47.890Z by `npm run audit:sources`. Do not edit by hand.

Every departure TransitRail serves comes from a source in
[`src/data/sourceRegistry.ts`](src/data/sourceRegistry.ts). A route with no registered source
carries no departures and search answers *No verified timetable available.*

## Summary

- 10 of 14 configured markets serve departure times.
- 22,056 stored departures across 43 verified routes.
- 1 market(s) can answer nothing: china.

## What each market can answer

| Market | Answers | Sources | Tier | Completeness | Routes | Departures | Artifact runs | Service days |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 🇯🇵 japan | Departure times | jp-odpt-toei | A | full-timetable | 8 | 11,415 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇰🇷 korea | Departure times | kr-incheon-transit-csv<br>kr-seoul-metro-csv | A | full-timetable | 0 | 0 | 13,728 | — |
| 🇨🇳 china | **No data** — no registered source | — | — | — | 0 | 0 | — | — |
| 🇸🇬 singapore | Service hours / frequency only | — | — | — | 0 | 0 | — | — |
| 🇲🇾 malaysia | Station names only | — | — | — | 0 | 0 | — | — |
| 🇹🇭 thailand | Service hours / frequency only | — | — | — | 0 | 0 | — | — |
| 🇭🇰 hong_kong | Departure times | hk-mtr-next-train | A | full-timetable | 4 | 16 | — | 2026-08-06 |
| 🇬🇧 united_kingdom | Departure times | uk-tfl-journey-planner | A | full-timetable | 4 | 1,974 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇺🇸 united_states | Departure times | us-mbta-v3 | A | full-timetable | 4 | 5,463 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇩🇪 germany | Departure times | de-gtfs | A | full-timetable | 4 | 722 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇫🇷 france | Departure times | fr-sncf-gtfs | A | full-timetable | 4 | 440 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇧🇪 belgium | Departure times | be-irail | A | full-timetable | 5 | 215 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇳🇴 norway | Departure times | no-entur | A | full-timetable | 5 | 178 | — | 2026-08-06 … 2026-08-12 (7) |
| 🇨🇭 switzerland | Departure times | ch-opentransportdata-gtfs | A | full-timetable | 5 | 1,633 | — | 2026-08-06 … 2026-08-12 (7) |

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

## Known gaps

These are markets or operators with no source wired up. They are listed so the
absence is a tracked fact rather than something a reader has to infer from an
empty table row.

| Operator | Market | Why there is no data |
| --- | --- | --- |
| Korail | korea | Blocks automated access to its journey search (`CODE : -8003`); no open feed. |
| 12306 | china | No open feed, and no permitted automated access to the official search. |
| JR East / West / Kyushu / Hokkaido / Shikoku | japan | No adapter written; only JR Central and ODPT are wired up. |
| National Rail | united_kingdom | Only TfL is wired up; Network Rail / National Rail feeds are not. |
| SNCF TER / RER / Metro | france | Only the long-distance GTFS extract is wired up. |
| KTMB / Prasarana | malaysia | Publishes station catalogues, no timetable. |

## Freshness

| Market | Oldest fetch | Newest fetch |
| --- | --- | --- |
| japan | 2026-08-05T23:05:12.609Z | 2026-08-05T23:05:12.663Z |
| korea | 2026-08-01T05:58:24.121Z | 2026-08-02T13:52:27.505Z |
| hong_kong | 2026-08-05T22:47:54.724Z | 2026-08-05T22:47:56.674Z |
| united_kingdom | 2026-08-05T23:05:28.154Z | 2026-08-05T23:06:12.967Z |
| united_states | 2026-08-05T23:06:16.255Z | 2026-08-05T23:06:16.773Z |
| germany | 2026-08-05T23:06:16.833Z | 2026-08-05T23:06:16.992Z |
| france | 2026-08-05T23:06:18.156Z | 2026-08-05T23:06:21.517Z |
| belgium | 2026-08-05T23:06:26.714Z | 2026-08-05T23:06:28.794Z |
| norway | 2026-08-05T23:06:30.322Z | 2026-08-05T23:06:34.623Z |
| switzerland | 2026-08-05T23:06:34.626Z | 2026-08-05T23:06:34.634Z |

