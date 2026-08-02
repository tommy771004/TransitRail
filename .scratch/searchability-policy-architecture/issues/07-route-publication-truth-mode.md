# 07 — Preserve truth mode in route publication

**What to build:** Route publication consumes validated route facts and preserves whether information is verified or indicative in readable route information and structured metadata. Indicative routes may be published as general route information, while date-specific claims require a verified timetable.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** resolved

**驗證（2026-08-02）：** permitsIndicativeRoutePublication 控制發佈；新加坡/泰國 indicative 路線不產生頁面，且只有 verified 才輸出日期相關的 TrainTrip schema。

- [x] Published general route information visibly distinguishes indicative timetable information from verified timetable information.
- [x] Date-specific route claims are generated only from verified timetable information.
- [x] Timetable rows, page copy, FAQ content, and structured metadata do not make stronger claims than the policy decision.
- [x] Route publication does not independently reclassify raw timetable data.
- [x] Existing verified route pages retain their current content and structured metadata semantics.

> **驗證限度：** 標記為「retain existing / 保持現狀」的條件，是以目前狀態的行為驗證（347 項測試、跨國端到端查詢、路線頁產出比對）推得，**未做改動前後的逐頁基準 diff**。若需要嚴格的回歸證明，須另取基準版本比對。
