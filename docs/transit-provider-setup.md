# 國際軌道資料來源與申請流程

更新日期：2026-07-02

## 目前整合狀態

| 國家／地區 | 資料來源 | 憑證 | 專案狀態 | 可提供內容 |
| --- | --- | --- | --- | --- |
| 日本 | ODPT | API key | 等待 route adapter | 鐵路、車站、時刻與部分動態資料，依營運商授權而異 |
| 韓國 | ODsay | API key | 等待 route adapter | 地鐵路線搜尋、KTX／列車資訊；部分即時資訊需再接韓國公共資料 API |
| 香港 | MTR Next Train | 不需要 | 已完成 | 支援路線的即時下一班列車、月台、終點與延誤狀態 |
| 新加坡 | LTA DataMall | AccountKey | 規劃中 | 列車服務警示、車站擁擠度、設施維護；不是逐站下一班時刻 |
| 馬來西亞 | data.gov.my | 多數公開下載不需金鑰 | 資料評估 | Rapid Rail／KTMB 統計與下載檔；目前不應當成即時班次 |
| 英國 | Transport for London | app_key，可匿名低流量試用 | 已完成 | 倫敦 Underground、Elizabeth line、DLR 與 Overground 的即時旅程 |
| 德國 | Deutsche Bahn API Marketplace | Client ID／API key | 建議下一階段 | 車站時刻表、計畫班次與即時異動 |
| 瑞士 | Open Data Platform Mobility | Bearer token | 建議下一階段 | 全國 SIRI 即時／計畫時刻、GTFS 與 OJP |
| 美國 Boston | MBTA V3 | API key，可免 key 試用 | 已完成（直達） | 地鐵、輕軌與通勤鐵路的即時直達預測 |
| 美國 San Francisco Bay | 511 Open Data | API token | GTFS 候選 | 區域 GTFS、GTFS-RT、SIRI、NeTEx 與歷史 feed |

所有密鑰只能放在伺服器端 `.env`。不要放入 Vite 的 `VITE_*` 變數、React 原始碼或提交到 Git。

## 香港：MTR Next Train

香港的即時 adapter 已完成，不需註冊或申請金鑰。

1. 閱讀 [DATA.GOV.HK 即時港鐵資料集](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)。
2. 閱讀 [MTR Next Train API v1.7 規格](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf)。
3. 呼叫：

   ```text
   GET https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TWL&sta=CEN&lang=EN
   ```

4. 不需 Authorization header。`line` 與 `sta` 必須是規格內有效組合。
5. 本專案支援官方 v1.7 列出的 10 條路線，會依各線官方方向定義判斷 `UP`／`DOWN`，並排除終點在使用者目的站之前的短程列車。
6. API 只提供起點的下一班時間，沒有完整旅程票價與目的站抵達時間；畫面因此不顯示這兩個欄位。
7. API 是「現在」的列車資訊，所以香港搜尋只接受香港當日日期。

程式位置：

- `src/data/hongKongMtr.ts`
- `src/server/hongKongMtr.ts`
- `src/components/MetroResultView.tsx`

## 日本：ODPT

官方入口：[ODPT Developer Site](https://developer.odpt.org/)

申請：

1. 先閱讀 [使用規則與開發者指引](https://developer.odpt.org/terms)。
2. 開啟 [使用者註冊](https://developer.odpt.org/signup)。
3. 填寫可驗證的姓名、地址、電話、所屬單位與用途；個人申請可依官方指示填寫 `Individual`。
4. 點擊驗證信中的網址確認 Email。
5. 等待人工審核。官方說明最長可能需要兩個工作天。
6. 審核完成後登入 Developer Site，取得 API key／consumer key。
7. 寫入伺服器環境：

   ```dotenv
   ODPT_API_KEY="your-consumer-key"
   ```

8. 登入資料目錄，確認目標營運商、資料類型和個別授權。不是每一家日本鐵路公司都在 ODPT 提供相同資料。
9. 上線時需遵守 ODPT 顯示規範：動態資料要顯示資料生成時間，依 `odpt:frequency` 更新，且不得顯示超出 `dct:valid` 的舊資料。詳見 [Developer Guideline](https://developer.odpt.org/terms/data_basic_use_guideline.html)。

專案後續 adapter 應將 ODPT 的站碼、時刻、列車動態與營運商資料正規化為 `TransitResult`。目前有金鑰時仍會明確回傳 `Provider Adapter Missing`，不會製造結果。

## 韓國：ODsay

官方入口：[ODsay LAB](https://lab.odsay.com/)

申請：

1. 註冊並登入 ODsay LAB。
2. 進入 `애플리케이션` → `애플리케이션 등록`（Application Registration）。
3. 填寫不重複的應用名稱、類別、服務類型與平台資料。
4. 選擇免費或付費方案。官方說明免費方案以韓文資料為主；英文、日文、繁中等多語通常屬付費能力。
5. 在 `내 애플리케이션`（My Applications）取得平台 API key。
6. 平台或網域設定修改後，官方表示可能需要約一分鐘生效。
7. 寫入：

   ```dotenv
   ODSAY_API_KEY="your-api-key"
   ```

8. API key 可能含 `+`、`/`、`=` 等字元，放入 query string 時必須 URL encode。
9. 依 [官方整合指南](https://lab.odsay.com/guide/guide?platform=web) 選擇：
   - `searchPubTransPathT`：依起訖經緯度搜尋大眾運輸路線。
   - Subway Route Search：地鐵路線搜尋。
   - Train/KTX Operation Information：列車與 KTX 資訊。
10. ODsay 的部分即時到站資料需要再申請 [韓國公共資料入口](https://www.data.go.kr/) 的地區 API，不能假設 ODsay key 本身涵蓋所有即時資訊。

目前專案尚未加入站名地理編碼與 ODsay route adapter，因此會明確回傳未完成狀態。

## 新加坡：LTA DataMall

官方入口：[LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html)

申請：

1. 在 DataMall 點選 `Request for API Access`。
2. 使用有效 Email 接受 API Terms of Service 並註冊訂閱者資料。
3. 由 LTA 發出 `AccountKey`。
4. 寫入：

   ```dotenv
   LTA_ACCOUNT_KEY="your-account-key"
   ```

5. 依 [API User Guide](https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf) 將 key 放在 HTTP request header `AccountKey`。
6. 列車相關可使用：
   - `TrainServiceAlerts`：營運時間內的中斷與受影響路線／車站。
   - Station Crowd Density：指定網路的即時擁擠度。
   - Facilities Maintenance：電梯等設施維護。
7. DataMall 並未在這組 API 中提供每一站的下一班列車時刻，因此不能把 service alert 或 crowd density 轉成假班次。
8. 依官方 Terms 保護 AccountKey、遵守用量限制，且不要在瀏覽器直接暴露 key。

## 馬來西亞：data.gov.my 與下載檔

官方入口：[data.gov.my](https://data.gov.my/)

1. 多數公開資料集可直接下載 CSV／Parquet，不需要帳號或 API key。
2. 先在資料目錄確認欄位、更新頻率、授權與來源。
3. Rapid Rail 可參考 [Rapid Rail Explorer](https://data.gov.my/dashboard/rapid-explorer) 與 [每日 OD 運量資料](https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily)。
4. KTMB 可參考 [KTMB Explorer](https://data.gov.my/dashboard/ktmb-explorer)。
5. 這些資料主要是歷史運量，不是列車時刻或即時到站。可以用於熱門路線、需求分析和站點目錄，不可轉成 `TransitResult` 班次。
6. 若未來官方發布 GTFS static：
   - 定時下載 ZIP。
   - 驗證 `feed_info.txt` 與更新時間。
   - 解析 `stops.txt`、`routes.txt`、`trips.txt`、`stop_times.txt`、`calendar.txt`／`calendar_dates.txt`。
   - 以服務日期與 stop sequence 找出同一 trip 上的起訖站。
   - 明確標示為「時刻表資料」，不能標示為即時。
7. 若發布 GTFS Realtime，再將 Trip Updates 與 static feed 的 `trip_id` 合併；不能只靠 Vehicle Positions 猜抵達時間。

## 英國：Transport for London

官方入口：[TfL API Portal](https://api-portal.tfl.gov.uk/)

1. TfL Unified API 可匿名試用，但匿名流量目前限制較低；正式應用建議建立帳號。
2. 開啟 [Sign up](https://api-portal.tfl.gov.uk/signup)，填寫 Email、密碼與姓名並接受 Open Data 條款。
3. 點擊確認信啟用帳號後登入。
4. 進入 `Products`，訂閱 `500 Requests per min` 方案。
5. 在 `Profile` 取得 subscription key。
6. 寫入：

   ```dotenv
   TFL_APP_KEY="your-app-key"
   ```

7. 呼叫 Unified API 時將 `app_key` 放在 query parameter；舊文件中的 `app_id` 已不再需要。
8. 本專案最適合使用：
   - `Journey`：起訖站旅程規劃。
   - `Line`：路線與營運狀態。
   - `StopPoint`：車站、月台與到站資訊。
9. TfL 官方目前說明匿名存取約為每分鐘 50 次，訂閱一般產品後為每分鐘 500 次；部署前應再次確認 [Products](https://api-portal.tfl.gov.uk/products)。

程式位置：

- `src/server/tfl.ts`
- `src/components/LiveRailResultView.tsx`

## 德國：Deutsche Bahn

官方入口：[DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis)

1. 選擇註冊，建立或登入 DB 客戶帳號。
2. 驗證 Email 確認碼，授權姓名與 Email 給 API Marketplace。
3. 在 Marketplace 建立新的 Application。建立時顯示的 Client Secret 只會出現一次，必須立即安全保存。
4. 在 API Catalog 選擇 `Timetables`，訂閱 Free plan。
5. 在應用資訊取得 Client ID 與 API key，寫入：

   ```dotenv
   DB_CLIENT_ID="your-client-id"
   DB_API_KEY="your-client-secret"
   ```

6. 呼叫時加入 headers：

   ```text
   DB-Client-Id: ...
   DB-Api-Key: ...
   ```

7. Timetables API 可用 `/station/{pattern}` 尋找 EVA station number，以 `/plan/{evaNo}/{date}/{hour}` 取得計畫時刻，再用 `/fchg/{evaNo}` 或 `/rchg/{evaNo}` 合併即時異動。
8. Free plan 目前標示每分鐘 60 次；資料採 CC BY 4.0，顯示時需保留適當 attribution。詳見 [Timetables 產品頁](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables)。

## 瑞士：Open Data Platform Mobility

官方入口：[API Manager](https://api-manager.opentransportdata.swiss/)

1. 以 Email、姓名與至少 12 字元且包含數字和特殊符號的密碼註冊。
2. 登入 API Manager，選擇所需 API 並按 `Read more`。
3. 選擇 `Access with this plan`。
4. 建立 Application 名稱與描述，或選擇既有 Application。
5. 到 `My apps` 複製 TOKEN；每個 API 原則上只能自行建立一個 token。
6. 寫入：

   ```dotenv
   SWISS_TRANSPORT_TOKEN="your-token"
   ```

7. 請求加入：

   ```text
   Authorization: Bearer ...
   User-Agent: TransitRail/contact-email
   ```

8. 下載型資料應允許 redirect 並啟用壓縮。全國即時資料可使用 SIRI Estimated Timetable，計畫資料可使用 SIRI Planned Timetable；也可選 GTFS／GTFS-RT 或 OJP。
9. SIRI feed 體積很大，應在後端定時下載並快取，不能每次前端搜尋都重新抓整包。詳細方式見 [官方 API key 指南](https://opentransportdata.swiss/de/cookbook/development-miscellaneous-cookbook/howto-access-apis/)。

## 美國：Boston MBTA

官方入口：[MBTA V3 API Portal](https://api-v3.mbta.com/)

1. API 可在沒有 key 時進行低流量測試。
2. 建立 Developer Account，為每個應用申請獨立 API key。
3. 官方說明核發可能需要約一天。
4. 寫入：

   ```dotenv
   MBTA_API_KEY="your-api-key"
   ```

5. 呼叫 `https://api-v3.mbta.com` 時使用 `x-api-key` header，或依官方文件使用 `api_key` query parameter。
6. 建議組合：
   - `stops`、`routes`：建立站點與路線目錄。
   - `schedules`：計畫班次。
   - `predictions`：即時抵達／發車預測。
   - `alerts`：中斷與服務變更。
7. 以 relationship IDs 合併 route、trip、stop，不要用顯示名稱當永久主鍵。
8. 目前 adapter 會平行查詢起訖站的 Predictions，依相同 `trip_id` 與遞增 `stop_sequence` 配對直達班次；尚未將多段 trip 組成轉乘路徑。

程式位置：

- `src/server/mbta.ts`
- `src/components/LiveRailResultView.tsx`

## 美國：San Francisco Bay 511

官方入口：[511 Open Transit Data](https://511.org/open-data/transit)

1. 選擇 `Request a Token`，接受 Data Agreement 並填寫開發者與用途資訊。
2. 取得 API token 後寫入：

   ```dotenv
   SF_511_API_KEY="your-token"
   ```

3. 下載 `GTFS Operators` 取得 agency/operator ID。
4. 以 `datafeeds` endpoint 下載單一營運商或 `RG` 全區 GTFS static。
5. 即時資料可使用 GTFS-RT Trip Updates、Vehicle Positions、Service Alerts，或 JSON/XML 格式的 SIRI Stop Monitoring。
6. Static feed 提供 stops、routes、trips、stop_times；Trip Updates 必須依 `trip_id` 與 static feed 合併。
7. 官方預設限制目前為每個 token 每小時 60 次。需要提高額度時依官方說明申請，信件中不要附上 API key。
8. 顯示資料時需標示 511.org 為來源。

## 為什麼不以 Playwright 抓班次

Playwright 適合測試網站或在獲得允許時自動下載公開檔案，不適合作為主要班次 API：

- 網頁 DOM 與反自動化機制容易改動。
- 登入、驗證碼與使用條款可能禁止自動抓取。
- 頁面顯示值通常缺少穩定站碼、更新時間與資料契約。
- 伺服器成本與錯誤率高於官方 API／GTFS。

只有在營運商明確允許自動化下載、沒有正式 API／feed，且經過授權與 robots／Terms 檢查後，才應加入 Playwright downloader。下載後仍需保存來源 URL、抓取時間、檔案雜湊與解析錯誤，不應悄悄回退到假資料。

## Python 可以放在哪裡

Python 適合做後端資料管線，但不應以爬網頁取代已有的官方 API：

- 定時下載並解析 GTFS static ZIP。
- 解碼 GTFS-Realtime Protocol Buffers，將 Trip Updates 與 static feed 的 `trip_id` 合併。
- 解析大型 SIRI XML／JSON feed、驗證資料時間戳並寫入快取或資料庫。
- 執行 feed 品質檢查、欄位正規化與歷史資料彙整。

目前本專案的 HTTP 後端是 Node.js／TypeScript。像 TfL、MBTA 這類 JSON API，直接在 `src/server/` 加 provider adapter 最省事；只有要處理大量 GTFS／SIRI 批次資料時，再增加獨立 Python worker。前端一律只呼叫本專案的 `/api/transit/*`，不要直接連供應商，也不要暴露 API key。
