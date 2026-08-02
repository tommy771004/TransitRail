# 02 — 新加坡票價：換成官方距離制，或不顯示

**What to build:** 新加坡 curated 快照上的票價是 S$1.79、S$1.99、S$2.09、S$2.30 這種值。新加坡的地鐵票價實際是**距離制、以 5 分為級距**，不會落在 1.79。這些數字看起來精確，但形狀不對——疑為公式推算而非任何官方票價表。

完成後：新加坡路線要嘛帶真實的官方票價，要嘛不顯示票價欄位。一個看起來精確的錯誤數字，比沒有數字更糟。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## 現況（2026-08-02 稽核）

| 路線 | duration | 票價 |
| --- | --- | --- |
| Changi Airport → Jurong East | 55 分 | S$2.30 |
| HarbourFront → Punggol | 33 分 | S$1.99 |
| Jurong East → Raffles Place | 32 分 | S$1.79 |
| Woodlands → Orchard | 38 分 | S$2.09 |

四條路線各 109 筆／日 × 7 天完全相同，單一 duration、單一票價——整份是固定班距生成的代表性服務型態。

## 影響範圍有限，但仍應處理

新加坡目前在嚴格門檻下**整個隱藏**，所以這些票價不會顯示給使用者。但它們仍在已提交資料裡，任何未來放寬門檻、或直接讀檔的消費端都會拿到。

修法有兩條路，二選一：

- **接上官方票價** — LTA 有公開的距離制票價表；接上後票價成為真實資料
- **移除票價欄位** — 在有真實來源之前，`price` 留空。`aggregateTransferFare` 已支援 `undefined`

- [ ] 決定採用哪條路徑並記錄理由
- [ ] 若接官方票價：來源記錄於 `METRO_DATA_SOURCE_AUDIT.md`，且票價值符合 LTA 的 5 分級距
- [ ] 若移除：`price` 與 `currency` 一併留空，不留下半個欄位
- [ ] `seed-curated-snapshots.ts` 不會在下次執行時把舊值寫回來
- [ ] 檢查泰國（฿30／฿33／฿42）是否有相同問題——稽核當時判定「合理但無法逐筆驗證」
- [ ] `npm run lint` 綠燈
