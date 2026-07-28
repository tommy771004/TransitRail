# 04 — Thailand official-page Playwright advisory

**What to build:** A supported Thailand route obtains first/last service information from a qualifying official operator page or public download through Playwright. The feature proves that HTML-based sources can feed the shared advisory while accurately declaring partial coverage and surviving page changes without corrupting the last known good data.

**Blocked by:** 01 — London first/last advisory tracer.

**Status:** ready-for-agent

- [ ] The selected source is an official, unauthenticated public page or download and explicitly publishes a complete service day or first/last declarations for the supported scope.
- [ ] The adapter declares operator, route and station coverage, direction semantics, timezone, attribution, update cadence, and any limits that require a partial capability state.
- [ ] A scheduled Playwright collection normalizes the official values into the shared advisory contract and publishes them only after validation.
- [ ] Supported Thailand searches display route-appropriate first/last values, service-day type, risk state, source, and freshness through the common localized UI.
- [ ] Station-level or direction-limited source data is labeled partial and is never presented as a guaranteed complete journey when the source cannot prove one.
- [ ] Saved official HTML fixtures cover expected content, weekend or holiday variation when published, missing required fields, changed markup, and empty results.
- [ ] Automated tests parse fixtures without accessing the live operator website.
- [ ] Selector changes, navigation failures, timeouts, and validation failures retain the last known good artifact and create a sanitized, daily-aggregated operational error.
- [ ] A Thailand source failure does not abort other country collectors and the public page never displays selectors, stack traces, upstream response bodies, or internal log text.
- [ ] Typechecking and the existing automated test suite pass.
