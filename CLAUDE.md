# CLAUDE.md

TransitRail is a React 19 SPA backed by one Express server. `server.ts` serves the API and Vite/static assets; `api/index.ts` exports the same app for Vercel. Use `src/data/countries.ts` (`countryConfig`) as the authority for each market’s scraper, search mode, live/date capability, and selectable date range.

## Commands

```bash
npm run dev                         # Express + Vite
npm run build                       # Frontend and server bundle
npm run lint                        # Typecheck + all Vitest tests; required gate
npm test                            # Tests only
npm run scrape [YYYY-MM-DD]         # All markets, SCRAPE_WINDOW_DAYS forward
npm run scrape -- --live-only       # Only markets whose source answers for today (HK, TH)
npm run scrape:<country>            # One market, same window as the nightly run
npm run scrape:plan                 # Print tonight's pass: full | live-only
npm run prune:past                  # Drop rows for service days that have passed
npm run validate:data               # Data integrity gate
npm run audit:sources               # Refresh source coverage
npm run routes && npm run sitemap   # Regenerate SEO pages, then sitemaps
npm run redirects                   # Required after route-slug changes
npm run sync:station-i18n <market>  # Re-source zh-TW/ja/ko station labels
npm run audit:station-i18n          # Per-market station label coverage
```

New France/Thailand service-day suites must use `serviceDayArtifactFixture()`; never delete their committed artifact during tests.

## Data and search rules

- Only a source registered in `src/data/sourceRegistry.ts`, with valid `sourceMeta`, may produce searchable departures. Reject curated, LLM, aggregator, estimated, or unregistered schedules.
- Search never synthesizes a timetable. A miss means **no verified timetable**, not “no service.”
- Stored rows answer only their exact service date. `BaseScraper.saveRoute` replaces that date’s slice while preserving other dates. A failed fetch keeps the previous verified file.
- Keep the picker range aligned with `SEARCH_WINDOW_DAYS` unless the provider supports arbitrary live dates. `SCRAPE_WINDOW_DAYS` is derived from it, not equal to it: the nightly job runs a full pass every `FULL_SCRAPE_INTERVAL_DAYS`, so one pass must still answer the window a passenger sees days later. Never edit them apart.
- The nightly job runs every night but does not always collect everything. Live-only markets refresh daily; `scripts/scrape-plan.ts` calls a full pass as soon as committed data stops covering the offered window, which is the cadence in steady state and self-heals after a failed run. `npm run prune:past` then drops rows for past service days, which a pass only prunes for the dates it collected.
- Scraper adapters are `DownloadScraper`, `BrowserScraper`, `HtmlScraper`, `PdfScraper`, and `FrequencyScraper`. Frequency-only sources may publish service windows, never invented departures.
- The station browser hydrates `/api/transit/catalog`. Provider-backed markets use the provider’s complete directory; file-backed markets are date-gated. Station query names must remain exact and searchable.
- Run `npm run validate:data` for timetable changes and `scripts/audit-station-mapping.ts` after changing routes or station lists.

## i18n and publication

Display station names through `stationLabel()` and country overrides. Preserve raw provider names as query identities; generated translations must not overwrite curated keys.

Station labels for zh-TW, ja and ko are sourced, never transliterated by us: `scripts/sync-station-translations.ts` reads the market's own station directory and takes the label from the station's Wikipedia article title, then an operator-published name, then the Wikidata label. Chinese from any of those goes through MediaWiki's `zh-tw` variant conversion, so a Simplified source ships Traditional. A station no source answers for gets **no entry** and keeps the operator's own name — that is the correct display, not a gap to fill by inventing one. Provenance per label lives in `src/data/catalog/station-i18n/<market>.json`; `labels.json` next to it is generated from those artifacts and must never be hand-edited.

SEO locale, slug, and route-page rules live in `scripts/lib/routePages.ts`. Never hand-edit generated route directories under `public/`. A slug change requires regenerated redirects committed with `vercel.json`.

## Conventions

Use ESM, `tsx` for scripts, and `@/` for the repository alias. API keys are optional; failure must degrade safely or preserve the prior snapshot. Keep unrelated dirty-worktree changes intact.
