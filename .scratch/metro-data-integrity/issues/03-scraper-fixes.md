# 03 — Scraper 修正：不再把即時快照寫進未來日期

**What to build:** 三個讓已提交資料失真的爬取行為。

**倫敦**：目前對七個日期各呼叫一次 TfL 即時 API，每次拿到的都是「此刻的下三班」，於是七天的資料全部是同一個早上的實況，往後漂 2–3 分鐘，且全部標記為即時。即時資料在定義上只對抓取當下有效，不能寫進未來日期。

**香港**：live adapter 回傳的少量「下班車」會取代當天既有的完整班表切片，導致當天只剩 4 筆、涵蓋八分鐘，早晚查詢一片空白。

**波士頓**：週六班次重複累積（563 筆 vs 應為 144 筆）；平日末班截斷在 16:58，晚間班次整段消失。

**Blocked by:** None — can start immediately.

**Status:** resolved

**驗證（2026-08-02）：** TfL 改 searchTflServiceDay 掃描營運日（3 筆/日 → 33 筆/日）；isSparseLiveSlice 擋住少量 live 覆蓋完整切片；MBTA 重跑後每日筆數與 provider 一致（平日 229、週日 171、週六 181），真重複 0，末班 23:54。

**過程中發現並修掉的兩個相關缺陷：**
1. `mbta.ts` 轉乘 id 為 `us-mbta-transfer-${date}-${journeys.length}`，內嵌陣列索引；限流讓每次筆數不同，同一班車就換一個 id，內容比對去重抓不到而累積（單日 601 筆 vs 實際 229）。改為由 `first.departureIso`+`second.arrivalIso` 導出。
2. 單一日期退回 curated 快照時，該日 metadata 會重新標記整個檔案，使六天真實排班被記為 `curated`。`describingRoute` 加入來源強度比較（official > curated > llm-advisory > unknown）。MBTA 也補上 429 退避重試（與 TfL 同一缺陷）。

- [x] 即時 provider 的抓取結果只寫入抓取當天，不再對未來日期各呼叫一次
- [x] live adapter 回傳筆數顯著少於既有切片時，不得覆蓋既有切片（合併或保留較完整者）
- [x] 重跑香港爬取後，當天保有完整的全日班次而非只有數筆
- [x] 波士頓週六班次去重至正確筆數
- [x] 調查並修正波士頓平日末班截斷（**非** provider 分頁上限，是合併 bug 的殘留資料；重跑後末班 16:58 → 23:54）
- [x] `npm run lint` 綠燈

**注意：** 修好香港覆蓋問題後，當天會恢復成 curated 的完整班表——而 curated 在嚴格門檻下會被 ticket 07 判定為非真實資料而隱藏。也就是說本票會讓港鐵當天從「殘缺但可見」變成「完全隱藏」。這是規則的正確結果，不是回歸。
