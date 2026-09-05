# Japan review follow-up — 2026-09-05

## Changes

- Added four locale labels and the Kotoden catalog region integration assertion. The integration date is shared by all Japanese sources, because their refresh windows may differ.
- Kept constant-headway detection. Registered full official timetables produce a warning; missing or contradictory provenance remains blocking. The unchanged operator archive and regression live in `scripts/lib/fixtures`.
- Collect actual GTFS trip endpoint pairs, including short turns. Store each train under its own endpoints to avoid copying full trains into short-turn snapshots.
- Merge exact snapshots and timed spans before returning. Transfer deduplication includes the ordered legs and their times; duplicated snapshots no longer erase alternate transfer stations.
- Station mapping audit uses the runtime station catalog contract.
- Lazy-load market snapshots so a request does not parse unrelated markets. Route graph construction processes each calling pattern once and indexes outgoing edges by station.
- Seoul's small artifact fixture is now a worker-local read override, eliminating concurrent writes to the committed artifact.

## Measured limits

Local cold-process measurements using Node/tsx, one run each, after the Kotoden refresh:

| Market | Load | Process RSS | Used JS heap |
| --- | ---: | ---: | ---: |
| Japan | 361 ms | 295 MiB | 143 MiB |
| Korea | 809 ms | 187 MiB | 72 MiB |

Japan JSON files total 122.10 MiB. A subsequent 高松築港 → 瓦町 search on 2026-09-05 returned 101 departures in 158 ms. These are local development measurements, not Vercel capacity or cold-start guarantees. Lazy loading avoids Japan's cost on other-market requests; it does not compact Japan's repeated ODPT objects. Production resource headroom still needs measurement in the deployment environment.

## Remaining operational work

Only Kotoden was refreshed in this repair. Its window is 2026-09-05–2026-09-13. The other eight markets reported by `scrape:plan` still stop at 2026-09-07 while the picker offers through 2026-09-11. Japan's ODPT/JR sources also retain their prior window: the market-level planner now sees Kotoden's newer dates, which must not be read as all Japanese routes being covered. A complete source refresh remains necessary.

No publish, deploy, commit, push or notifications were performed. CI's data-first partial-success semantics were not changed: later catalog/audit failures can still leave derived artifacts and notifications pending. Sanyo's sampled coverage remains sampled; source-level trip collection does not establish completeness across the entire Japanese rail network.

## Final checks

`npm run lint`, `npm run build`, `npm run validate:data` and the station mapping audit passed. Validation reports 17 constant-headway warnings and zero blocking findings; mapping reports zero endpoint mismatches. Build still reports the existing large frontend chunk and CJS/import.meta warnings. Unrelated generated catalog/sitemap churn was restored after build; Japan's generated catalog and metadata are retained.
