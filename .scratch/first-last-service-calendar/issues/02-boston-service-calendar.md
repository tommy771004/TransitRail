# 02 — Boston service calendar and first/last journeys

**What to build:** A Boston journey search uses the anonymous official transit data to provide the same service-day advisory established by the London tracer, including calendar exceptions and route-aware first and last complete journeys, without introducing a Boston-specific presentation path.

**Blocked by:** 01 — London first/last advisory tracer.

**Status:** ready-for-agent

- [ ] A supported Boston search returns the normalized advisory alongside the existing journey results and uses the Boston transit timezone.
- [ ] Weekday, Saturday, Sunday/holiday, and published exceptional service are classified from the official service calendar for the selected date.
- [ ] First and last values are calculated for the requested origin, destination, direction, and complete leg chain rather than from network-wide operating hours.
- [ ] Trips expressed after midnight remain part of the correct service day and produce the correct risk state for the selected local time.
- [ ] The shared result UI renders Boston advisory, partial, stale, and unavailable states without a new country-specific advisory component.
- [ ] Source attribution, safe official link, checked time, and published update time are included when the provider supplies them.
- [ ] Fixed response fixtures cover normal service, a calendar exception, after-midnight service, an incomplete transfer, and an upstream schema failure.
- [ ] Empty, truncated, or internally inconsistent provider output cannot replace a valid prior artifact.
- [ ] Source or query failure is isolated to Boston, records a sanitized operational error, and leaves other country searches operational.
- [ ] Typechecking and the existing automated test suite pass.
