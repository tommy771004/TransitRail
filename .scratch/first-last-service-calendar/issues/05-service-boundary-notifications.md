# 05 — Saved-route service-boundary notifications

**What to build:** A user with a saved route can be notified when the published first or last usable departure materially changes for a relevant service date. Notifications identify the affected journey without firing merely because data was retrieved again or its freshness timestamp changed.

**Blocked by:** 01 — London first/last advisory tracer.

**Status:** ready-for-agent

- [ ] A saved route retains the country, origin, destination, direction where applicable, service date, and selected time needed to recompute its advisory consistently.
- [ ] The timetable fingerprint includes normalized first and last usable departures and applicable service-day identity, but excludes retrieval-only metadata.
- [ ] A material first-departure, last-departure, or service-day change produces at most one user notification for the changed fingerprint.
- [ ] The notification identifies the affected route and service date and describes the changed service boundary in user-safe localized text.
- [ ] Re-fetching identical service boundaries with a new checked time does not create a notification.
- [ ] Unsupported coverage, a temporary unavailable state, or an invalid source artifact does not create a false service-change notification.
- [ ] Stale fallback use preserves the prior comparison baseline and cannot masquerade as a newly published timetable.
- [ ] Notification delivery failure records a sanitized operational error and does not fail timetable collection or journey search.
- [ ] Tests cover first-train changes, last-train changes, service-day changes, unchanged retrievals, stale fallback, and duplicate suppression.
- [ ] Typechecking and the existing automated test suite pass.
