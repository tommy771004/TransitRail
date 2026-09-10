# Data and search pipeline

The hard rules in [CLAUDE.md](../../CLAUDE.md) govern everything here; this file carries the
mechanics and the task-specific rules behind them. Terminology is defined in
[CONTEXT.md](../../CONTEXT.md).

## Adapters

`scripts/scrapers/kinds.ts` defines `DownloadScraper`, `BrowserScraper`, `HtmlScraper`,
`PdfScraper`, `FrequencyScraper`, and `OfficialFeedScraper`. Frequency-only sources may publish
service windows, never invented departures.

`OfficialFeedScraper` is the one most markets use (BE, CH, DE, FR, HK, MY, NO, SG): a
`DownloadScraper` wrapping one official query function, where a non-2xx response, an empty result
set, and a thrown error all raise, so `BaseScraper` leaves the route's previous file untouched. Its
predecessor wrote a curated snapshot over the top instead, which is how a provider outage came to
look like a successful scrape.

A day whose departures all sit at one exact interval is a review signal, not proof of fabrication:
a clock-face network publishes that shape deliberately (the Swiss Taktfahrplan, Kotoden's half-hourly
line). `OfficialFeedScraper` therefore rejects the fetch only when the source cannot substantiate a
`full-timetable`; from a registered full-timetable source the publish validator downgrades it to a
warning, and `npm run validate:data` commits on warnings.

Korail uses `KorailTimetableScraper` alongside Korea's subway CSV collector. It
reads the public KTX/regular XLSX board, selects effective editions and weekdays,
and caches downloads across the scrape window. Snapshot `sourceDocuments` records
the exact files, hashes and excluded contradictory trains. See
[supported workbook evidence](../../scripts/lib/fixtures/korail-README.md).

## Storage

`BaseScraper.saveRoute` replaces the collected date's slice while preserving other dates, so a
stored row answers only its exact service date and a failed fetch keeps the previous verified file.

## Windows

All three constants live in `src/data/countries.ts`, and `SCRAPE_WINDOW_DAYS` is *computed* —
`SEARCH_WINDOW_DAYS + FULL_SCRAPE_INTERVAL_DAYS - 1` — because a full pass runs only every
`FULL_SCRAPE_INTERVAL_DAYS`, so one pass must still answer the window a passenger sees days later.
Never break that derivation by pinning the scrape window to its own literal; move
`SEARCH_WINDOW_DAYS` or the interval and let it follow.

Keep the picker range aligned with `SEARCH_WINDOW_DAYS` unless the provider supports arbitrary live
dates.

## Scheduling

`runAllScrapers` collects **one country at a time per worker, `DEFAULT_COUNTRY_CONCURRENCY`
workers**, and inside a country every scraper collects its whole date window before the next one
starts. Two properties depend on that shape, so keep both if you change it:

- A country is the unit of parallelism because its scrapers share a data directory and its run
  report. Countries are independent providers with independent rate limits, so overlapping them
  costs nothing — nearly all of a pass is spent waiting, not computing.
- The window is the inner loop so a browser market launches one Chromium per scraper rather than
  one per service day, and a scraper that parses a large feed can hold it across its dates.

Concurrent countries interleave their output, so a summary line has to name its own scraper —
the workflow's timing report greps `Done:` out of the log.

`routeConcurrency` (default 1) is per scraper and is a statement about the provider, not a
throughput knob: raise it only for a source with no rate limiter and no session state shared
between routes.

## Nightly cadence

The job runs nightly but does not always collect everything. Live-only markets (HK, TH) refresh
daily; `scripts/scrape-plan.ts` calls a full pass as soon as committed data stops covering the
offered window — the steady-state cadence, and it self-heals after a failed run. `npm run
prune:past` then drops past service days, which a pass only prunes for the dates it collected.

## Tests

New France and Thailand service-day suites must use `serviceDayArtifactFixture()`, and their
committed artifact is never deleted during a test run.

Run `tsx scripts/audit-station-mapping.ts` after changing routes or station lists.

## Catalog

The station browser hydrates `/api/transit/catalog`. Provider-backed markets use the provider's
complete directory; file-backed markets are date-gated. Station query names must remain exact and
searchable.
