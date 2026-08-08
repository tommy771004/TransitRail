# 03 — Add service-region → line → station navigation

**What to build:** Let passengers browse stations in the confirmed three-level order. The left pane presents expandable service regions and their lines; selecting a line shows its ordered stations in the right pane. Passengers who already know a station name can still use global search as a shortcut.

**Blocked by:** 02 — Hydrate the station browser with one catalog request.

**Status:** ready-for-agent

- [ ] The left pane renders service-region headings with their nested searchable lines, and the right pane renders the selected line's stations in route order.
- [ ] The first available region and line are selected by default when no valid prior selection exists.
- [ ] A previously selected line is restored when it remains available, including existing scroll-to-line behavior.
- [ ] Changing country, service date, origin-dependent destination coverage, or catalog contents resets any invalid region or line selection.
- [ ] Global search bypasses the hierarchy visually but remains limited to the same date-qualified station set.
- [ ] Empty regions and unsupported lines never appear, and a no-data catalog does not render empty navigation chrome.
- [ ] Service-region labels are localized across supported locales with an intelligible source-name fallback.
- [ ] Region controls expose expanded state, line controls expose selected state, keyboard focus is usable, and touch targets remain appropriate for the mobile sheet.
- [ ] Station-selection audit events include region identity when available while preserving line and station identity.
- [ ] User-observable verification covers expanding a region, selecting a line, viewing stations, global search, selection reset, and the no-data state.
- [ ] The repository lint gate passes.
