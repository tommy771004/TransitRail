# Timetable data sources — status and outstanding work

> **Superseded, kept as the record of why.** The generated and curated
> timetables this document catalogues have been removed, so its "current state"
> tables and remediation plans describe a pipeline that no longer exists. For
> what each market can answer *today*, read the generated
> [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md) (`npm run audit:sources`); for the
> rules that replaced them, read the source-register section of
> [CLAUDE.md](CLAUDE.md) and [src/data/sourceRegistry.ts](src/data/sourceRegistry.ts).
>
> What remains valuable here is the diagnosis: how the generated data got in,
> what it looked like, and what it cost. Sections 2 onward are still the best
> written account of the per-operator obstacles (Korail's bot blocking, 12306,
> the JR East/West licensing position), and remain the starting point for anyone
> wiring up one of the sources listed as a gap in SOURCE_COVERAGE.md.

Where every route's departures came from before the official-sources refactor,
what was fabricated, and what it would take to fix each one. Companion to
[SERVICE_DAY_SOURCES.md](SERVICE_DAY_SOURCES.md), which covers the first/last
train advisory rather than the timetable itself.

Written after a Google Search Console review found 1,067 impressions and 1 click
over 7 days. Ranking was not the constraint — a CTR curve applied to the
per-page positions predicted ~16 clicks. The pages were losing the click in the
result itself, and the largest cause was that most timetables were generated
rather than fetched.

## Why this matters beyond correctness

`isIndicativeTimetable()` ([scripts/lib/routePages.ts](scripts/lib/routePages.ts))
flags any route whose data is a curated snapshot. Those pages deliberately give
up SEO surface: a service window instead of first/last train times, no
`TrainTrip` structured data, and a notice telling the reader to check with the
operator. Converting a country from snapshot to live therefore does three things
at once — the data becomes true, the page regains its rich content, and the
disclaimer disappears.

## Current state

78 route pages, **56 of them still indicative**.

| Country | Adapter | Pages | Indicative | Timetable source today |
|---|---|---|---|---|
| belgium | `ProviderBacked` | 5 | 0 | live — `api.irail.be` |
| norway | `ProviderBacked` | 5 | 0 | live — `api.entur.io` |
| france | `ProviderBacked` | 3 | 1 | live — SNCF Open Data GTFS (1 route still falling back) |
| united_kingdom | `ProviderBacked` | 4 | 1 | live — `api.tfl.gov.uk` (1 route fixed, awaiting scrape) |
| united_states | `ProviderBacked` | 4 | 1 | live — `api-v3.mbta.com` (1 route fixed, awaiting scrape) |
| hong_kong | `ProviderBacked` | 4 | 4 | live for **today only**, snapshot for days 1–6 |
| switzerland | `ProviderBacked` | 5 | 5 → 0 after next scrape | live — official Swiss GTFS Static download; OJP remains optional for realtime |
| japan | `BaseScraper` | 23 | 23 | **generated in code** |
| korea | `Snapshot` | 9 | 9 | **generated**, re-stamped from committed JSON |
| china | `Snapshot` | 4 | 4 | **generated** |
| germany | `ProviderBacked` | 4 | 0 | live — `download.gtfs.de` long-distance rail GTFS |
| singapore | `Snapshot` | 4 | 4 | **generated** |
| thailand | `Snapshot` | 4 | 4 | **generated** |

### How to read "generated"

`SnapshotScraper.loadSnapshot()` ([scripts/scrapers/snapshot.ts](scripts/scrapers/snapshot.ts))
reads `src/data/scraped/<country>/*.json` — its own previous output — collapses it
to a canonical day, stamps today's date on it and writes it back. The daily job
runs and commits, but for these countries no network request is made at all. A
day's diff is pure date and id re-stamping.

Japan is worse: `JapanScraper.buildTimetable()`
([scripts/scrapers/japan.ts](scripts/scrapers/japan.ts)) is a `for` loop from
`SERVICE_START = 6*60` to `SERVICE_END = 22*60` stepping `HEADWAY = 30`, with
duration and fare from a `ROUTE_INFO` constant table. That produces the 33- and
97-departure signatures shared across 37 route files.

Timetable fetching itself does not launch Chromium: `usesBrowser` is `false` in
both [japan.ts](scripts/scrapers/japan.ts) and
[snapshot.ts](scripts/scrapers/snapshot.ts). The workflow still installs
Chromium because `ThailandScraper.runAll()` uses it separately to refresh the
BEM service-day advisory.

---

## 1. Awaiting the next scheduled scrape — no work needed

Four fixes are merged but reach the site through data, so they take effect at the
next 22:00 UTC run. Verify from the job log, which now prints every fallback
reason to stdout (`recordError` in [src/server/errorLog.ts](src/server/errorLog.ts)).

| Expected change | Route | Confirms |
|---|---|---|
| `service` becomes `TGV 6607`, not `601A` | France, all | `route_type` + `trip_headsign` labelling |
| Strasbourg gets real departures | `paris-gare-de-l-est-strasbourg` | token-subset station matching |
| Marseille page returns | `paris-gare-de-lyon-marseille-st-charles` | `St`/`Saint` normalisation |
| Two routes go live | `paddington-station-liverpool-street-station`, `harvard-logan-international-airport` | TfL suffix retry, MBTA alias |

The fallback log should shrink from four causes to one — Hong Kong's structural
limit — after the next scheduled scrape.

**Marseille currently has no page.** The live run extracted 1–2 departures a day
against a real ~15, which tripped the `MIN_DAILY_RESULTS = 3` guard. The fix is
merged; until the scrape re-extracts, that URL has no page.

Files: [src/server/franceGtfs.ts](src/server/franceGtfs.ts),
[src/server/tfl.ts](src/server/tfl.ts), [src/server/mbta.ts](src/server/mbta.ts),
[src/server/gtfsZipFixture.ts](src/server/gtfsZipFixture.ts).

---

## 2. Switzerland — static timetable is now available without API access

### Switzerland (5 routes) — highest return for the least work

The five Swiss routes now use the official nationwide GTFS Static ZIP from the
[OpenTransportData Swiss timetable catalog](https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020).
The public catalog exposes the current download without an API token, so the
scraper can refresh scheduled departures even when OJP access is not subscribed.
The [GTFS timetable documentation](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/)
describes the static format and its update cadence:

`src/server/swissGtfs.ts` discovers the newest ZIP from the catalog, streams the
large `stop_times.txt` entry incrementally, and prepares all configured routes in
one pass. `ProviderBackedScraper` still retains the existing snapshot fallback if
the catalog or download is unavailable.

OJP remains useful for realtime and disruption data, but is not required for the
scheduled timetable:

```
Swiss OJP returned HTTP 403. {"error": "Access to this API has been disallowed"}
```

opentransportdata.swiss grants access **per API, not per account**. The key needs
OJP 2.0 added to its subscription in the developer portal.

Endpoint verified correct: `SWISS_OJP_URL` in `.env.example` is
`https://api.opentransportdata.swiss/ojp20`, identical to the default in
[src/server/swiss.ts](src/server/swiss.ts). A wrong URL would 404, not 403.

Only `SWISS_OJP_TOKEN` is read for OJP today. `SWISS_OJP_FARE_*`, `SWISS_SIRI_*`,
`SWISS_FORMATION_*` and `SWISS_TRANSPORT_TOKEN` have **zero references** in the
codebase — they are labelled reserved, and setting them has no effect yet. Each
is a separate API needing its own subscription.

Files: [src/server/swissGtfs.ts](src/server/swissGtfs.ts), [src/server/swiss.ts](src/server/swiss.ts),
[.github/workflows/scrape.yml](.github/workflows/scrape.yml), `.env.example`.

### Domain

`SITE_URL` is already environment-driven, so the code is ready. Moving off
`*.vercel.app` needs domain registration, a Vercel binding, and a GSC address
change. `*.vercel.app` is on the Public Suffix List, so the site inherits no
authority from the parent domain, and the SERP shows that subdomain against
SNCF, Korail, Trainline and Google's own transit box.

---

## 3. Hong Kong — no bug to fix

`hongKongMtr.ts:91` guards on `date !== dateInHongKong()`. MTR's Next Train feed
is a live departure board; it cannot answer for a future date, and the scrape
runs 7 days forward, so days 1–6 fall back by design. Day 0 genuinely works —
its rows carry a fetch timestamp in the id and `trainType: "Next train"`.

Two things could change this, neither trivial:

- **Render day 0 instead of day 6.** `canonicalDaySlice()`
  ([scripts/lib/routePages.ts](scripts/lib/routePages.ts)) takes
  `dates[dates.length - 1]`, the furthest future date and so the most likely to
  be a fallback. Day 0 has ~4 live rows against the snapshot's 350, so this
  trades volume for truth — probably not worth it.
- **Find a real MTR timetable source.** The Next Train API is the only free one.

---

## 4. Still fabricated — 43 routes across 5 countries

Ordered by feasibility. Each entry lists what is missing before code can be
written; none of it can be verified from the dev sandbox, whose proxy blocks all
provider hosts (`CONNECT tunnel failed, 403`).

### Completed: Germany (4 routes)

Germany now uses gtfs.de's free long-distance rail feed at
`https://download.gtfs.de/germany/fv_free/latest.zip`, published from DELFI
source data under CC BY 4.0. The adapter keeps curated snapshot fallback through
`ProviderBackedScraper`.

The France parser was split into shared modules so subsequent GTFS countries are
configuration rather than copied parsers:

```
src/server/gtfs/feed.ts        zip + CSV + calendar
src/server/gtfs/journeys.ts    collectGtfsJourneys() + station matching
src/server/gtfs/timetable.ts   → TransitResult[], parameterised by operator/brand map
src/server/franceGtfs.ts       keeps the advisory + France specifics
src/server/germanyGtfs.ts      URL + service labels + German station aliases
src/server/swissGtfs.ts         catalog discovery + one-pass nationwide feed scan
```

The Germany profile explicitly maps the route list's English names to the feed's
German names (`Munich`→`München`, `Cologne`→`Köln`,
`Frankfurt Hbf`→`Frankfurt(Main)Hbf`). Offline fixtures cover weekly calendars,
cross-midnight service and those aliases; a live integration check on 2026-08-03
returned departures for all four configured routes.

Files: [scripts/scrapers/routes.ts](scripts/scrapers/routes.ts) (`germanyRoutes`,
line 77), [scripts/scrapers/metro.ts](scripts/scrapers/metro.ts) (`GermanyScraper`),
[scripts/scrapers/registry.ts](scripts/scrapers/registry.ts),
[src/server/germanyGtfs.ts](src/server/germanyGtfs.ts).

### 4a. Korea (9 routes) — largest indicative country after Japan

Korail has an open API through data.go.kr, requiring registration and a service
key. `KoreaScraper` currently extends `SnapshotScraper` despite CLAUDE.md
describing it as a Playwright scraper — it has never fetched anything.

**Blocked on:** a service key, plus confirmation of which Korail endpoint covers
KTX timetables.

Files: [scripts/scrapers/korea.ts](scripts/scrapers/korea.ts),
`koreaRoutes` ([scripts/scrapers/routes.ts](scripts/scrapers/routes.ts) line 30).
Note the station names carry codes (`Seoul (SNC)`, `Busan (BSN)`) that
`tidyStationName()` strips for display and slugs — a real adapter will likely need
its own station id mapping.

### 4b. Singapore (4 routes)

LTA DataMall offers train service data behind a free API key. Its value is train
*disruptions* more than timetables; MRT runs on headways rather than a published
per-departure schedule, so the honest end state may be a genuine frequency page
rather than a departure list — which is close to what the indicative rendering
already does.

**Blocked on:** an LTA DataMall key, and a decision on whether a headway-based
page is the goal.

Files: `singaporeRoutes` (line 42), `SingaporeScraper` in
[scripts/scrapers/metro.ts](scripts/scrapers/metro.ts).

### 4c. Japan (23 routes) — biggest and hardest

No usable free timetable API. The previous Jorudan DOM scraper never produced
rows and was removed. Options, all costly:

- JR's own reservation sites are hostile to scraping and lack stable markup
- Commercial APIs (NAVITIME, Ekispert) are paid
- GTFS-JP exists but coverage of Shinkansen operators is patchy

**Recommendation:** keep these indicative. The pages are honest about it, and the
23 pages are the reason the indicative rendering had to be built well.

Files: [scripts/scrapers/japan.ts](scripts/scrapers/japan.ts) (`ROUTE_INFO`,
`buildTimetable`).

### 4d. China (4 routes) and Thailand (4 routes)

12306 has no public API and actively blocks automation. BTS/MRT publish no
per-departure feed; Thailand already scrapes BEM's HTML for the service-day
advisory only ([src/server/thailandBem.ts](src/server/thailandBem.ts)).

**Recommendation:** keep indicative. Thailand is a metro network on headways, so
the frequency rendering is arguably the correct presentation anyway.

---

## Verification without network access

The dev sandbox reaches npm, GitHub and Anthropic only. Everything else is
`CONNECT tunnel failed, 403`, including the deployed site. Consequences for
anyone continuing this work:

- **Provider adapters cannot be tested live here.** Build against a fixture and
  let the scheduled run be the integration test. The GTFS fixture in
  [src/server/gtfsZipFixture.ts](src/server/gtfsZipFixture.ts) is a real zip built
  in memory, covering a midnight-crossing service, a date-cancelled trip, a
  date-added trip, operator-spelled station names, and `route_type`.
- **Fixtures drift from reality.** The original version asserted
  `route_short_name` was `"TGV INOUI"`; the real feed returns `"601A"`. Tests
  passed and production was wrong. When a live run contradicts a fixture, fix the
  fixture.
- **The site can still be exercised locally.** `npm run build && node dist/server.cjs`
  serves the same code and data. Crawling every sitemap URL that way is what
  found the Malaysia soft 404s. What it cannot cover is Vercel's edge layer — the
  66 committed 301s in `vercel.json` are resolved before the build, so Express
  never sees those paths.
- **The committed station catalogues are evidence.** `public/catalog/*.json` holds
  each provider's own station names. That is how the TfL and MBTA failures were
  diagnosed without a single request.

## File map

| Concern | File |
|---|---|
| Which countries scrape, and how | [scripts/scrapers/registry.ts](scripts/scrapers/registry.ts), [src/data/countryCapability.ts](src/data/countryCapability.ts) |
| Route lists per country | [scripts/scrapers/routes.ts](scripts/scrapers/routes.ts) |
| Adapter base, date merge, id stamping | [scripts/scrapers/base.ts](scripts/scrapers/base.ts) |
| Snapshot + provider-with-fallback | [scripts/scrapers/snapshot.ts](scripts/scrapers/snapshot.ts) |
| Per-country scraper classes | [scripts/scrapers/metro.ts](scripts/scrapers/metro.ts), [japan.ts](scripts/scrapers/japan.ts), [korea.ts](scripts/scrapers/korea.ts) |
| Provider adapters | `src/server/{tfl,mbta,swiss,belgium,norway,hongKongMtr,franceGtfs,germanyGtfs,thailandBem}.ts` |
| Indicative detection, slugs, locales | [scripts/lib/routePages.ts](scripts/lib/routePages.ts) |
| Page rendering, titles, schema | [scripts/generate-route-pages.ts](scripts/generate-route-pages.ts) |
| Sitemap, hreflang alternates | [src/server/sitemapXml.ts](src/server/sitemapXml.ts) |
| Redirects after a slug change | [scripts/generate-url-redirects.ts](scripts/generate-url-redirects.ts) |
| Fallback diagnostics to stdout | [src/server/errorLog.ts](src/server/errorLog.ts) |
| Daily job | [.github/workflows/scrape.yml](.github/workflows/scrape.yml) |

## Invariants worth not breaking

- A curated snapshot must never render first/last train times or emit
  `TrainTrip` schema. See the indicative rules in [CLAUDE.md](CLAUDE.md).
- Station display tidying must not change search keys. `tidyStationName()`
  affects slugs and labels; `findScrapedResults` matches raw names, and
  `scripts/audit-station-mapping.ts` must stay at 0 mismatches.
- Changing a slug means running `npm run redirects` and committing `vercel.json`.
  It is deliberately outside `npm run build`.
- The sitemap and the page generator must agree. [sitemapCoverage.test.ts](src/server/sitemapCoverage.test.ts) locks
  this from both sides after country hubs drifted apart.
- A new service-day suite must use `serviceDayArtifactFixture()` rather than
  deleting the tracked artifact.
