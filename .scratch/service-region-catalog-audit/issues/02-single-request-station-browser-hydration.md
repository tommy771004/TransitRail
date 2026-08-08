# 02 — Hydrate the station browser with one catalog request

**What to build:** Make opening the station browser load all date-qualified station and line choices through one catalog operation while preserving the current passenger workflow. A passenger should see the same valid choices and shortcuts, but unsupported data must disappear consistently and the browser must stop duplicating catalog/provider work.

**Blocked by:** 01 — Establish the date-qualified service-region catalog.

**Status:** ready-for-agent

- [ ] One stable country/date/origin browser state triggers one unified catalog request rather than separate station and line requests.
- [ ] Reopening or rerendering the same stable state does not repeat provider access or rescan the stored timetable index unnecessarily.
- [ ] Global station search filters the already-loaded, date-qualified station set and does not issue a provider request per keystroke.
- [ ] Destination selection continues to expose only stations reachable from the selected origin on the exact service date.
- [ ] Featured stations, fuzzy/localized station matching, accessibility indicators, interchange labels, selected-line restoration, and endpoint auto-fill continue to work.
- [ ] A market with no verified searchable departures shows a clear no-data state and exposes no routes or stations.
- [ ] Loading failures and provider failures remain visibly distinct from a verified no-data response.
- [ ] Catalog hydration remains non-user telemetry, while explicit station search and selection remain auditable.
- [ ] Behavioral tests verify the single-request contract and protect the existing station-selection outcomes without asserting private component state.
- [ ] The repository lint gate passes.
