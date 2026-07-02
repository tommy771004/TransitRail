# 亞洲軌道資料來源與申請流程

更新日期：2026-07-02

## 目前整合狀態

| 國家／地區 | 資料來源 | 憑證 | 專案狀態 | 可提供內容 |
| --- | --- | --- | --- | --- |
| 日本 | ODPT | API key | 等待 route adapter | 鐵路、車站、時刻與部分動態資料，依營運商授權而異 |
| 韓國 | ODsay | API key | 等待 route adapter | 地鐵路線搜尋、KTX／列車資訊；部分即時資訊需再接韓國公共資料 API |
| 香港 | MTR Next Train | 不需要 | 已完成 | 支援路線的即時下一班列車、月台、終點與延誤狀態 |
| 台灣 | TDX | Client ID／Client Secret | 規劃中 | 捷運、台鐵、高鐵與其他公共運輸 OData |
| 新加坡 | LTA DataMall | AccountKey | 規劃中 | 列車服務警示、車站擁擠度、設施維護；不是逐站下一班時刻 |
| 馬來西亞 | data.gov.my | 多數公開下載不需金鑰 | 資料評估 | Rapid Rail／KTMB 統計與下載檔；目前不應當成即時班次 |

所有密鑰只能放在伺服器端 `.env`。不要放入 Vite 的 `VITE_*` 變數、React 原始碼或提交到 Git。

## 香港：MTR Next Train

香港是目前第三個已完成的市場，不需註冊或申請金鑰。

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

## 台灣：TDX

官方入口：[TDX 運輸資料流通服務](https://tdx.transportdata.tw/)

申請：

1. 註冊 TDX 會員並完成 Email／身分資料驗證。
2. 登入後進入 `會員中心` → `資料服務` → `API 金鑰`。
3. 建立 API 金鑰；官方目前允許會員依需求建立最多三把。
4. 取得 `Client ID` 與 `Client Secret`。
5. 依用量選擇方案。官方目前說明訪客僅能以瀏覽器存取基礎服務且每日每 IP 最多 20 次；基礎會員額度與付費點數應以上線當日方案頁為準。
6. 寫入：

   ```dotenv
   TDX_CLIENT_ID="your-client-id"
   TDX_CLIENT_SECRET="your-client-secret"
   ```

7. 伺服器以 `application/x-www-form-urlencoded` POST 到 OAuth token endpoint：

   ```text
   https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token
   ```

   Body 包含 `grant_type=client_credentials`、`client_id`、`client_secret`。
8. 取得 `access_token` 後，以 `Authorization: Bearer ...` 呼叫所選捷運／台鐵／高鐵 OData endpoint。
9. 在 [服務使用流程](https://tdx.transportdata.tw/about/service) 檢查該資料屬於基礎、進階、加值、歷史或機敏服務。機敏資料需額外提出用途並經人工審核。
10. 快取 token 到過期前，不要每個前端請求都重新交換 token。

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

## 為什麼不以 Playwright 抓班次

Playwright 適合測試網站或在獲得允許時自動下載公開檔案，不適合作為主要班次 API：

- 網頁 DOM 與反自動化機制容易改動。
- 登入、驗證碼與使用條款可能禁止自動抓取。
- 頁面顯示值通常缺少穩定站碼、更新時間與資料契約。
- 伺服器成本與錯誤率高於官方 API／GTFS。

只有在營運商明確允許自動化下載、沒有正式 API／feed，且經過授權與 robots／Terms 檢查後，才應加入 Playwright downloader。下載後仍需保存來源 URL、抓取時間、檔案雜湊與解析錯誤，不應悄悄回退到假資料。
