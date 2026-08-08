# Transit App 全市場即時與轉乘增強

**Status:** ready-for-agent

## Problem Statement

TransitRail 的核心承諾是：只將已註冊官方來源、可證實屬於乘客指定服務日的班次，當成可搜尋與可發布的時刻表。這使部分市場在缺少官方可下載時刻表時，正確地回覆「沒有已驗證時刻表」，但也留下兩個不同的使用需求：旅客想知道目前的即時離站與異常，也想比較包含步行與轉乘的門到門路線。

Transit App v4 是受 API key 保護的第三方聚合 API，能覆蓋多個市場的即時離站、服務警示、網路與站點探索、以及轉乘規劃；其按日排程端點仍是 Preview，且日期範圍與資料可用性取決於供應 feed。因此它不能變成 TransitRail 的官方時刻表來源，也不能讓空陣列被誤解為無服務。

本功能要在所有已支援市場建立可驗證的可用性探索，並以明確標示的輔助體驗提供即時資訊與轉乘規劃，同時完整保留原本精確服務日、官方來源與無資料狀態的語意。

## Solution

建立一個與既有時刻表搜尋隔離的 Transit App 整合邊界。它先以每個既有站點的座標與國別執行網路／站點解析，只有確認落在可用、非 beta 網路中的站點才可呼叫 Transit App。解析結果僅作短期快取與覆蓋稽核，第三方 ID 不進入既有站名、路線或已驗證班次資料。

在搜尋結果下方提供兩種可選的輔助內容：

1. **Live transit context**：目前離站與警示，以「Third-party live data」與最後更新時間清楚標示；API 不可用、站點未覆蓋或沒有即時資料時，顯示該功能不可用的說明，不改寫搜尋結果。
2. **Door-to-door planner**：使用者主動啟動的門到門規劃，可包含步行、轉乘、無障礙選項、路徑提示與（供應時）票價。此建議獨立於已驗證時刻表，不能生成或取代搜尋的 departure rows。

另提供可重跑的覆蓋稽核與按日排程比較工具。Preview 的 `schedule_for_dates` 與 `trips_for_dates` 只能用於明確標為第三方、按日期檢視的比較／品質訊號：必須回傳所請求日期、供應商網路與資料新鮮度；空結果永遠是「資料不可用或無法確認」，而非無服務，不能寫進 scraper 產物、service-day artifact、SEO 或搜尋回覆。

## User Stories

1. 作為旅客，我在任何已支援市場的搜尋結果下方，能看見該站是否有可用的第三方即時離站與服務警示，而不會誤把它當成已驗證時刻表。
2. 作為旅客，我能在有覆蓋的站點檢視即時離站、取消與警示的時間與來源標示。
3. 作為旅客，我在沒有 Transit App 覆蓋、API 暫時失敗或沒有即時資料時，會看見清楚的功能狀態，不會看到空白區塊，也不會被告知「無列車服務」。
4. 作為旅客，我可以主動請 Transit App 規劃出發地到目的地的門到門行程，並清楚知道這是第三方路線建議而非 TransitRail 已驗證班次。
5. 作為旅客，我的精確服務日搜尋、官方來源連結、驗證狀態與「No verified timetable available」訊息不會因新增功能而改變。
6. 作為產品營運者，我可以產生全市場站點／網路覆蓋報告，辨識何處能安全啟用即時或規劃功能。
7. 作為產品營運者，我可以在不公布第三方資料為時刻表的前提下，查看 Preview 按日排程對既有資料的比較與缺口訊號。
8. 作為工程師，我能以單一伺服器端 key 設定啟用功能，且 key 永遠不會送至瀏覽器、靜態檔或 scraper 產物。

## Implementation Decisions

- Transit App 是 `third-party supplementary data`，不是 source registry 的官方 source，絕不可填入 `results`、`sourceMeta`、service-day artifacts、SEO route pages 或任何可搜尋 departure。
- 以新的伺服器端 Transit App adapter 與明確資料型別承接 upstream 回覆；adapter 對外只暴露已正規化的 coverage、live context、planner 與 schedule-comparison 結果，並保留 provider、更新時間、請求日期與可用性原因。
- 新的 API 端點與既有搜尋端點分離：既有精確服務日搜尋不可呼叫 Transit App。最高層整合 seam 是「站點識別資料 → Transit App adapter → 補充內容端點 → 結果頁的明確標示卡片」。
- 先以既有可信站點資料取得座標與國別，呼叫 `available_networks`，排除 beta／未明確採用的網路；再用位置範圍內的站點查詢驗證 Transit App stop 屬於該網路。缺座標或無法唯一解析的站點即為未覆蓋，不能猜測 ID。
- upstream 的 network／stop／trip ID 僅限 runtime 使用，採短期快取並可失效重抓；不將不穩定 ID 作成 catalogue 的持久識別。
- 即時端點只在使用者檢視相關站點時呼叫。回覆包含 freshness／last-updated、資料類別與可理解的 unavailable reason；快取與 rate limit 以保護第三方 API 為目的，不能把舊資料標示為即時。
- planner 需使用使用者明確提供的 origin/destination（及可選無障礙偏好）；將步行、轉乘、票價、警示等內容保留為建議細節，不與既有 Journey／Trip 的 verified timetable 欄位混合。
- Preview 的按日端點只能走獨立、受控的 comparison／QA 路徑。每次比較需要保留 requested date、provider date response、network、freshness 與結果分類；沒有可確認的精確日期時輸出 `unavailable`。
- 使用單一伺服器環境變數 `TRANSIT_APP_API_KEY`。部署時，提供使用者互動功能的環境要在 Vercel 設定；排程稽核才需要 GitHub Actions secret。兩者皆可不設定，系統應降級為「third-party integration unavailable」。
- API key、原始 upstream payload、個人化位置與不穩定 ID 不進入 client telemetry、server logs 或公開 audit artifact。
- 既有官方 situations 功能仍維持官方來源身分；Transit App alerts 以獨立標示卡顯示，避免來源歸屬混淆。

## Testing Decisions

- 對 adapter 加入 fixture-based unit tests，涵蓋覆蓋解析、beta 排除、站點網路歸屬、空陣列、逾時、API 拒絕、快取到期與不洩漏 key。
- 對新的補充內容端點與結果頁做整合測試：有覆蓋／無覆蓋、即時離站／警示、空資料、錯誤、日期格式與無障礙 planner 選項皆需可驗證。
- 對既有 `/api/transit/search` 建立保護測試：在 Transit App key 存在與不存在兩種狀態下，搜尋回覆、verified status、sourceMeta、缺時刻表訊息與 SEO eligibility 不變。
- 覆蓋稽核使用固定的站點與 upstream fixtures，報告每市場的可解析、未覆蓋、歧義與缺座標數量；不可因測試環境外部資料變動而產生不穩定結果。
- schedule-comparison 測試要驗證 Preview 空值、日期不符、範圍超限、過期／未知 freshness 均分類為 unavailable，且沒有任何結果可進入 scraped-route、service-day 或 publication 流程。

## Out of Scope

- 以 Transit App 取代或修復任一官方 timetable scraper、官方 provider、source registry 或泰國／其他市場的 `results: []`。
- 將第三方即時或 Preview schedule 寫入資料庫、scraped JSON、static catalog、service-day artifact、sitemap、SEO route page 或搜尋 index。
- 對所有站點保證 Transit App 覆蓋、建立未經驗證的跨城市站點對映，或根據空 API 回覆聲稱停駛。
- 在第一階段新增背景追蹤、使用者帳號、個人位置保存、推播通知或票價／訂票交易。

## Further Notes

- 名詞沿用既有 domain glossary：**service day**、**verified timetable**、**no verified timetable**、**searchable route** 與 **source registry** 的定義不因本功能而改變。
- 架構決策以既有「日期專屬的已驗證時刻表」ADR 為準；本功能刻意保持在該邊界之外。
- Transit App v4 端點與限制的逐項調查已記錄為專案研究文件，並以官方 API 文件為依據。
