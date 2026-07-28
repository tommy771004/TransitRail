# 06 — Cross-market capability and failure-isolation acceptance

**What to build:** TransitRail presents consistent service-day coverage and freshness semantics across the completed API, GTFS, and Playwright sources. Unsupported markets continue to search normally, and failures in one source remain safely isolated and observable to maintainers without exposing diagnostics to travelers.

**Blocked by:** 02 — Boston service calendar and first/last journeys; 03 — France GTFS service-day advisory; 04 — Thailand official-page Playwright advisory; 05 — Saved-route service-boundary notifications.

**Status:** ready-for-agent

- [ ] Every country and operator has an explicit supported, partial, stale, or unavailable service-day capability; missing configuration is never interpreted as supported.
- [ ] Existing journey result renderers continue to work when no advisory is present, and the search response remains backward-compatible.
- [ ] API, GTFS, and Playwright sources produce the same normalized meanings for service date, timezone, first/last journey, risk, attribution, and freshness.
- [ ] A cross-market acceptance matrix verifies normal service, no service, unsupported coverage, partial coverage, stale fallback, and source failure at the public search seam.
- [ ] One simulated collector failure does not stop other countries, routes, or sources from completing and publishing valid artifacts.
- [ ] Truncated results, empty output, impossible time ordering, incomplete transfers, and invalid artifacts are rejected consistently and cannot replace known-good data.
- [ ] Public API responses and rendered pages contain only safe availability text and an optional support reference; they contain no stack trace, selector, secret, cookie, personal data, full upstream response, or internal diagnostic.
- [ ] Operational errors aggregate repeated failures by stable daily fingerprint while keeping different source, country, route, and operation failures distinguishable.
- [ ] Reduced Admin Console telemetry uses only server-side configuration and omits sensitive context; a telemetry delivery failure cannot affect search or collection.
- [ ] Source coverage, attribution, freshness expectations, unsupported markets, and the no-API-key restriction are documented for maintainers.
- [ ] Typechecking, the existing automated test suite, the production build, and station mapping audit pass.
