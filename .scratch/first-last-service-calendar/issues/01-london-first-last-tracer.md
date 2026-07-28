# 01 — London first/last advisory tracer

**What to build:** A London journey search can show the applicable service day, the first and last complete journeys for the requested route, and the risk of the selected time being too close to the last journey. Use the existing anonymous official provider as the first complete path through collection, normalization, search response, localized mobile UI, fixture-based tests, safe fallback behavior, and operational error reporting.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A supported London origin, destination, local service date, and selected time returns an additive service-day advisory without changing the existing journey results.
- [ ] The advisory reports London transit timezone, service-day classification, first usable departure, last usable departure, risk state, source attribution, and freshness.
- [ ] First and last departures are direction-aware and represent complete journeys to the requested destination, including valid onward connections when the journey transfers.
- [ ] Safe, approaching, critical, and missed states follow the configured threshold boundaries and are verified at their boundary values.
- [ ] After-midnight journeys remain attached to the correct operating day and are compared in the provider's local timezone rather than the browser timezone.
- [ ] The result screen renders one concise advisory near the result set, with localized text and urgency communicated by text or icon as well as color.
- [ ] Unsupported route combinations preserve normal search behavior and return an unavailable or partial capability state instead of inferred first/last times.
- [ ] Fixed official-response fixtures exercise the source contract; automated tests do not call the live provider.
- [ ] Provider, parsing, and query failures use the last known good data when valid, write a sanitized operational error, and never expose technical diagnostics to the browser.
- [ ] Typechecking and the existing automated test suite pass.
