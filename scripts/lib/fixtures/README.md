# Kotoden official GTFS evidence

`kotoden-2026-09-05.zip` is the unchanged operator railway archive downloaded on 2026-09-05 UTC from:
https://www.kotoden.co.jp/publichtm/gtfs/gtfsdata/gtfs_kd.zip

SHA-256: `25a6c2928be848ec711dd638155bc6ac0aeeea0b9ec01ad44c0572a706c4c644`.

The archive includes the operator's calendars, exceptions, trip IDs and stop times. The validation regression reads this archive directly: 高松築港 → 琴電琴平 on 2026-09-05 has 34 distinct active trips, departing 06:00 through 22:30 every 30 minutes. For example `土日祝_1列車` runs 06:00–07:02 and `土日祝_3列車` runs 06:30–07:32.

Before changing validation severity, all 2,214 previously stored Kotoden rows (2026-08-30–2026-09-07) were independently checked using Python's zipfile/csv readers against trip_id, calendar/calendar_dates and the two endpoint times. All matched. Fixed spacing therefore remains an audit warning for a registered, complete official timetable; it is not evidence of fabrication. Missing/mismatched provenance and other integrity violations still block publication.

The refreshed snapshots cover 2026-09-05–2026-09-13: 2,853 rows with 2,853 distinct (date, trip ID) identities across 21 actual directed trip spans. Weekend days contain 282 trips, weekdays 345. Each row's actual first/last stop and endpoint times were checked against this archive. Short turns are stored once under their own endpoints, and intermediate searches merge their times with longer trains.

Reproduce the archive-backed regression with:

```sh
npm test -- scripts/lib/timetableValidation.test.ts scripts/scrapers/japanLocalGtfs.test.ts
```
