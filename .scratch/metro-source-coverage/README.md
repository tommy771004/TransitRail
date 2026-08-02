# Metro source coverage

三張 ticket，全部卡在同一件事：**需要新的外部資料來源**，不是整合或重構能推進的。

它們是 2026-08-02 地鐵資料真實性工作的殘留項。那輪把「已有的資料誠實呈現」做完了（見 [`.scratch/metro-data-integrity/`](../metro-data-integrity/) 12 張與 [`.scratch/searchability-policy-architecture/`](../searchability-policy-architecture/) 8 張，全數 resolved），這三張是「資料本身還不夠」的部分。

| # | 主題 | 卡在哪 |
| --- | --- | --- |
| [01](issues/01-metro-network-coverage-gaps.md) | 約 100 個地鐵網路零覆蓋 | 每個網路都要先找到官方時刻表來源 |
| [02](issues/02-singapore-fare-accuracy.md) | 新加坡票價形狀不符官方級距 | 需 LTA 官方票價表，或決定移除欄位 |
| [03](issues/03-belgium-date-range-verification.md) | 比利時 14 天範圍未經驗證 | 需 iRail 上游恢復 |

## 一條貫穿的原則

先前的工作確立了這件事，這三張票都受它約束：

> 沒有可驗證來源的網路不加入 repo——寧可缺席，也不要再多一份看不到的合成資料。

曼谷與東京的拓撲在 2026-08-02 補完（曼谷 7 線／176 站／17 換乘站，東京 5 線／123 站／13 換乘站），但兩者仍然隱藏，因為沒有真實時刻表。**補拓撲不會讓網路變成可用；先有來源，拓撲才有意義。**

相關文件：[`METRO_DATA_SOURCE_AUDIT.md`](../../METRO_DATA_SOURCE_AUDIT.md)（外部有什麼資料可接）、[`METRO_TRANSFER_AND_INTEGRITY_AUDIT.md`](../../METRO_TRANSFER_AND_INTEGRITY_AUDIT.md)（已提交資料有多真、轉乘邏輯）。
