# Korail official timetable evidence

Unchanged operator XLSX files downloaded on 2026-09-09 UTC from the public
[Korail timetable board](https://www.korail.com/ticket/reserve/train-timeTable).
The board's public JSON is `https://www.korail.com/com/userBoard.do?mode=list&schBcid=ticketTable`.
Both titles explicitly say effective 2026-09-01; board publication dates are not effective dates.

| Fixture | Official download | SHA-256 |
| --- | --- | --- |
| korail-ktx-2026-09-01.xlsx | https://www.korail.com/file/cubedata/COMMON/jfile/202608/25/202608251a036897009480.xlsx | cf69ea35e0b6ad9fb82c0e0b44f60833e34eadab55ea610eaf6784622351e9d0 |
| korail-regular-2026-09-01.xlsx | https://www.korail.com/file/cubedata/COMMON/jfile/202608/25/202608251a036890aa0430.xlsx | 2c1531ebce6ffd9aa18f51cc91d8fe4bffd7d95093dc970e21f5cc1964d3b61d |

The parser reads cached published values, never evaluates formulas. KTX sheets
have horizontal trains; regular sheets have vertical trains and a `보는방법`
example sheet that must never become departures. Day remarks govern service;
blank regular remarks mean daily according to that workbook's legend.
Published `h:mm` cells hide seconds, so 06:52:30 stays 06:52.

These workbooks yield 621 KTX and 456 regular train records across 19 named
corridors and 255 distinct operator station names. Records may describe a
section of a through train in a particular sheet, rather than a unique train.
Both directions and every intermediate time are read independently.

Regular `서해선` train 1237 is excluded: H7 lists 18:30 departure, H29 lists
19:37 arrival, while timed stops H18:H24 run from 19:00 to 20:07. Neither set
is silently corrected. The exclusion is logged and recorded in each snapshot's
`sourceDocuments` alongside the download URL, effective dates and SHA-256.
Other unrecognized layouts, remarks or times abort the download before writes.

Snapshot rows materialize only the requested boarding date. A previous day's
train still running after midnight supplies a separate next-date tail; reverse
journeys never borrow the forward timetable. Full overnight trips retain 24+
hours so their elapsed duration and date remain unambiguous.

Run `npm test -- scripts/lib/korailTimetable.test.ts` for the fixture regression.
The scheduled path is `scrape.yml` → `scripts/scrape-all.ts` → scraper registry
→ `KorailTimetableScraper`; `npm run scrape:korea` runs both Korean sources.
No API key is needed. The board and each selected edition are downloaded once
per scraper instance. Failed download/parse leaves previous snapshots intact.
