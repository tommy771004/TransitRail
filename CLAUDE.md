# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Full app: Express API + Vite middleware (tsx server.ts) on one port
npm run build            # vite build (frontend → dist/) + esbuild bundle server → dist/server.cjs
npm start                # Run the production bundle (node dist/server.cjs)
npm run lint             # tsc --noEmit && vitest run — the gate for every change
npm test                 # vitest run on its own (15 files, 86 tests)

# Scrapers (need Chromium: npx playwright install chromium)
npm run scrape [YYYY-MM-DD]     # Run every country scraper, 7 days forward from date/today
npm run scrape:<country>        # One country, e.g. npm run scrape:japan
npm run scrape:metadata         # Regenerate every src/data/scraped/<country>/metadata.json from files

# Maintenance scripts (run with npx tsx)
npx tsx scripts/audit-station-mapping.ts    # Verify scraper route names match the station menu (0 = clean)
npx tsx scripts/seed-curated-snapshots.ts   # De-dupe + (re)seed curated snapshot timetables

# SEO artifacts (both also run inside npm run build)
npm run routes           # Prerender static route pages in 6 locales → public/[<locale>/]<country>/<o>-to-<d>/ + /routes/ hubs
npm run sitemap          # Regenerate sitemap index (core + countries + routes.xml); run AFTER npm run routes
npm run redirects        # Refresh vercel.json 301s after a slug change; NOT part of the build (see below)
```

`npm run lint` (typecheck + Vitest) is the gate. Verify data changes by importing `findScrapedResults` from `src/data/scraped` in a `npx tsx -e '...'` snippet.

The France/Thailand advisory suites need "no artifact on disk" as a starting state, but `src/data/service-day/<country>.json` is committed. They go through `serviceDayArtifactFixture()` ([src/server/serviceDayArtifactFixture.ts](src/server/serviceDayArtifactFixture.ts)), which stashes the tracked file for the suite and restores it in `afterAll` — **any new service-day suite must use it too**. Deleting the artifact outright (as these once did) leaves the working tree dirty and makes the suite pass only because an earlier run already removed the file, so a clean checkout fails.

## Architecture

A mobile-first cross-border transit timetable search app: React 19 SPA + a single Express server that also serves the API.

**One server, two deploy targets.** `server.ts` builds and exports an Express `app`. In dev it mounts Vite as middleware (whole app on one port). `api/index.ts` re-exports `app` as a Vercel serverless function (`vercel.json` routes `/api/*` there, everything else to the SPA). The app also runs on Google AI Studio (hence `APP_URL` and the `DISABLE_HMR` handling in `vite.config.ts`).

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

**Prerendered SEO route pages.** `scripts/generate-route-pages.ts` (build step) emits a static HTML page per scraped route file in every locale of `PRERENDER_LOCALES` — EN unprefixed at `/<country>/<origin>-to-<dest>/`, the rest under their prefix (`/zh/`, `/ja/`, `/ko/`, `/fr/`, `/de/`) — plus `/routes/` and per-country hub pages. That list, the locale URL prefixes, hreflang values, route enumeration, slugs, and the thin-content guard (≥3 canonical-day departures) all live in [scripts/lib/routePages.ts](scripts/lib/routePages.ts), shared with `generate-sitemaps.ts` so pages and `sitemaps/routes.xml` never disagree — **add a locale there, not in the generator**. Output dirs are gitignored and wiped on every run — never hand-place files under `public/<country>/`, `public/{zh,ja,ko,fr,de}/`, `public/routes/`, or `public/og-routes/`. Vercel serves these static files before the SPA catch-all rewrite; in dev, `server.ts` mounts `express.static("public", { index, redirect:false })` ahead of Vite to mirror that.

**Curated snapshots must not be presented as real timetables.** 63 of 79 route files are `SnapshotScraper` output: a representative service pattern on a fixed headway, with one duration and fare repeated across every departure. `isIndicativeTimetable()` (routePages.ts) flags them onto `RoutePageData.indicative`, and those pages render a service window + frequency instead of first/last-train claims, carry a notice naming the operator to verify with, answer the FAQ as a window, and **emit no `TrainTrip` structured data** — publishing invented departure times as schema.org feeds them to every consumer that trusts it. Only genuinely scraped routes (TfL, MBTA, iRail, Entur) get departure-level schema. Titles go through `buildTitle()`, which fits a 60-half-width budget (`displayWidth()` counts CJK double) so Google does not truncate them; `tidyStationName()` strips operator codes and TfL's network suffix from **both** slugs and display labels (`Seoul (SNC)` → `Seoul`, `Oxford Circus Underground Station` → `Oxford Circus`), while search keys, the station menu and schema `alternateName` keep the raw name — so tidying can never make a station unreachable.

**Changing a slug means committing a redirect.** Vercel resolves `vercel.json` before the build, so Express never sees a stale route URL — it falls through to the SPA catch-all as a soft 404. `npm run redirects` ([scripts/generate-url-redirects.ts](scripts/generate-url-redirects.ts)) derives the legacy slug from the untidied station name and writes a 301 per prerender locale into `vercel.json`. It is deliberately **not** in `npm run build` (a build-time edit would land too late to affect routing) — run it by hand after touching `tidyStationName` or `slugifyStation`, and commit the result. It owns every redirect under a country path and leaves the hand-written `/sitemap*` ones alone.

**Result rendering** branches by country in [App.tsx](src/App.tsx): japan/germany/france/china → `JapanResultView`, korea → `KoreaResultView`, hong_kong/singapore/thailand → `MetroResultView`, uk/us → `LiveRailResultView`. All render the journey timeline (including transfer legs) via [TripDetails.tsx](src/components/TripDetails.tsx), which reads `trip.legs` (multi-leg = `direct:false` + `transferStations`) and computes transfer waits from `leg2.departureTime − leg1.arrivalTime`.

## Conventions

- ESM throughout (`"type": "module"`); scripts run via `tsx`.
- `@/` path alias → repo root (see `vite.config.ts`).
- Provider API keys are optional — adapters degrade to anonymous/rate-limited access or snapshot fallback (see `.env.example`).
- The daily scraper commits with `[skip ci]`; the workflow only touches `src/data/scraped/`.
