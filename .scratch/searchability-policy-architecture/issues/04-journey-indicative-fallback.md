# 04 — Make indicative fallback explicit in journey search

**What to build:** When a preferred live provider cannot answer, journey search either returns a policy-permitted canonical snapshot as an explicitly marked indicative fallback or fails closed with a useful reason. No fallback may look like a verified service-day timetable.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** ready-for-agent

- [ ] A permitted canonical snapshot is returned with visible indicative truth mode and provenance.
- [ ] A country/source that forbids indicative fallback returns the policy rejection reason.
- [ ] Indicative fallback results cannot claim verified date-specific departures.
- [ ] Live-provider success continues to take precedence when it provides a verified answer.
- [ ] Tests cover provider success, provider failure with permitted fallback, and provider failure without fallback.
