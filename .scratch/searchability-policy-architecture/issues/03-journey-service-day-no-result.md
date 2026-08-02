# 03 — Apply Searchability policy to journey service days and no-result reasons

**What to build:** When a passenger searches for a Journey, the response uses the Searchability policy for service-day eligibility and explains why no answer is available. Direct and transfer searches must report the same truth mode and rejection reason for the same source facts.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** resolved

**驗證（2026-08-02）：** 港鐵未來日期回 future_date_unavailable、日本無此路線回 no_verified_data，兩者可區分；韓國直達與轉乘的 truthMode 實測皆為 verified，一致。

- [x] Future-date and unsupported-date searches return the policy’s explicit reason rather than a generic empty response.
- [x] A route with no searchable service-day data returns a distinguishable no-result reason.
- [x] Direct and transfer Journeys use the same service-day and truth-mode decision.
- [x] Search responses preserve provenance and truth mode for successful Journeys.
- [x] Existing journey result shapes remain compatible for verified routes.
