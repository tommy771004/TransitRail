# i18n and publication

The hard rules in [CLAUDE.md](../../CLAUDE.md) govern everything here; this file carries the
sourcing chain and the task-specific rules behind them.

## Station labels

Generated translations must not overwrite curated keys. Display goes through `stationLabel()` and
the country overrides; the raw provider name stays the query identity.

zh-TW, ja and ko labels are sourced, never transliterated by us.
`scripts/sync-station-translations.ts` reads the market's own station directory and takes the label
from the station's Wikipedia article title, then an operator-published name, then the Wikidata
label. Chinese from any of those goes through MediaWiki's `zh-tw` variant conversion, so a
Simplified source ships Traditional.

A station no source answers for gets **no entry** and keeps the operator's own name — that is the
correct display, not a gap to fill by inventing one.

Provenance per label lives in `src/data/catalog/station-i18n/<market>.json`; `labels.json` in the
same directory is generated from those artifacts and must never be hand-edited.

## SEO and route pages

SEO locale, slug, and route-page rules live in `scripts/lib/routePages.ts`. `npm run redirects` is
not part of `npm run build`, so a slug change needs it run by hand and committed with `vercel.json`.
