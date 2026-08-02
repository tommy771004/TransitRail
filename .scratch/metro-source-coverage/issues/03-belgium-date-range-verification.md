# 03 — 驗證比利時的 14 天日期範圍

**What to build:** 比利時的選單提供 14 天，但這個數字從未被驗證過——2026-08-02 實測時 iRail 上游正在故障（每個日期都回 HTTP 504），所以無法確認 provider 是否真的答得出第 8–14 天。

完成後：比利時的日期範圍是量測出來的，不是假設的。

**Blocked by:** None — 但需要 iRail 恢復服務才能驗證。

**Status:** ready-for-agent

## 為什麼這件事重要

同一個問題已經在其他兩個市場出現過並修掉：

- **瑞士**曾提供 14 天，但其 OJP adapter 未設定 token 時對每個日期都回 501，第 8–14 天落到只有 7 天的快照 → 404 `unsupported_route`（訊息還在誤導，路線本身是好的）。2026-08-02 改為依已提交資料收斂。
- **日本等 snapshot 市場**曾提供 14 天對 7 天資料，第二週全部無服務。已改用共用常數 `SCRAPE_WINDOW_DAYS`。

比利時是 `search.kind: "provider"`（純 provider，無快照 fallback），所以它的 14 天完全取決於 iRail 能答多遠。**沒有人量過。**

挪威同為 14 天，實測全部可查（Entur 確實答得出來），可作為對照。

## 驗證方式

```
npx tsx -e '…runTransitSearch({country:"belgium", origin:"Brussels-Central",
  destination:"Antwerpen-Centraal", date:<第 N 天>})…'
```
對範圍內每一天執行，記錄第一個失敗的日期。

- [ ] iRail 恢復後，逐日驗證比利時第 1–14 天
- [ ] 若第 8–14 天答不出來，比照瑞士收斂日期範圍
- [ ] 若全部可查，在 `countryConfig` 加註「已於 YYYY-MM-DD 實測」以免下次又被懷疑
- [ ] 順帶重驗挪威（目前 14 天全通，但同樣沒有留下量測紀錄）
- [ ] 上游故障期間的行為維持現狀：回 502 加說明訊息，不退回任何合成資料
- [ ] `npm run lint` 綠燈

## 注意

iRail 故障當下 App 的行為是**正確的**——降級為 502 並附訊息，沒有捏造任何資料。本票不是要修故障處理，是要確認範圍宣稱屬實。
