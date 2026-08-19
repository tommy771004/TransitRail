# CLAUDE.md

TransitRail is a React 19 SPA backed by one Express server. `server.ts` serves the API and Vite/static assets; `api/index.ts` exports the same app for Vercel. Use `src/data/countries.ts` (`countryConfig`) as the authority for each market’s scraper, search mode, live/date capability, and selectable date range.

## Commands

```bash
npm run dev                         # Express + Vite
npm run build                       # Frontend and server bundle
npm run lint                        # Typecheck + all Vitest tests; required gate
npm test                            # Tests only
npm run scrape [YYYY-MM-DD]         # All markets, seven-day window
npm run scrape:<country>            # One market
npm run validate:data               # Data integrity gate
npm run audit:sources               # Refresh source coverage
npm run routes && npm run sitemap   # Regenerate SEO pages, then sitemaps
npm run redirects                   # Required after route-slug changes
```

New France/Thailand service-day suites must use `serviceDayArtifactFixture()`; never delete their committed artifact during tests.

## Data and search rules

- Only a source registered in `src/data/sourceRegistry.ts`, with valid `sourceMeta`, may produce searchable departures. Reject curated, LLM, aggregator, estimated, or unregistered schedules.
- Search never synthesizes a timetable. A miss means **no verified timetable**, not “no service.”
- Stored rows answer only their exact service date. `BaseScraper.saveRoute` replaces that date’s slice while preserving other dates. A failed fetch keeps the previous verified file.
- Keep the picker range aligned with `SCRAPE_WINDOW_DAYS` unless the provider supports arbitrary live dates.
- Scraper adapters are `DownloadScraper`, `BrowserScraper`, `HtmlScraper`, `PdfScraper`, and `FrequencyScraper`. Frequency-only sources may publish service windows, never invented departures.
- The station browser hydrates `/api/transit/catalog`. Provider-backed markets use the provider’s complete directory; file-backed markets are date-gated. Station query names must remain exact and searchable.
- Run `npm run validate:data` for timetable changes and `scripts/audit-station-mapping.ts` after changing routes or station lists.

## i18n and publication

Display station names through `stationLabel()` and country overrides. Preserve raw provider names as query identities; generated translations must not overwrite curated keys.

SEO locale, slug, and route-page rules live in `scripts/lib/routePages.ts`. Never hand-edit generated route directories under `public/`. A slug change requires regenerated redirects committed with `vercel.json`.

## Conventions

Use ESM, `tsx` for scripts, and `@/` for the repository alias. API keys are optional; failure must degrade safely or preserve the prior snapshot. Keep unrelated dirty-worktree changes intact.
