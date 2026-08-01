# 01 — Prefactor：真實性判定器升格到 src/data/

**What to build:** 目前判斷「一份時刻表是真班表還是代表性服務型態」的邏輯住在 `scripts/lib/routePages.ts`，只有 SEO 預渲染頁在用。把它搬到 `src/data/` 之下，讓 server 端與前端路徑也能取用，`routePages.ts` 改為 import 同一份實作。

這張票**不改變任何行為**——純粹是「先讓改動變容易」的 prefactor。SEO 頁的輸出必須逐字相同：同一批路線頁被標為 indicative、同一批仍輸出 `TrainTrip` 結構化資料。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 判定器與其輔助函式移至 `src/data/` 下的新模組，`scripts/lib/routePages.ts` 改為 import 它
- [ ] 既有針對該判定器的測試一併移至新模組旁，並持續通過
- [ ] `npm run routes` 產出的頁面內容與搬移前逐字相同（以搬移前後的產出目錄比對驗證）
- [ ] `npm run lint` 綠燈
