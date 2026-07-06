# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Full app: Express API + Vite middleware (tsx server.ts) on one port
npm run build            # vite build (frontend → dist/) + esbuild bundle server → dist/server.cjs
npm start                # Run the production bundle (node dist/server.cjs)
npm run lint             # tsc --noEmit — the ONLY automated check; there is no unit-test suite

# Scrapers (need Chromium: npx playwright install chromium)
npm run scrape [YYYY-MM-DD]     # Run every country scraper, 7 days forward from date/today
npm run scrape:<country>        # One country, e.g. npm run scrape:japan
npm run scrape:metadata         # Regenerate every src/data/scraped/<country>/metadata.json from files

# Maintenance scripts (run with npx tsx)
npx tsx scripts/audit-station-mapping.ts    # Verify scraper route names match the station menu (0 = clean)
npx tsx scripts/seed-curated-snapshots.ts   # De-dupe + (re)seed curated snapshot timetables
```

There is no test framework. `npm run lint` (TypeScript typecheck) is the gate. Verify data changes by importing `findScrapedResults` from `src/data/scraped` in a `npx tsx -e '...'` snippet.

## Architecture

A mobile-first cross-border transit timetable search app: React 19 SPA + a single Express server that also serves the API.

**One server, two deploy targets.** `server.ts` builds and exports an Express `app`. In dev it mounts Vite as middleware (whole app on one port). `api/index.ts` re-exports `app` as a Vercel serverless function (`vercel.json` routes `/api/*` there, everything else to the SPA). The app also runs on Google AI Studio (hence `GEMINI_API_KEY`, `APP_URL`, and the `DISABLE_HMR` handling in `vite.config.ts`).

**Search reads only pre-scraped files — it never synthesizes schedules.** `/api/transit/search` calls `findScrapedResults` ([src/data/scraped/index.ts](src/data/scraped/index.ts)), which loads `src/data/scraped/<country>/*.json` into memory once at boot and matches by **lower-cased origin/destination name**. It falls through: exact → file-origin + result-level destination → reverse (swaps direction) → transfer-chaining (origin→X + X→destination). No match returns 404, not fabricated data.

**The station menu and the scraped data are separate sources that must agree.** The picker ([StationBrowser.tsx](src/components/StationBrowser.tsx)) fetches `/api/transit/stations` and `/api/transit/lines`. `getStationsForCountry` in `server.ts` builds menus from static data (`src/data/stations.ts`, `hongKongMtr.ts`, `metroLines.ts`, `seoulSubway.ts`, `scraped/stations.ts`) for most countries, and **live from the TfL/MBTA APIs** for UK/US. Because search matches by name, a station in the menu that doesn't exactly match a scraped route's name is unreachable — run `scripts/audit-station-mapping.ts` after changing route names in [scripts/scrapers/routes.ts](scripts/scrapers/routes.ts) or any station list.

**Daily scrape pipeline** (`.github/workflows/scrape.yml`, 22:00 UTC = 06:00 Taiwan) runs `npm run scrape`, which scrapes 7 days forward and auto-commits the JSON. `scripts/scrapers/` has three adapter kinds (see [index.ts](scripts/scrapers/index.ts) / [metro.ts](scripts/scrapers/metro.ts)):
- **`BaseScraper`** (Playwright) — Japan, Korea scrape provider sites directly.
- **`SnapshotScraper`** — SG/TH/CN/DE/FR have no live provider; they serve curated JSON snapshots.
- **`ProviderBackedScraper`** — HK/UK/US try a live adapter (`src/server/{hongKongMtr,tfl,mbta}.ts`) and fall back to the snapshot. HK MTR resolves live "next train" via station **codes** in `hongKongMtr.ts` (`findMtrJourney` matches by station name → code, so names must match exactly).

**Scraped-file invariants** (subtle; violating them corrupts data):
- Each route file accumulates **one dated copy of the timetable per scrape date**; the frontend filters results by exact `date`. `BaseScraper.saveRoute` merges by replacing the current date's slice.
- `SnapshotScraper.loadSnapshot` MUST collapse a file back to a single **dateless canonical day** (`canonicalDay` in [snapshot.ts](scripts/scrapers/snapshot.ts), dedupe by date-stripped id) before returning it. Otherwise `saveRoute` re-merges every stored date and rows multiply on every run.
- Result IDs are `${date}-${baseId}`; `canonicalDay`/dedupe strip the `YYYY-MM-DD-` prefix to find the canonical departure.

**i18n / station labels.** [src/i18n.ts](src/i18n.ts) hardcodes `en` + `zh-TW` resources including a curated `station` name dict (this is where e.g. `"Hong Kong": "香港"` lives — NOT `translations.json`, which is the auto-generated TfL/MBTA name file merged in *without* overwriting curated keys). `stationLabel()` ([src/utils/stationLabel.ts](src/utils/stationLabel.ts)) applies per-country overrides from [stationOverrides.ts](src/data/stationOverrides.ts) first, because the flat dict shares one value across countries and some English names collide (e.g. "Central", "City Hall", "Admiralty").

**Result rendering** branches by country in [App.tsx](src/App.tsx): japan/germany/france/china → `JapanResultView`, korea → `KoreaResultView`, hong_kong/singapore/thailand → `MetroResultView`, uk/us → `LiveRailResultView`. All render the journey timeline (including transfer legs) via [TripDetails.tsx](src/components/TripDetails.tsx), which reads `trip.legs` (multi-leg = `direct:false` + `transferStations`) and computes transfer waits from `leg2.departureTime − leg1.arrivalTime`.

## Conventions

- ESM throughout (`"type": "module"`); scripts run via `tsx`.
- `@/` path alias → repo root (see `vite.config.ts`).
- Provider API keys are optional — adapters degrade to anonymous/rate-limited access or snapshot fallback (see `.env.example`).
- The daily scraper commits with `[skip ci]`; the workflow only touches `src/data/scraped/`.
