# Commands

Commands an agent reaches for most often; `package.json` is the complete list. `npm run lint`
(typecheck + all Vitest tests) is the required gate for every change; the rest are task-specific.

```bash
npm run dev                         # Express + Vite
npm run build                       # Frontend and server bundle
npm run lint                        # Typecheck + all Vitest tests; required gate
npm test                            # Tests only
npm run check:ui                    # Material 3 browser smoke check
```

## Scraping

```bash
npm run scrape [YYYY-MM-DD]         # All markets, SCRAPE_WINDOW_DAYS forward
npm run scrape -- --live-only       # Only markets whose source answers for today (HK, TH)
npm run scrape:<country>            # One market, same window as the nightly run
npm run scrape:plan                 # Print tonight's pass: full | live-only
npm run prune:past                  # Drop rows for service days that have passed
```

## Generated catalog

```bash
npm run catalog                     # Static station catalog; first step of `npm run build`
                                    # and its own step in the nightly workflow
```

## Data integrity

```bash
npm run validate:data               # Data integrity gate; run for timetable changes
npm run audit:sources               # Refresh source coverage
tsx scripts/audit-station-mapping.ts  # Run after changing routes or station lists
```

## SEO pages

```bash
npm run routes && npm run sitemap   # Regenerate SEO pages, then sitemaps
npm run redirects                   # Required after route-slug changes; not part of build
npm run brand:fonts                 # Re-subset assets/fonts/og/ when `routes` warns a card font lacks a glyph
npm run brand:assets                # Re-render favicons, app icons and og-image.png from assets/brand/
```

`npm run routes` also renders each route page's 1200×630 social card to `public/og-routes/`
(gitignored, rebuilt every build). A page whose station names need a glyph outside the committed
font subsets falls back to the site card `/og-image.png` with a warning; re-sourcing station
labels can trigger this, so run `brand:fonts` afterwards and commit `assets/fonts/og/`.

## Station i18n

```bash
npm run sync:station-i18n <market>  # Re-source zh-TW/ja/ko station labels
npm run audit:station-i18n          # Per-market station label coverage
```
