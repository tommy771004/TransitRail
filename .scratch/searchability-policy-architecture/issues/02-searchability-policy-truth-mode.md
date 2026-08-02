# 02 — Establish the Searchability policy truth-mode contract

**What to build:** TransitRail has one policy decision for a route, country, service day, origin, destination, and provenance. The decision states whether the route is searchable, its truth mode, and the reason when it is rejected, so downstream consumers no longer infer trust from source names or empty results.

**Blocked by:** 01 — Normalize source provenance and canonical snapshots.

**Status:** resolved

**驗證（2026-08-02）：** decideSearchability 區分 verified / indicative / stale / unusable；別名與可達目的地由 searchabilityPolicyContract.test.ts 的『shares aliases and reachable destinations between catalog and journey graph』鎖住。三個 per-country 閘門本輪已收進 countryConfig.authenticityGates。

- [x] The policy distinguishes searchable verified timetable, permitted indicative timetable, stale data, and no usable data.
- [x] The policy applies alias resolution and reachable-destination rules consistently.
- [x] The policy returns a stable rejection reason for unsupported date, unavailable route, unavailable coverage, and no departures.
- [x] The same table-driven fixtures cover country, service day, origin, destination, provenance, and truth mode.
- [x] Existing covered routes retain their current externally visible searchability unless the source is classified as untrustworthy.

> **驗證限度：** 標記為「retain existing / 保持現狀」的條件，是以目前狀態的行為驗證（347 項測試、跨國端到端查詢、路線頁產出比對）推得，**未做改動前後的逐頁基準 diff**。若需要嚴格的回歸證明，須另取基準版本比對。
