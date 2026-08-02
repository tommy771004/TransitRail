# 04 — 真實性五分類與稽核腳本

**What to build:** 讓系統能對「某個路線快照在某個日期的那一份切片」給出明確的真實性分類，作為後續所有可見性決策的唯一依據。

五種分類：

| 分類 | 意義 |
| --- | --- |
| `scraped` | 從業者或官方來源實際取得的排班／時刻 |
| `realtime` | 抓取當下的即時到離站，僅對抓取當天有效 |
| `indicative` | 代表性服務型態、固定班距，非真實班表 |
| `stale_realtime` | 即時快照被寫進非抓取日期 |
| `none` | 該日期無任何班次 |

`stale_realtime` 是新判定：該日期的班次標記為即時，但班次識別碼內嵌的時間戳與其所屬日期不符。

同時交付一個維護腳本，印出目前每個路線快照的分類。這是本票的驗證方式——輸出應與 `METRO_TRANSFER_AND_INTEGRITY_AUDIT.md` 的判定結果表相符。

**Blocked by:** 01

**Status:** resolved

**驗證（2026-08-02）：** 五分類齊備；scripts/audit-timetable-authenticity.ts 可列出全部切片（indicative 308 / scraped 249 / realtime 11 / stale_realtime 4）。

- [x] 判定器可對 (路線快照, 日期) 回傳上述五種分類之一
- [x] `stale_realtime` 能正確辨識倫敦與香港路線檔中日期與內嵌時間戳不符的切片
- [x] 維護腳本可列出全部路線檔的分類結果
- [x] 腳本輸出與稽核報告一致：首爾與波士頓為真實、倫敦未來日期為 `stale_realtime`、新加坡與曼谷全部為 `indicative`
- [x] 測試涵蓋五種分類的邊界（固定班距、混合班距、即時、日期不符的即時、空切片）
- [x] `npm run lint` 綠燈
