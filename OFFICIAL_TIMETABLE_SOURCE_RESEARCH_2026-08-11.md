# Official timetable-source research: Singapore, Malaysia, Thailand, Hong Kong

Research date: 2026-08-11. This assessment follows TransitRail's policy: a
first/last time or a headway must never be expanded into invented individual
departures.

## Conclusion

| Market | Exact individual departures, today through +7 | Safe action |
| --- | --- | --- |
| Singapore | No available official source found | Keep an advisory only. The old LTA train-GTFS endpoint is broken. |
| Malaysia | No, across the whole market | Use Prasarana as official frequency/service-hours data; KTMB currently covers today only. |
| Thailand | No | Query BEM for dated first/last information only. |
| Hong Kong | No | Retain live next-train results for today only. |

Thus none of the four can honestly populate seven days of precise `departures`
from the primary sources currently available. The stations are hidden by the
catalogue's verified/date-answerable gate because there is no qualifying data,
not because of i18n.

## Existing application state

| Market | Existing adapter | Finding |
| --- | --- | --- |
| Singapore | `SingaporeScraper` / `searchSingaporeLtaGtfs` uses `https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain`. | Direct check on 2026-08-11 returned HTTP 404, `The requested API was not found`, before authentication was relevant. |
| Malaysia | `catalog_sync` consumes historical ridership CSVs. | The inputs contain station names/ridership, not schedules. |
| Thailand | `ThailandScraper` is a `FrequencyScraper` against BEM. | It correctly writes no departures. |
| Hong Kong | `HongKongScraper` uses the MTR Next Train API. | It correctly restricts to the live date. |

## Singapore: no current full-timetable source

The retired configured endpoint was a GET using LTA `AccountKey` authentication
and formerly returned a temporary GTFS ZIP link; on the research date it
returned HTTP 404. LTA's current catalogues list dynamic train service alerts
and rail infrastructure, but no Train Schedule/GTFS replacement. DataMall API
access requires registration/acceptance of the API terms and Singapore Open
Data Licence. [Current dynamic catalogue](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html), [static catalogue](https://datamall.lta.gov.sg/content/datamall/en/static-data.html), [access request](https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html), [API guide](https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf?ref=public_apis), [licence](https://datamall.lta.gov.sg/content/datamall/en/SingaporeOpenDataLicence.html).

SMRT and SBS Transit publish day-class first/last service times and operational
notices, not every departure. Those can improve partial service-day advice but
cannot create schedule rows. [SMRT example](https://journey.smrt.com.sg/journey/station_info/raffles-place/first-and-last-train/), [SBS first/last information](https://www.sbstransit.com.sg/first-train-last-train), [SBS train information](https://www.sbstransit.com.sg/Service/TrainInformation).

Recommendation: mark `sg-lta-gtfs` as unavailable/deprecated, retain only
operator-scoped service-window advisories, and revisit only after LTA publishes
a replacement official timetable API/feed.

## Malaysia: official GTFS is useful, but not seven-day exact rail departures

The Malaysian Government's official GTFS documentation identifies KTMB and
Prasarana (LRT/MRT/monorail) as source operators. It specifies ZIP feeds
containing `stop_times.txt` and `calendar.txt`, no auth requirement, and a
4-requests/minute limit:

```text
GET https://api.data.gov.my/gtfs-static/ktmb
GET https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl
```

[GTFS Static documentation](https://developer.data.gov.my/realtime-api/gtfs-static), [rate limit](https://developer.data.gov.my/rate-limit), [terms](https://developer.data.gov.my/terms-of-use).

Live verification on 2026-08-11 found:

- Prasarana's `rapid-rail-kl` feed contains calendar dates through 2026-12-31,
  so it can answer the selected date's service class across +7. It also uses
  `frequencies.txt` with official headway blocks and template trips. It must be
  classified as `frequency-only`: do not materialize its headways into precise
  departures.
- The fresh KTMB feed's `calendar.txt` ends each service on 2026-08-11 and has
  no `calendar_dates.txt`. It can serve exact trips today, but a scraper must
  not write later dates until a feed explicitly covers them.

Recommended implementation: replace Malaysia's historical-catalog-only source
with two cached GTFS `DownloadScraper` acquisitions. For every target date,
apply `calendar.txt` and `calendar_dates.txt` before saving its exact date
slice. Save KTMB rows only when covered. For Prasarana publish a frequency or
service-hours artifact, never derived individual rows. The official docs say
KTMB is refreshed daily at 00:01, Prasarana as required, and recommend a daily
pre-service refresh.

## Thailand: BEM supports dated first/last service information only

BEM's official [fare and journey planner](https://metro.bemplc.co.th/Fare-Calculation?lang=en)
has date/time selection and renders a station- and direction-specific dated
first/last train table for Blue and Purple lines. It warns users not to access
the planner in bulk. Its [system-map/service page](https://metro.bemplc.co.th/MRT-System-Map?lang=en)
publishes service hours and maximum headways. No documented BEM API or official
file with every station departure was found.

Recommended implementation: browser-drive the public planner at most once per
target date, honour its rate warning, verify the displayed date matches the
requested date, and save only first/last advisory values. Mark any returned
other date unavailable. Do not expand headways into departures. This can extend
the BEM artifact through +7 when BEM itself supplies those dates, but cannot
unlock precise-timetable search.

## Hong Kong: next-train API is inherently today-only

MTR's official [DATA.GOV.HK dataset](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)
is JSON updated every 10 seconds and returns only up to the next four trains.
The [MTR API specification](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf)
defines:

```text
GET https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=<LINE>&sta=<STATION>&lang=EN
```

There is no date parameter and no authentication, so a present snapshot cannot
substantiate a future date. MTR's [first/last train pages](https://www.mtr.com.hk/en/customer/services/first_last_train_index.html)
are service-hours only. The Hong Kong Transport Department's [GTFS headway
package](https://data.gov.hk/en-data/dataset/hk-td-tis_11-pt-headway-en) does
not include MTR heavy rail in its `agency.txt`.

Recommendation: keep Hong Kong live-only. A first/last advisory is possible
only with explicit date applicability; it must not create future departures.

## Shared scraper guardrails

1. Fetch a source once per scheduled run, not once per passenger query.
2. Store a `YYYY-MM-DD` slice only where the source proves that exact date.
3. Preserve the prior verified file after a failed acquisition.
4. Preserve source ID, URL, fetched time, and completeness; validate GTFS
   calendars and exceptions.
5. Never derive individual times from `frequencies.txt`, headways, or
   first/last times, and do not offer dates outside source-backed coverage.
