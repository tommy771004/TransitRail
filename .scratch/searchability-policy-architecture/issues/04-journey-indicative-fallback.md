# 04 — Make indicative fallback explicit in journey search

**What to build:** When a preferred live provider cannot answer, journey search either returns a policy-permitted canonical snapshot as an explicitly marked indicative fallback or fails closed with a useful reason. No fallback may look like a verified service-day timetable.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** resolved

**驗證（2026-08-02）：** permitsIndicativeFallback 依國家判定（japan=false、germany=true）；不允許者回政策拒絕原因而非空結果。

- [x] A permitted canonical snapshot is returned with visible indicative truth mode and provenance.
- [x] A country/source that forbids indicative fallback returns the policy rejection reason.
- [x] Indicative fallback results cannot claim verified date-specific departures.
- [x] Live-provider success continues to take precedence when it provides a verified answer.
- [x] Tests cover provider success, provider failure with permitted fallback, and provider failure without fallback.
