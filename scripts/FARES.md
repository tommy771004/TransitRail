# Official fare snapshots

`public/fares/<country>.json` stores fare evidence separately for all 14 configured
markets. This is **not** a national fare database: coverage is limited to the
named operators and published products below. Hidden markets remain hidden.
`fareSources.ts` registers fare display sources only; these documents cannot
produce searchable departures, alter timetable verification, or supply times.

## Display contract

- Existing provider journey quotes take precedence.
- `TripFare` loads the country's file only when details open, shares a session
  promise, and bounds both fetch and body parsing to four seconds. Failed reads
  are evicted; closing/reopening details retries. No loading/error/missing-fare
  message is rendered.
- Match operator, official station identities, service, ticket/class, date and
  applicable rules. An ambiguous route price is hidden, not minimized or averaged.
- Current implementation matches direct rides only. Never sum transfer legs.
  Korail's multiple timed calls on the same train remain one direct ride.
- The compact block names the adult ticket/class or payment medium and links
  the publisher. Original provider quotes keep their existing presentation.
- A temporary display object is passed to App's existing `formatTripPrice`
  callback, retaining original/converted/both modes and the existing CBC rate
  conversion. No mutation of trip, saved trip, sort price or timetable occurs.
  Missing exchange rates retain the original currency.
- MTR has no effective dates in its CSV: it only resolves the operator-local
  day the snapshot was checked. Korail resolves from the published effective
  date through the checked day. Future dates beyond that evidence are hidden.
  MBTA uses the feed's validity interval plus fare service calendars. An undated
  result must be explicitly live; its date uses the operator timezone.

## Coverage recorded on 2026-09-13

| Country | Saved evidence | Detail fallback |
| --- | --- | --- |
| Japan | Tokyo Metro ordinary adult paper/IC distance bands, checked on official page | Hidden: no verified chargeable journey distance; special sections exist |
| Korea | Korail KTX, ITX-Maum/Saemaeul and Mugunghwa/Nuriro XLS/XLSX interval charts | Exact OD where applicable charts agree; standard or published first-class total |
| Hong Kong | MTR fare and line/station CSVs | Adult ordinary single ticket on a known direct MTR line; excludes Airport Express/first class |
| United States | MBTA GTFS fare products, leg/transfer rules, media, areas and identity relations | Direct rail route with matching stations, fare rules and valid calendar; excludes Amtrak/other operators |
| Singapore | PTC published HTML fare tables | Hidden: no verified chargeable distance or transfer context |
| Switzerland | Alliance SwissPass T603 tariff document; factual numeric rows only | Hidden: tariff distance/route/product context required |
| Malaysia | KTMB ETS/Intercity/Shuttle terms document receipt | Official journey quote required; no universal fixed fare matrix extracted |
| United Kingdom | TfL single-fare finder receipt | Official OD/route/peak/payment quote required |
| Germany | DB fare products page receipt | Official service/date/product quote required |
| France | SNCF current tariff document URL and reviewed validity | Official journey quote required; direct download returned HTTP 403 |
| Belgium | SNCB tariff source URL reviewed | No price table downloaded (HTTP 403); tariff kilometres/product needed |
| Norway | Ruter single-ticket page receipt | No verified journey zones; no price table extracted |
| Thailand | BEM official fare calculator page receipt | No matrix extracted; its first/last-train tables are not fares |
| China | 12306 published-fare query page receipt | Official train/OD quote required; no table extracted |

Source URLs, original byte sizes and SHA-256 hashes live with downloaded data.
The three sources accessed through the web reader instead of direct download
explicitly record that retrieval method; no raw-file hash is claimed for them.
Only factual prices/identities are normalized; full conditions are not reproduced.
`reference-only`, `query-required` and `unavailable` records never become a trip
fare. In particular, advertised minimum prices and monthly passes are not
treated as journey prices.

## Refresh and verification

Run `npm run sync:fares` (or append `-- --country hong_kong`). The Python reader
needs `openpyxl`, `xlrd` and `pdfplumber`; choose an environment with `FARE_PYTHON`.
There are no new runtime dependencies. Use `--input /path/to/downloads` to replay
original files named by source ID, and `FARE_OBSERVED_ON=YYYY-MM-DD` to retain
their actual collection date. Never relabel old input bytes as freshly checked.

Downloads have finite timeouts; each country's replacement is atomic. A failed
download/parser preserves its previous snapshot and returns a nonzero exit code.
Run country-specific refreshes when a publisher blocks automated downloads.
The checked-in reviewed references are preserved at their original review date.

Korail editions are pinned deliberately. Each refresh checks the current board
and refuses a newer edition until the URLs/effective dates/layout are reviewed.
KTX's current A column is read separately from its future B column; first-class
totals come from the published total, never a multiplier. Every via-route sheet
is kept so conflicting OD prices can be rejected. Official bilingual timetable
fixtures supply station spellings only (see `scripts/lib/fixtures/korail-README.md`);
no timetable records or times are written into fare files.

MBTA route/station membership is extracted from GTFS identity relationships;
`trips` and `stop_times` are never exported. Transfer-only products and unsupported
time windows cannot fall through to a generic fare.

Run `npm run lint`, then `npm run check:ui` sequentially. Unit tests cover real
downloaded numeric examples, ambiguity, dates, special products, missing data,
formatter use and timeout recovery. The browser harness uses local data only
and verifies lazy loading, currency changes, removal after a destination change,
one fare block, and mobile/desktop overflow. Refresh these dated evidence tests
when adopting a new source edition.
