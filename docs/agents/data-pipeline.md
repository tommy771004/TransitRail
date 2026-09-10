# Data and search pipeline

The hard rules in [CLAUDE.md](../../CLAUDE.md) govern everything here; this file carries the
mechanics behind them. Terminology is defined in [CONTEXT.md](../../CONTEXT.md).

## Adapters

`scripts/scrapers/kinds.ts` defines `DownloadScraper`, `BrowserScraper`, `HtmlScraper`,
`PdfScraper`, `FrequencyScraper`, and `OfficialFeedScraper`. Frequency-only sources may publish
service windows, never invented departures.

`OfficialFeedScraper` is the one most markets use (BE, CH, DE, FR, HK, MY, NO, SG): a
`DownloadScraper` wrapping one official query function, where a non-2xx response, an empty result
set, and a thrown error all raise, so `BaseScraper` leaves the route's previous file untouched. Its
predecessor wrote a curated snapshot over the top instead, which is how a provider outage came to
look like a successful scrape.

Korail uses `KorailTimetableScraper` alongside Korea's subway CSV collector. It
reads the public KTX/regular XLSX board, selects effective editions and weekdays,
and caches downloads across the scrape window. Snapshot `sourceDocuments` records
the exact files, hashes and excluded contradictory trains. See
[supported workbook evidence](../../scripts/lib/fixtures/korail-README.md).

## Storage

`BaseScraper.saveRoute` replaces the collected date's slice while preserving other dates, so a
stored row answers only its exact service date and a failed fetch keeps the previous verified file.

## Windows

Keep the picker range aligned with `SEARCH_WINDOW_DAYS` unless the provider supports arbitrary live
dates. `SCRAPE_WINDOW_DAYS` is derived from it, not equal to it: a full pass runs every
`FULL_SCRAPE_INTERVAL_DAYS`, so one pass must still answer the window a passenger sees days later.

## Nightly cadence

The job runs nightly but does not always collect everything. Live-only markets (HK, TH) refresh
daily; `scripts/scrape-plan.ts` calls a full pass as soon as committed data stops covering the
offered window — the steady-state cadence, and it self-heals after a failed run. `npm run
prune:past` then drops past service days, which a pass only prunes for the dates it collected.

## Catalog

The station browser hydrates `/api/transit/catalog`. Provider-backed markets use the provider's
complete directory; file-backed markets are date-gated. Station query names must remain exact and
searchable.
