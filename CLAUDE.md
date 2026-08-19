# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Full app: Express API + Vite middleware (tsx server.ts) on one port
npm run build            # vite build (frontend → dist/) + esbuild bundle server → dist/server.cjs
npm start                # Run the production bundle (node dist/server.cjs)
npm run lint             # tsc --noEmit && vitest run — the gate for every change
npm test                 # vitest run on its own (every *.test.ts under src/, scripts/, api/)

# Scrapers (need Chromium: npx playwright install chromium)
npm run scrape [YYYY-MM-DD]     # Run every country scraper, 7 days forward from date/today
npm run scrape:<country>        # One country, e.g. npm run scrape:japan
npm run scrape:metadata         # Regenerate every src/data/scraped/<country>/metadata.json from files

# Maintenance scripts (run with npx tsx)
npx tsx scripts/audit-station-mapping.ts        # Verify scraper route names match the station menu (0 = clean)
npx tsx scripts/migrate-source-meta.ts          # Backfill the source block on legacy route files
npx tsx scripts/audit-timetable-authenticity.ts # Print the authenticity class of every committed route/date slice
npm run validate:data                           # The eleven daily integrity checks; exit 1 = must not be committed
npm run audit:sources                           # Regenerate SOURCE_COVERAGE.md (per-market source + coverage audit)

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

**A registered official source is the only route to a searchable departure.** [src/data/sourceRegistry.ts](src/data/sourceRegistry.ts) is the register: every source TransitRail may publish from, with its grade (A machine-readable / B official query page / C page or PDF / D first-last-and-headway), its public URL, and the most it can substantiate (`full-timetable` / `frequency-only` / `service-hours`). Every stored route carries a `sourceMeta` block naming its register entry and when it was read, stamped by the scraper kind that fetched it — so the retrieval and the claim cannot drift apart. **A route with no valid block is unusable**, whatever it says about itself: `provenance: "official"` and an official-sounding `source` label are both things a file asserts about itself, and both used to be enough. There is no tier below verified — the per-market "indicative fallback" is gone, and `curated`/`llm-advisory` provenance now marks a legacy file to reject rather than a weaker kind of timetable. Adding an entry to the register is the act of certifying a source; nothing else may introduce one.

**Search reads only pre-scraped files — it never synthesizes schedules.** `/api/transit/search` calls `findScrapedResults` ([src/data/scraped/index.ts](src/data/scraped/index.ts)), which loads `src/data/scraped/<country>/*.json` into memory once at boot and matches by **lower-cased origin/destination name**. It falls through: exact → file-origin + result-level destination → reverse (swaps direction) → transfer-chaining (origin→X + X→destination). No match returns 404, not fabricated data.

**The station menu and the scraped data are separate sources that must agree.** The picker ([StationBrowser.tsx](src/components/StationBrowser.tsx)) fetches `/api/transit/stations` and `/api/transit/lines`. `getStationsForCountry` in `server.ts` builds menus from static data (`src/data/stations.ts`, `hongKongMtr.ts`, `metroLines.ts`, `seoulSubway.ts`, `scraped/stations.ts`) for most countries, and **live from the TfL/MBTA APIs** for UK/US. Because search matches by name, a station in the menu that doesn't exactly match a scraped route's name is unreachable — run `scripts/audit-station-mapping.ts` after changing route names in [scripts/scrapers/routes.ts](scripts/scrapers/routes.ts) or any station list.

**Daily scrape pipeline** (`.github/workflows/scrape.yml`, 22:00 UTC = 06:00 Taiwan) runs `npm run scrape`, then `npm run validate:data -- --against-head`, and only commits if that passes. The eleven checks live in [timetableValidation.ts](scripts/lib/timetableValidation.ts): a `blocking` finding means the run states something false and must not be published; a `warning` means something worth a human's attention that is not a lie. Three are worth knowing about — an unvarying headway across eight or more departures is treated as generated (a real operating day varies), a country losing more than half its rows against `HEAD` is treated as a silently broken parser rather than a schedule change, and a file whose `sourceMeta.sourceId` is not one the country's *currently configured* scrapers fetch from (`source-not-configured`) is a file nothing in the daily run can refresh — the state Singapore sat in for days when its new LTA GTFS source 401'd on every run and the kept SMRT-era file made the market read as legitimately frequency-only. A failed run leaves the previously committed data in place. `scripts/scrapers/` has three adapter kinds (see [index.ts](scripts/scrapers/index.ts) / [metro.ts](scripts/scrapers/metro.ts)):
- **`BaseScraper`** (Playwright) — the base class the others extend; it owns `saveRoute` and the per-date merge. No country runs a bare Playwright scrape any more.
- **`DownloadScraper`** (tier A) — an official machine-readable feed: GTFS, CSV, XML, JSON, or a published download. `OfficialFeedScraper` is the common subclass wrapping one query function (HK/UK/US/DE/FR/BE/NO/CH/MY/SG). Singapore's LTA adapter resolves a 15-minute signed archive link from DataMall's key-protected GTFS endpoint — the key-free static ZIP is a frozen copy of one such response and its link is long expired, so it can only ever 403. HK MTR resolves live "next train" via station **codes** in `hongKongMtr.ts` (`findMtrJourney` matches by station name → code, so names must match exactly).
- **`BrowserScraper`** (tier B) — an official query page driven with Playwright. `UnitedKingdomScraper` (TfL Journey Planner) and `UnitedStatesBrowserScraper` (MBTA trip planner) both extend it; each samples points across the operating day rather than trusting one query, and preserves the previous file on a navigation failure.
- **`HtmlScraper`** (tier C) — an official page fetched and parsed (JR Central's timetable search).
- **`PdfScraper`** (tier C) — an official PDF timetable. Nothing uses it yet.
- **`FrequencyScraper`** (tier D) — Thailand, whose BEM source publishes first train, last train and headway and no departure list. Singapore's SMRT first/last-time API is advisory only and feeds the service-day artifact, never departures.
- There is deliberately no kind for an aggregator or an estimate. **A route with no registered source gets no departures**, and search says `No verified timetable available.`
- Malaysia uses the official KTMB GTFS timetable scraper. Its historical ridership catalog is still refreshed as an auxiliary station source, but searchable stations and departures come from the verified GTFS snapshots.

**Whether a provider can answer a future date is the thing that matters**, and it is not the same question as whether it is live. Hong Kong's MTR feed answers "the next four trains" and nothing about any other date, so `liveOnly: true` and future dates get **no departure rows at all** — the official first/last per direction goes to `src/data/service-day/hong_kong.json` instead, which is what a future service day can honestly say. London's TfL journey planner does answer future dates from the published schedule, so it is `liveOnly: false` over 7 days and `searchTflServiceDay` samples the operating day (one query returns only the journeys near one time, which is why a single call per date used to look like a live snapshot stamped on seven dates). Do not copy one market's shape onto the other.

The authoritative per-country mapping is the single `countryConfig` table in [src/data/countries.ts](src/data/countries.ts) (`scrape` + `search` fields) — read it rather than trusting this summary, and update this summary when you change it.

**Scraped-file invariants** (subtle; violating them corrupts data):
- Each route file accumulates **one dated copy of the timetable per scrape date**; the frontend filters results by exact `date`. `BaseScraper.saveRoute` merges by replacing the current date's slice.
- A route that **fails keeps its previously committed file**. `BaseScraper` never substitutes anything for a failed fetch: yesterday's real timetable, stamped with yesterday's fetch time, is a better answer than anything this process could invent, and a far better one than an empty file reading as "no service today".
- Only rows carrying the passenger's **exact service date** may answer for it. Dateless "canonical day" rows are no longer written or accepted; that mechanism is how one representative timetable came to answer for seven dates.
- Result IDs are `${date}-${baseId}`; `canonicalDay` strips the `YYYY-MM-DD-` prefix to find the canonical departure. `dedupeScrapedResults` ([merge.ts](scripts/scrapers/merge.ts)) is a *separate* axis — it collapses provider rows that repeat the same departure under different ids, which is what inflated MBTA's Saturday slice. Do not merge the two.
- The picker's date range and the scrape window are one fact: file-backed markets set `dateRangeDays: SCRAPE_WINDOW_DAYS` ([countries.ts](src/data/countries.ts)), which `scripts/scrape-all.ts` also imports. They were once written separately and the picker offered 14 days against 7 days of data, so the second week answered "no service" for dates the user had just been invited to pick. A market whose provider answers arbitrary dates live is not bound by this.

**Station directories are not timetable sources.** Singapore's MRT/LRT map is cached in `src/data/catalog/singapore.json` by `npm run sync:singapore-stations` ([scripts/sync-singapore-stations.ts](scripts/sync-singapore-stations.ts)) — line and station order from mytransport.sg's official XML, plus zh-TW/ja/ko labels from Wikipedia langlinks. Wikipedia is admissible here and nowhere else: a station *name* is not a departure claim, and nothing in this file can put a train on the board. It is a deliberate, reviewable update step, never part of the nightly run, and the labels are normalized on the way in (article titles carry a station word and a disambiguation suffix that the curated dictionaries omit).

**i18n / station labels.** [src/i18n.ts](src/i18n.ts) hardcodes `en` + `zh-TW` resources including a curated `station` name dict (this is where e.g. `"Hong Kong": "香港"` lives — NOT `translations.json`, which is the auto-generated TfL/MBTA name file merged in *without* overwriting curated keys). `stationLabel()` ([src/utils/stationLabel.ts](src/utils/stationLabel.ts)) applies per-country overrides from [stationOverrides.ts](src/data/stationOverrides.ts) first, because the flat dict shares one value across countries and some English names collide (e.g. "Central", "City Hall", "Admiralty").

**Prerendered SEO route pages.** `scripts/generate-route-pages.ts` (build step) emits a static HTML page per scraped route file in every locale of `PRERENDER_LOCALES` — EN unprefixed at `/<country>/<origin>-to-<dest>/`, the rest under their prefix (`/zh/`, `/ja/`, `/ko/`, `/fr/`, `/de/`) — plus `/routes/` and per-country hub pages. That list, the locale URL prefixes, hreflang values, route enumeration, slugs, and the thin-content guard (≥3 canonical-day departures) all live in [scripts/lib/routePages.ts](scripts/lib/routePages.ts), shared with `generate-sitemaps.ts` so pages and `sitemaps/routes.xml` never disagree — **add a locale there, not in the generator**. Output dirs are gitignored and wiped on every run — never hand-place files under `public/<country>/`, `public/{zh,ja,ko,fr,de}/`, `public/routes/`, or `public/og-routes/`. Vercel serves these static files before the SPA catch-all rewrite; in dev, `server.ts` mounts `express.static("public", { index, redirect:false })` ahead of Vite to mirror that.

**Publication is held to the same bar as search.** A page is a durable, indexable claim about a departure time, so `collectRoutePages` publishes only routes whose selected day the policy calls `verified` — the 39 curated route files that used to fill most of the catalogue are gone, and `REMOVED_ROUTE_SLUGS` in [generate-url-redirects.ts](scripts/generate-url-redirects.ts) 301s their old six-locale URLs to `/routes/`. `RoutePageData.indicative` now means "this source publishes a service window rather than departure times"; no market reaches the minimum-departures gate that way yet, so the rendering path is unused. Titles go through `buildTitle()`, which fits a 60-half-width budget (`displayWidth()` counts CJK double) so Google does not truncate them; `tidyStationName()` strips operator codes and TfL's network suffix from **both** slugs and display labels (`Seoul (SNC)` → `Seoul`, `Oxford Circus Underground Station` → `Oxford Circus`), while search keys, the station menu and schema `alternateName` keep the raw name — so tidying can never make a station unreachable.

**Changing a slug means committing a redirect.** Vercel resolves `vercel.json` before the build, so Express never sees a stale route URL — it falls through to the SPA catch-all as a soft 404. `npm run redirects` ([scripts/generate-url-redirects.ts](scripts/generate-url-redirects.ts)) derives the legacy slug from the untidied station name and writes a 301 per prerender locale into `vercel.json`. It is deliberately **not** in `npm run build` (a build-time edit would land too late to affect routing) — run it by hand after touching `tidyStationName` or `slugifyStation`, and commit the result. It owns every redirect under a country path and leaves the hand-written `/sitemap*` ones alone.

**Result rendering** branches by country in [App.tsx](src/App.tsx): japan/germany/france/china → `JapanResultView`, korea → `KoreaResultView`, hong_kong/singapore/thailand → `MetroResultView`, uk/us → `LiveRailResultView`. All render the journey timeline (including transfer legs) via [TripDetails.tsx](src/components/TripDetails.tsx), which reads `trip.legs` (multi-leg = `direct:false` + `transferStations`) and computes transfer waits from `leg2.departureTime − leg1.arrivalTime`.

## Conventions

- ESM throughout (`"type": "module"`); scripts run via `tsx`.
- `@/` path alias → repo root (see `vite.config.ts`).
- Provider API keys are optional — adapters degrade to anonymous/rate-limited access, or the route keeps its previously committed file (see `.env.example`).
- The daily scraper commits with `[skip ci]`; the workflow only touches `src/data/scraped/`.
