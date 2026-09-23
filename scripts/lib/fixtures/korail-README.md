# Korail official timetable evidence

Unchanged operator XLSX files downloaded on 2026-09-09 UTC from the public
[Korail timetable board](https://www.korail.com/ticket/reserve/train-timeTable).
The board's public JSON is `https://www.korail.com/com/userBoard.do?mode=list&schBcid=ticketTable`.
Both titles explicitly say effective 2026-09-01; board publication dates are not effective dates.

| Fixture | Official download | SHA-256 |
| --- | --- | --- |
| korail-ktx-2026-09-01.xlsx | https://www.korail.com/file/cubedata/COMMON/jfile/202608/25/202608251a036897009480.xlsx | cf69ea35e0b6ad9fb82c0e0b44f60833e34eadab55ea610eaf6784622351e9d0 |
| korail-regular-2026-09-01.xlsx | https://www.korail.com/file/cubedata/COMMON/jfile/202608/25/202608251a036890aa0430.xlsx | 2c1531ebce6ffd9aa18f51cc91d8fe4bffd7d95093dc970e21f5cc1964d3b61d |
| korail-ktx-2026-10-01.xlsx | https://www.korail.com/file/cubedata/COMMON/jfile/202609/23/202609231a0cb38a2c5200.xlsx | eaadc99d90aa9fb4e009ca74d812cc4aa4885a7aee98950adc715dca6c0ad623 |

The 10/1 KTX workbook was downloaded on 2026-09-23 UTC, the day it replaced the
9/18 edition's board post.

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
The 10/1 KTX `호남선` train 450 is excluded the same way: an up train typed into
the down block, so its times run backwards (용산 22:54 → 광명 22:38 → … →
광주송정 20:50). It is not reversed into the other direction. Only a KTX train
whose times run backwards is excluded; other unrecognized layouts, remarks or
times abort the download before writes.

Korail edits a board post in place when it announces a new edition, so the
edition still in force can vanish from the board before its successor takes
effect (on 2026-09-23 the 9/18 KTX post became the 10/1 one, which left 5/15 as
the newest listed edition for 9/23–9/30). The scraper therefore also considers
the editions its committed Korea snapshots cite in `sourceDocuments`. The board
still wins for any family and effective date it lists, and a recovered edition
is used only if Korail serves a byte-identical file (same SHA-256).

Snapshot rows materialize only the requested boarding date. A previous day's
train still running after midnight supplies a separate next-date tail; reverse
journeys never borrow the forward timetable. Full overnight trips retain 24+
hours so their elapsed duration and date remain unambiguous.

Run `npm test -- scripts/lib/korailTimetable.test.ts` for the fixture regression.
The scheduled path is `scrape.yml` → `scripts/scrape-all.ts` → scraper registry
→ `KorailTimetableScraper`; `npm run scrape:korea` runs both Korean sources.
No API key is needed. The board and each selected edition are downloaded once
per scraper instance. Failed download/parse leaves previous snapshots intact.
