# 05 — Report timetable completeness as of fetch time

**What to build:** Add the second audit axis that tells maintainers how much of the current service day the acquired data can substantiate as of its recorded fetch or check time. Verified rows must remain distinguishable from a complete timetable: bounded upcoming trains and sampled service days are honest but partial.

**Blocked by:** 04 — Report market-scoped current-day network coverage.

**Status:** ready-for-agent

- [ ] The audit classifies full timetable, sampled service day, bounded upcoming slice, frequency/service-hours only, catalog only, stale, and unavailable as distinct temporal states.
- [ ] Every temporal verdict includes the relevant market-local service date and available fetch/check timestamp.
- [ ] Source capability, registered completeness, stored source metadata, service-day artifacts, and observed returned time span inform the verdict; official provenance alone never implies a full day.
- [ ] A next-four-trains feed is reported as verified but temporally partial.
- [ ] The Hong Kong baseline is classified as bounded upcoming service rather than full-timetable coverage without hardcoding volatile row counts or dates.
- [ ] Sampled journey-planner days remain identified as sampled rather than silently promoted to complete schedules.
- [ ] Frequency-only, catalog-only, and no-source markets retain their honest non-departure states.
- [ ] The temporal verdict appears beside, and does not overwrite, the independent network-coverage verdict.
- [ ] Audit generation is deterministic from local metadata and artifacts and does not fetch each provider again.
- [ ] Tests use injected timestamps to verify boundary cases and every temporal class.
- [ ] The repository lint gate passes.
