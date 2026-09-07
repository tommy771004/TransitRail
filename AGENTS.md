# AGENTS.md

TransitRail is a React 19 SPA backed by one Express server. `server.ts` serves the API and
Vite/static assets; `api/index.ts` exports the same app for Vercel. `src/data/countries.ts`
(`countryConfig`) is the authority for each market's scraper, search mode, live/date capability,
and selectable date range.

## Commands

```bash
npm run dev             # Express + Vite
npm run lint            # Typecheck + all Vitest tests; required gate
npm test                # Tests only
npm run validate:data   # Data integrity gate; required for timetable changes
```

Read [docs/agents/commands.md](docs/agents/commands.md) before scraping, regenerating SEO pages, or
re-sourcing station labels — those tasks have their own commands and ordering.

## Hard rules

- Only a source registered in `src/data/sourceRegistry.ts`, with valid `sourceMeta`, may produce
  searchable departures. Reject curated, LLM, aggregator, estimated, or unregistered schedules.
- Search never synthesizes a timetable. A miss means **no verified timetable**, not "no service."
- Stored rows answer only their exact service date; a failed fetch keeps the previous verified
  file. Never edit `SEARCH_WINDOW_DAYS` and `SCRAPE_WINDOW_DAYS` apart.
- New France/Thailand service-day suites must use `serviceDayArtifactFixture()`; never delete their
  committed artifact during tests.
- Never hand-edit generated output: route directories under `public/`, or
  `src/data/catalog/station-i18n/labels.json`. A slug change requires regenerated redirects
  committed with `vercel.json`.
- Display station names through `stationLabel()` and country overrides; raw provider names stay
  the query identity.
- Run `scripts/audit-station-mapping.ts` after changing routes or station lists.

Before changing scrapers, scrape scripts, search, the catalog, the date picker, or the scrape
windows, read [docs/agents/data-pipeline.md](docs/agents/data-pipeline.md) — it carries the storage
semantics, adapter list, window derivation, and nightly cadence those changes depend on.
Terminology is defined in [CONTEXT.md](CONTEXT.md).

Before changing station labels, translations, slugs, or route pages, read
[docs/agents/i18n-publication.md](docs/agents/i18n-publication.md) for the label sourcing chain and
publication rules.

## Conventions

Use ESM, `tsx` for scripts, and `@/` for the repository alias. API keys are optional; failure must
degrade safely or preserve the prior snapshot. Keep unrelated dirty-worktree changes intact.
