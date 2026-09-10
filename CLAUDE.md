# CLAUDE.md

TransitRail is a React 19 SPA backed by one Express server. `server.ts` serves the API and
Vite/static assets; `api/index.ts` exports the same app for Vercel. `src/data/countries.ts`
(`countryConfig`) is the authority for each market's scraper, search mode, live/date capability,
and selectable date range. Terminology is defined in [CONTEXT.md](CONTEXT.md).

`npm run lint` — typecheck plus all Vitest tests — is the required gate for every change.

## Hard rules

- Only a source registered in `src/data/sourceRegistry.ts`, with valid `sourceMeta`, may produce
  searchable departures. Reject curated, LLM, aggregator, estimated, or unregistered schedules.
- Search never synthesizes a timetable. A miss means **no verified timetable**, not "no service."
- Never hand-edit generated output: route directories under `public/`, or
  `src/data/catalog/station-i18n/labels.json`. A slug change requires regenerated redirects
  committed with `vercel.json`.
- Display station names through `stationLabel()` and country overrides; raw provider names stay
  the query identity.
- Use ESM, `tsx` for scripts, and `@/` for the repository alias. API keys are optional; failure
  must degrade safely or preserve the prior snapshot. Keep unrelated dirty-worktree changes intact.

## Read before you work

Each file below carries the rules for its own area — reach for it when the change touches it.

- [docs/agents/commands.md](docs/agents/commands.md) — before scraping, running data-integrity
  audits, regenerating SEO pages, or re-sourcing station labels; those tasks have their own
  commands and ordering.
- [docs/agents/data-pipeline.md](docs/agents/data-pipeline.md) — before changing scrapers, scrape
  scripts, search, the catalog, the date picker, the scrape windows, or their service-day tests.
- [docs/agents/i18n-publication.md](docs/agents/i18n-publication.md) — before changing station
  labels, translations, slugs, or route pages.
- [docs/agents/ui.md](docs/agents/ui.md) — before touching components, styles, or `src/index.css`.
