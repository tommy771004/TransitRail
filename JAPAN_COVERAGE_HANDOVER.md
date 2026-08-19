# 日本市場資料覆蓋 — 交接文件

**日期：** 2026-08-19
**分支：** `claude/japan-data-issue-kskj1y`（三個 commit，均已推送）
**範圍：** 日本市場的時刻表覆蓋、車站目錄閘門、以及兩條新的資料取得路徑

---

## 1. 起因

使用者查詢 **西馬込 → 押上**，畫面回「此站尚未收錄時刻表」，並列出 8 個「已收錄時刻表的車站」建議：曙橋、Aoyama Itchome、淺草、淺草橋、Higashi Nihombashi、市谷、神保町、Kokuritsu Kyogijo。

實測後確認兩件事：

1. **西馬込 → 押上 確實沒有資料。** 都營淺草線只抓了「淺草 ↔ 日本橋」這一段。
2. **那份建議清單是錯的。** 8 個裡只有 **淺草** 和 **神保町** 真的查得到；其餘 6 個是中途停靠站，點下去會得到同一則「尚未收錄」。

---

## 2. 診斷結果（修改前的狀態）

### 資料本身是健康的

`src/data/scraped/japan/metadata.json`：

| 項目 | 值 |
|---|---|
| `fetchedAt` | 2026-08-18T22:38:18Z |
| `recordCount` | 11,414 |
| `routeCount` | 13 |
| `failedRoutes` | `[]` |
| 服務日 | 2026-08-19 … 08-25（7 天） |
| 來源 | `jp-odpt-toei`（tier A）、`jp-jr-central`（tier C） |

不是抓取失敗，也不是資料過期。

### 覆蓋範圍極小

13 個檔案 = 都營 4 組站對（雙向 8 檔）+ JR 東海道新幹線 5 檔：

```
淺草 ↔ 日本橋（淺草線）    神保町 ↔ 大手町（三田線）
神保町 ↔ 新宿（新宿線）    新宿 ↔ 六本木（大江戶線）
東京→京都／名古屋／新大阪、新大阪→東京、名古屋→新大阪
```

東京 Metro（銀座線、丸之內線共 3 組站對）**一筆都沒有**：`scripts/scrapers/japan.ts` 在 `ODPT_API_KEY` 未設定時直接跳過所有 `TokyoMetro` 路線，而且不計入 `failedRoutes`，所以 metadata 看起來完全健康。

### 兩套「有沒有資料」的規則互相矛盾

| 函式 | 規則 | 結果（2026-08-19） |
|---|---|---|
| `coveredStationKeys()` | 只認起訖站 | 10 站 |
| `coveredEndpointNames()` | 起訖站 **+ 每筆 `stops`** | 21 站 |

後者餵給了錯誤訊息的建議清單、車站選單與路網圖；前者才是 `findInRoutes()` 真正能回答的集合。ODPT 的列車資料不帶 `legs`，所以那 11 個只出現在 `stops` 裡的站（Kuramae、Asakusabashi、Akebonobashi…）永遠查不到。

---

## 3. 已完成的工作

### `e27c3c2` — 只提供搜尋答得出來的日本車站

**改了什麼**

1. 新增 `endpointNamesForRoute()`（`src/data/scraped/timetableDay.ts`），把「什麼算端點」的規則移到比對器旁邊：
   - 起訖站一律算
   - 中途站**只有**在來源提供了帶 `departureTime` 與 `arrivalTime` 的 `leg` 時才算 — 這正是 `segmentResult()` 願意回答區間查詢的條件
2. `coveredStationKeys()`、`coveredEndpointNames()`、`searchabilityPolicy.addRouteNames()` 三處共用它
3. `countryConfig.japan.authenticityGates.catalog`：`false` → `true`（其他 scraped 市場早就是 `true`）
4. 刪掉 `getStationsForCountry()` 裡因此變成多餘的日本專屬過濾

**影響**

| | 前 | 後 |
|---|---|---|
| 車站選單 | 42 站 | 10 站 |
| 路網圖站點 | 5 線 / 112 點 | 5 線 / 12 點 |
| 建議清單 | 21（11 個是死的） | 10（全部可查） |

目前可查的 10 站：`Tokyo, Shinjuku, Roppongi, Asakusa, Nihombashi, Jimbocho, Otemachi, Nagoya, Kyoto, Shin-Osaka`

未覆蓋的站現在回報 `no_verified_data`（此站尚未收錄），而不是 `unsupported_route`（此路線不通）。轉乘鏈市場不受影響 — 帶 `legs` 的中途站仍然算數。

**回歸測試**
- `src/server/catalog.test.ts`：建議清單裡每個站都必須至少能查出一組班次；路網圖不得出現 `Nishi-magome`
- `src/server/transitSearchReasons.test.ts`：中途站要回報為未收錄

### `776aa3f` — 從聯合時刻表抓山陽新幹線

**關鍵發現：不需要寫 JR 西日本的解析器。** `railway.jr-central.co.jp` 那支 CGI 是「東海道・**山陽**新幹線」的聯合查詢，兩線直通運轉。

- `src/server/jrCentralTimetable.ts`：站表加入 岡山／広島／博多（EUC-JP 百分比編碼），路線集加入以新大阪為軸的 6 組
- 山陽段班次的 `operator` 記為 **JR West**（線路與 さくら／みずほ 是 JR 西日本／九州的），`sourceId` 維持 `jp-jr-central`（誰營運 vs 誰公布是兩件事）
- 服務名對照補上 みずほ／さくら
- **東京→博多故意不加**：每組站對 = 17 次逐時取樣 × 9 個服務日，打在別人家 CGI 上；搜尋本來就能用「東京→新大阪 + 新大阪→博多」串起來

### `709542a` — 從 GTFS-JP 讀日本地方鐵道

- 新來源 `jp-kotoden-gtfs`（tier A、`official-gtfs`），adapter `src/server/japanGtfsJp.ts` 沿用既有 GTFS 機制（`src/server/gtfs/*`）
- **抓取路線由 feed 自己決定**：`scrapeRoutePairs()` 取每條鐵道路線最常見的兩個端點，雙向各一組，站名沿用業者自己的寫法。站名是時刻表與搜尋之間的比對鍵，手抄必錯
- **feed 網址是設定不是常數**（`KOTODEN_GTFS_URL`）。沒設就整個 scraper 不執行 — 與沒有 `ODPT_API_KEY` 時跳過東京 Metro 同一種克制
- 新工具：`npm run inspect:gtfs -- <zip 網址或路徑> --rail-only`，印出路線、端點、完整停站順序，以及可直接貼進 `routes.ts` 的條目

**順帶修掉一個真 bug**

`src/server/gtfs/journeys.ts` 的 `normalizeStation()` 只保留 `[a-z0-9]`，因此**任何沒有 ASCII 字母的站名都會正規化成空字串**，而空字串與 feed 裡每一個站都「完全相等」。查 高松築港 → 琴電琴平 會回傳 06:00→06:06（那是瓦町的時間），反向班次也被當成正向。現已改為 Unicode 字元類並補上回歸測試。

> 目前上線市場都是拉丁字母拼寫，**沒有實害**；但任何日／韓／中的 GTFS feed 接進來都會產出看起來正常的錯誤時刻。

另外把「把已抓到的站名併回選單」從 Korea 專屬改成所有靜態選單市場通用，否則 feed 帶進來的站有資料卻選不到。

### 3.4（本次）ODPT 逐站時刻 → `legs`，站對改為整線端點

原 §4.1。ODPT 的 `odpt:trainTimetableObject` 本來就給每班車**逐站**的時刻，之前只取起訖兩點、中間只留站名，所以中途站永遠不是端點。**已對著真實 API 驗證並落地資料。**

**改了什麼**

1. `src/server/odptTimetable.ts`
   - 每一跳寫成一筆 `leg`（官方的到發時刻，沒有任何內插）。來源沒給時刻的那一跳直接不寫，於是跨越它的區間查詢也答不出來 — 這是對的
   - 站名改用**線路圖的寫法**（`Higashi-nihombashi`，不再是由 ID 推出來的 `Higashi Nihombashi`）。站名是時刻表與搜尋之間的比對鍵，選單給的拼法答不出來的名字等於沒收錄
   - 站別比對改用羅馬拼音正規化（去掉大小寫、連字號、ID 前綴）。設定裡的 ID 拼法猜錯也仍然對得上，而不是安靜地抓不到東西
2. `src/data/scraped/timetableDay.ts`
   - `segmentResult()` 可以跨**連續同線**的多個 leg 組成區間：出發取第一段的發車、抵達取最後一段的到達，兩個都是業者給的時刻。中間斷掉或換線就不組（換線是轉乘，該走 `chainResults` 的轉乘規則）
   - `findInRoutes()` 新增「同一條路線的直達區間」分支：站點圖只連相鄰站，藏前 → 日本橋 這種不相鄰的組合以前會掉進轉乘鏈，然後因為轉乘時間為 0 被打掉。同一班車不是轉乘
   - `dedupeDepartures()`：同一班車同時出現在整線檔與區間檔時只發佈一次（見下）
3. `src/data/odptRoutes.ts`：站對重寫，**每一組都用真實 feed 驗證過**
4. `src/data/stations.ts`：都營各線端點補進 `japanStations`，`audit-station-mapping` 名稱不符從 26 降為 0
5. `src/components/TripDetails.tsx`：`direct` 的班次若帶多個 leg，收合回一段行程並把逐站當成停站表。否則時間軸會把一趟地鐵畫成十八次轉乘

**站對怎麼定出來的（不是猜的）**

先把四條都營線的 weekday 班表抓下來，統計每班車真正的頭尾站，再照統計結果設定：

| 線 | 站對 | 為什麼 |
|---|---|---|
| 淺草線 | 西馬込 ↔ 押上 | 全線 20 站 |
| 淺草線 | 泉岳寺 ↔ 押上、西馬込 ↔ 泉岳寺 | 516 班裡只有 135 班跑完全程，其餘是京急／京成直通、在泉岳寺折返。少了這兩組，淺草 → 日本橋 的班次會從 196/天 掉到 68/天 |
| 大江戶線 | 光丘 ↔ **新宿西口** | 「6」字形：直通運轉是 光丘…都廳前…繞完環…都廳前。班車讀到**第一次**停靠終點站為止，所以 光丘 ↔ 都廳前 只會拿到支線的 11 站；改用環上最後一站新宿西口，兩個方向都拿到完整 38 站 |
| 新宿線 | 新宿 ↔ 本八幡 | 396 班裡 369 班跑完全程 |
| 三田線 | 西高島平 ↔ 目黑、西高島平 ↔ 白金高輪 | 131 班在白金高輪折返 |

光丘 → 都廳前 仍然答得出來，而且答的是**支線那段 21 分鐘的短程**：區間比對讀到第一次停靠都廳前就停，不會把繞一圈的 80 分鐘當成答案。

**實際抓下來的結果**（2026-08-19 執行，`failedRoutes: []`）

| | 前 | 後 |
|---|---|---|
| 可查車站 | 10 | **106** |
| 西馬込 → 押上 | 此站尚未收錄 | 67 班/天 |
| 淺草 → 日本橋 | 約 196 班/天 | 196 班/天（持平） |
| 藏前 → 日本橋 | 此站尚未收錄 | 187 班/天 |
| 路網圖 | 5 線 / 12 點 | 都營 4 線 106 點 + 東海道／山陽新幹線 |

順帶清掉 8 個舊站對的孤兒檔（`asakusa-nihombashi.json` 等）：新檔涵蓋同樣的服務日與同樣的班次，實測移除前後答案完全一致，而且沒有任何 scraper 會再更新它們。

**代價（實測，不是估計）**

- `src/data/scraped/japan` 從 6 MB 變成 **114 MB**。大江戶線一列帶 37 個 leg ≈ 9.8 KB
- 啟動載入 1.0 秒、heapUsed 188 MB、RSS 348 MB（原本整包 scraped 資料才 14 MB）
- 單次搜尋約 140 ms（查無資料的最壞情況 213 ms）

同樣的逐站時刻若改存與 `stops` 對齊的兩個字串陣列，JSON 約是 1/3.5。**這是目前最大的未決項。**

### 3.5（本次）§4.3 已驗證：山陽新幹線抓得到

`railway.jr-central.co.jp` 的聯合時刻表 CGI **確實回答山陽站對**，不需要另寫 JR 西日本解析器：

- 新大阪 → 博多 16 班（06:00→08:28 みずほ 601 等），operator 記為 JR West
- 岡山 → 新大阪 17 班
- 山陽新幹線已自動出現在路網圖（新大阪／岡山／広島／博多）

**已知問題（不是這次造成的）**：中間站對會回傳繞路的轉乘鏈。岡山 → 広島 目前答 06:00→08:28「みずほ 601 → のぞみ 2」，其實是先往東回新大阪再往西。**京都 → 名古屋 早就是同樣情形**（經東京，4 小時 39 分），這是 JR 檔案只有站對兩端、沒有逐站時刻的結構性後果。兩種解法：補抓 岡山↔広島、広島↔博多、岡山↔博多（每組 ×9 天 ×17 次取樣），或讓轉乘鏈拒絕「轉乘站不在起訖之間」的路徑。

---

## 4. 待辦事項（依投報率排序）

> §4.1（ODPT 逐站時刻 → `legs`）已實作，見 §3.4。

### 4.2 申請 ODPT 金鑰

免費註冊 → `ODPT_API_KEY` 設進 CI secret。`jp-odpt-tokyo-metro` 早已登記在 `sourceRegistry.ts`，程式一行都不用改，銀座線與丸之內線就會開始有資料。金鑰同時解鎖 Metro 全九線與其他事業者（JR 東日本關東在來線、各私鉄）。

申請步驟見 `docs/transit-provider-setup.md` 的「日本：ODPT」。

### ~~4.3 驗證山陽新幹線是否真的抓得到~~ — 已完成，見 §3.5

原文保留如下。

`776aa3f` 的 6 組站對**尚未跑過真實網路**（見 §6）。跑一次 `npm run scrape:japan` 後：

- 有資料 → 山陽新幹線線路會自動出現在路網圖（岡山／広島／博多 進入可查清單）
- 沒資料 → 表示該 CGI 拒答山陽站對，此時才需要寫 JR 西日本的解析器（tier 一樣是 C）

失敗不會弄壞任何東西：沒有檔案 = 沒有覆蓋 = 該線維持隱藏。

### 4.4 補齊 ことでん 設定

1. 從[業者開放資料頁](https://www.kotoden.co.jp/publichtm/gtfs/index.html)取得**鐵道**（非巴士）GTFS zip 的實際網址
2. 讀該檔授權條款，把授權字串補進 `src/data/sourceRegistry.ts` 的 `jp-kotoden-gtfs.attribution`（目前刻意留空 — 憑記憶寫的授權不是授權）
3. `KOTODEN_GTFS_URL="https://.../feed.zip"` 設進環境
4. `npm run inspect:gtfs -- <網址> --rail-only` 確認路線與站名
5. **把線路與站名加進 `src/data/stations.ts` 的 `japanRailLines`**，否則只有搜尋與車站選單看得到，瀏覽用的路網圖不會出現 ことでん。若要獨立分區，在 `countryConfig.japan.marketTopology.regions` 加一個 `lineIdPrefixes: ["kotoden-"]` 的區域；不加的話會落進預設的 `japan-intercity`（語意不太對）

### 4.5 其他來源（尚未動工）

| 來源 | 解鎖什麼 | 成本 |
|---|---|---|
| JR 東日本（經 ODPT） | 關東在來線 GTFS + 駅時刻表 + 列車位置 | 需金鑰；不含新幹線；歷來綁年度 Challenge 條款 |
| 各私鉄（東急、京王、小田急、京急、東武、西武） | 東京私鉄網 | 同一把 ODPT 金鑰 |
| JR 西日本自有頁面 | 山陽新幹線（僅在 §4.3 失敗時才需要） | 新解析器，tier C |

---

## 5. 檔案地圖

| 檔案 | 角色 |
|---|---|
| `src/data/scraped/timetableDay.ts` | `endpointNamesForRoute()` — 「什麼算端點」的唯一規則；`findInRoutes()` 比對器與同線區間 |
| `src/data/stationCoverage.ts` | 覆蓋集合、選單過濾、`no_verified_data` 的判定依據 |
| `src/data/searchabilityPolicy.ts` | 搜尋／目錄／發佈共用的決策接縫 |
| `src/data/countries.ts` | `countryConfig.japan` — 目錄閘門、市場拓撲、搜尋視窗 |
| `src/server/catalog.ts` | 路網圖與車站選單的組裝與裁切 |
| `src/data/odptRoutes.ts` | 都營／東京 Metro 的站對清單 — 每條線一組整線端點 |
| `src/server/odptTimetable.ts` | ODPT JSON → `TransitResult`，逐站時刻寫成 `legs` |
| `src/server/jrCentralTimetable.ts` | 東海道・山陽新幹線 CGI 解析 |
| `src/server/japanGtfsJp.ts` | GTFS-JP 地方鐵道 adapter |
| `scripts/lib/gtfsFeedSummary.ts` | 從 feed 推導路線／端點／停站順序 |
| `scripts/inspect-gtfs-feed.ts` | `npm run inspect:gtfs` CLI |
| `scripts/scrapers/japan.ts` | 三個日本 scraper：ODPT、JR 東海、GTFS-JP |
| `src/data/sourceRegistry.ts` | 來源登記簿 — 沒登記的來源不得產生可搜尋班次 |

---

## 6. 環境限制與驗證方式

**這個開發沙箱沒有對外網路。** `api-public.odpt.org`、`kotoden.co.jp`、甚至 `railway.jr-central.co.jp` 都是 proxy 403。這是 repo 早就記錄過的狀況（`TIMETABLE_SOURCES.md` §「Verification without network access」），既有做法就是：

> 對著 fixture 開發，讓排程跑真值當整合測試。

因此 **`776aa3f` 與 `709542a` 都沒有落地任何真實班次**。兩者都以 fixture 驗證解析與路線推導，第一批真資料會在下次抓取（或設定好 URL 後）才出現。`e27c3c2` 加的嚴格閘門讓這件事是安全的：沒有資料的線與站一律隱藏，不會出現「看得到卻查不到」。

### 指令

```bash
npm run lint            # typecheck + 531 tests（必過閘門）
npm run validate:data   # 資料完整性；目前只剩既有的 3 個 Singapore 警告
npm run scrape:japan    # 單一市場抓取，視窗同夜間任務
npm run inspect:gtfs -- <zip> --rail-only
npx tsx scripts/audit-station-mapping.ts   # 選單 vs 資料的名稱對照
npm run audit:sources   # 重新產生 SOURCE_COVERAGE.md
npm run catalog         # 重新產生 public/catalog/*.json
```

### 陷阱

- **`npm run audit:sources` 會即時打各家 provider。** 重跑一次，UK／HK／TH／CH 那幾列會跟著當下網路狀況漂移，跟你的改動無關。`e27c3c2` 那次已知只有 japan 那列（`105/168` → `10/168`）是本次造成的。夜間任務**不會**自動重跑這份檔案。
- **`npm run sitemap` 會產生大量 `lastmod` 漂移**，與程式改動無關；除非路由真的變了，否則不要一起 commit。
- **`src/server/providerStationResolution.test.ts`** 有一個測請求節奏的案例，在整套測試同時跑時偶爾會因負載而失敗；單獨重跑會過。
- **JR 東海 CGI 的請求量**：每組站對每個服務日 17 次請求。目前 11 組 × 9 天 ≈ 1,700 次／完整輪。再加站對前先想清楚。
- **嚴格閘門的反面**：抓取失敗現在是「安靜地隱藏」。要確認某條線是否真的活著，看 `src/data/scraped/japan/metadata.json` 的 `routes[]`，不要只看 UI。

---

## 7. 交接檢查清單

- [ ] 申請 ODPT 金鑰，設定 `ODPT_API_KEY`（§4.2）
- [x] 跑一次 `npm run scrape:japan`，確認山陽新幹線 6 組站對有沒有回資料（§3.5：有）
- [ ] 取得 ことでん GTFS zip 網址與授權，設定 `KOTODEN_GTFS_URL`、補 `attribution`、加線路目錄（§4.4）
- [x] 實作 ODPT 逐站時刻 → `legs`，並把 `odptRoutes.ts` 改成整線端點（§3.4）
- [x] 確認四條都營線的中途站真的可查（106 站），`audit-station-mapping` 名稱不符 0 筆
- [ ] 決定逐站時刻的存法：維持 `legs`（114 MB）或改存精簡陣列（約 1/3.5）（§3.4 代價）
- [ ] 決定中間站對的繞路轉乘鏈怎麼處理（§3.5 已知問題）
- [ ] 上述任一項落地後：`npm run validate:data`、`npm run audit:sources`、`npm run catalog`
