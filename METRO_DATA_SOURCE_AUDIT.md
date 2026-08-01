# 五國軌道時刻資料源稽核（2026-08-01）

稽核日期：2026-08-01（Asia/Taipei）

範圍：附圖中的韓國、新加坡、泰國、中國、日本。本文分開判斷：

1. TransitRail 現有路線能否改成真實逐班時刻；
2. 該國是否另有可取得的城市地鐵資料。

所有連線測試均為低頻、唯讀 GET；未繞過登入、驗證碼或存取限制。

## 結論

| 國家 | 真實逐班資料 | 首末班／班距 | 對現有路線的價值 | 建議 |
| --- | --- | --- | --- | --- |
| 韓國 | **有**：首爾地鐵官方 CSV/API；KTX 有 TAGO API（需 key） | 有即時 ETA | 首爾資料不能直接替代目前 9 條 KTX 路線 | 第一優先接首爾 CSV；KTX 另申請 TAGO |
| 日本 | **有**：Tokyo Metro ODPT JSON（需 token）、Toei public ODPT JSON（免 token）；JR Central 新幹線官方 PDF | 有 | ODPT 適合地鐵；JR PDF 可覆蓋部分現有新幹線路線 | 第二優先；Toei 可先行，Tokyo Metro 需 key |
| 中國 | 技術上可從 12306 網頁 session 取得高鐵逐車次，但不是公開 API | 北京等城市官網有首末班 | 可覆蓋目前 4 條高鐵，但反爬與維護風險高 | 不建議作正式 provider，除非接受脆弱性 |
| 新加坡 | 未找到官方逐班 departure/ETA | SMRT 有首末班；LTA 只有事故警報 | 不能替代目前合成逐班資料 | 改成首末班／頻率產品，不應生成假 departures |
| 泰國 | 未找到官方完整逐班 departure/ETA | BEM/BTS 有首末班與 headway | 不能替代目前合成逐班資料 | 擴大官方 advisory，維持頻率呈現 |

附圖的分類只描述「目前程式怎麼做」，不能解讀成「外部沒有資料」。至少韓國首爾地鐵、日本東京地鐵，以及部分日本新幹線都有可用的第一方時刻來源。

## TransitRail 現況

- 日本 23 條：`JapanScraper` 在程式內以固定 30 分鐘（新幹線）或 10 分鐘（東京通勤線）生成班次。
- 韓國 9 條：是 KTX/ITX 城際路線，不是首爾地鐵；`SnapshotScraper` 只重蓋日期。
- 新加坡 4 條、泰國 4 條：地鐵 snapshot，以固定 10 分鐘班距生成。
- 中國 4 條：北京南—上海虹橋等高鐵路線，不是城市地鐵；snapshot 只重蓋日期。
- 泰國另有 BEM 官方首末班 artifact，但目前只支援 `Sukhumvit → Hua Lamphong`，不能產生完整逐班旅程。

目前 committed 七日資料的列數精確符合固定 headway 公式；它們不是業者每日實際班表。

## 實際連線與資料形狀

### 韓國

#### 首爾地鐵靜態時刻 CSV：可用，免 key

官方資料集：[서울교통공사_서울 도시철도 열차운행시각표](https://www.data.go.kr/data/15098251/fileData.do)

- 官方頁明載涵蓋首爾都市鐵道 1–9 號線，欄位包含車站、方向、列車代碼、到站與發車時間。
- 頁面明載檔案資料可免登入下載。
- 2026-06-16 檔案實測 HTTP 200，32,806,139 bytes，CP949/EUC-KR，424,264 筆資料列。
- 實測站點涵蓋：市廳 2,665 列、忠正路 2,305 列、清涼里 1,348 列、乙支路入口 1,263 列、首爾站 2,674 列。
- 330,394 / 424,264 列可直接對應目前 station menu。

但現有 parser 尚不能直接吃最新版檔案：官方欄名是 `주중주말`（平假日）與 `열차코드`（列車代碼），現有 `COLUMN_HINTS` 未包含這兩個名稱。實測結果為 `runs=0`，424,264 列全部以 `no 열차번호 column` 丟棄。資料源可用，接入前需先補欄名兼容並用真實檔做 regression test。

#### 首爾 API：可用，正式環境需 key

官方說明：[SearchSTNTimeTableByFRCodeService](https://data.seoul.go.kr/dataList/datasetView.do?infId=OA-110&serviceKind=1&srvType=A)

sample 端點實測 HTTP 200，市廳站平日上行共 244 筆，回應含 `TRAIN_NO`、`ARRIVETIME`、`LEFTTIME`。另有官方即時到站 sample，回傳 `barvlDt` ETA 秒數與到站訊息。正式使用需要 Seoul Open API key。

#### KTX／城際

官方資料集：[국토교통부_(TAGO)_열차정보](https://www.data.go.kr/data/15098552/openapi.do)

TAGO 是目前 9 條 KTX/ITX 路線較正確的接點，但需要 data.go.kr service key。本機未配置 key，因此本次不能驗證正式回應。首爾地鐵 CSV 不可拿來替代 KTX 路線。

### 日本

#### Tokyo Metro / Toei：官方 JSON；Toei public API 免 token

- [Tokyo Metro StationTimetable](https://ckan.odpt.org/en/dataset/r_station_timetable-tokyometro)
- [Tokyo Metro TrainTimetable](https://ckan.odpt.org/en/dataset/r_train_timetable-tokyometro)
- [Toei Station timetable](https://ckan.odpt.org/dataset/r_station_timetable-toei)
- [ODPT developer registration](https://developer.odpt.org/)

ODPT catalog 明確提供 `odpt:StationTimetable` 與 `odpt:TrainTimetable` JSON。Tokyo Metro 正式呼叫要以 `acl:consumerKey` 帶入註冊後 token；無 token 實測 HTTP 403。Toei 另有免 token 的 `api-public.odpt.org/api/v4` 官方端點，實測 Oedo Line 平日可取得完整逐站列車時刻。

這是可用的東京地鐵來源，但不等於目前 app 內的 JR 通勤線與新幹線。若保留現有站名與路線，需做 operator/route 重新對應。

JR East 在 ODPT Challenge 2026 也有部分關東在來線時刻，但官方明確排除新幹線，且是 challenge-limited license：[JR East station timetable](https://ckan.odpt.org/en/dataset/jreast__r_station_timetable)。不宜未審授權便當成長期 production feed。

#### JR Central 新幹線 PDF：可抓、免 key

官方入口：[JR Central Timetable](https://global.jr-central.co.jp/en/info/timetable/index.html)

頁面與東／西行 PDF 實測 HTTP 200，PDF 約 4.9 MB，包含個別新幹線車次與停站時間。這比目前固定 30 分鐘生成可靠，可覆蓋東海道／山陽新幹線的一部分現有路線；但官方標示為 basic timetable，季節性與臨時加班車不一定完整。實作應版本化下載、保留 snapshot fallback，並在 UI 標示資料範圍。

### 新加坡

官方文件：[LTA DataMall API User Guide](https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf?ref=public_apis)

- `TrainServiceAlerts` 只提供服務是否中斷、受影響路線與車站；沒有逐班 departure 或 ETA。
- DataMall dynamic API 需要註冊 AccountKey。無 key 實測 404；送入無效 key 後回 401。
- SMRT 公開 CDN 的 station HTML 實測 HTTP 200，可取得平日／週末／假日的首末班，例如 Jurong East 與 Woodlands；不含逐班到站。

因此可把現有硬編碼服務時間改成官方首末班資料，但沒有證據支持產生「每 10 分鐘一班」的完整 departure list。

### 泰國

- [BEM official fare/first-last page](https://metro.bemplc.co.th/Fare-Calculation?lang=en)
- [BTS official timetable/frequency page](https://btsapp1.bts.co.th/website/eng/traintime-frequency/)

BEM 頁實測 HTTP 200、約 172 KB，包含當日 Blue/Purple Line 各站雙方向首末班；HTML 中辨識到 250 個時間欄位。BTS 官網提供各站首末班與時段班距，並明確稱為 approximate service interval。

兩者都適合 service-day advisory、首末班與 frequency UI，不足以建立每一班列車的 departure/arrival。現有 BEM parser 已證明 HTML 可自動化，但 coverage 應擴大，不應把首末班資料內插成假班次。

### 中國

#### 現有高鐵路線：12306 技術可行，但不穩定

官方入口：[中國鐵路 12306](https://kyfw.12306.cn/index)

實測以一般網頁流程先建立 session cookie，再呼叫 left-ticket 查詢；endpoint 會從 `query` 動態導向 `queryG`。北京—上海查詢回 HTTP 200 JSON，含逐車次、出發、到達、歷時與餘票，例如 G531、G1、G3。

但這不是公開 developer API，需要 cookie、Referer、XHR header，endpoint 可動態切換且具反爬限制。單純無 session 呼叫曾回「網路可能存在問題」。結論是「技術上抓得到」，不是「適合穩定 production」。若採用，必須低頻、嚴格快取、提供 snapshot fallback，並先審查使用條款與營運風險。

#### 城市地鐵

[北京地鐵官方網站](https://www.bjsubway.com/) 的站點頁實測 HTTP 200（GB18030），可讀取各方向首末班；網站雖有「列車時刻表」頁，測到的完整時刻圖片 URL 已失效。上海官方 service 頁在本環境 timeout。

中國沒有一個可直接代表全國城市地鐵的統一官方 feed。可按城市抓首末班，但不能據此把目前 12306 高鐵路線標成「地鐵時刻」。

## 建議實作順序

1. **韓國首爾地鐵 CSV**：先加入 `주중주말`、`열차코드` 欄名兼容，對 2026-06-16 真實檔建立 regression test，再把既有 `seoulSubwayTimetable` 接進 scraper/search。這是最可靠、免 key、資料最完整的改進。
2. **日本 ODPT**：先接免 token 的 Toei public API；Tokyo Metro 配置 token 後再啟用。不要假稱它覆蓋現有新幹線。
3. **日本 JR Central PDF**：以官方 basic timetable 替換能對應的東海道／山陽新幹線固定 30 分鐘資料。
4. **泰國／新加坡／中國城市地鐵**：把 UI 改成官方首末班與班距，不再列出合成逐班 departures。
5. **KTX TAGO／12306**：分別處理。TAGO 是有文件的 key-based API；12306 是脆弱網頁整合，風險層級不同。

## 驗證紀錄

- 韓國已接入既有每日排程：排程下載官方 CSV，驗證後寫入 `seoul-subway-timetable.json.gz`；旅客搜尋只讀本地 artifact，不連外。
- 2026-08-01 真實檔產出 279 個 artifact stations、12,314 個 runs；`Seoul Station → City Hall` 平日離線查得 244 班。
- 日本已接入 Toei 免 token ODPT 排程；2026-08-03 的 6 個方向已寫入本地 JSON，`Shinjuku → Roppongi` 查得 212 班。
- Tokyo Metro 已實作 key gate；未設定 `ODPT_API_KEY` 時不發出必然失敗的請求，也不生成替代班次。
- 全量 `npm run lint`：34 test files、217 tests 全數通過；`npm run build` 成功；站名 audit 為 0 mismatches。
- JR Central PDF、SG/TH/CN advisory-only 改造、KTX TAGO／12306 尚未實作；限制與理由保留在上方各節。
