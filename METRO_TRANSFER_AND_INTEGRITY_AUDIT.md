# 地鐵資料真實性與跨線轉乘稽核（2026-08-01）

稽核日期：2026-08-01（Asia/Taipei）
稽核對象：`src/data/scraped/` 已提交資料、`src/data/scraped/timetableDay.ts` 轉乘鏈接、各國靜態線路拓撲
事實基準：維基百科路線圖與換乘站清單，換乘站層級

相關文件：[`METRO_DATA_SOURCE_AUDIT.md`](METRO_DATA_SOURCE_AUDIT.md) 評估的是**外部有沒有真實資料可接**；本文評估的是**已經提交進 repo 的資料有多真、以及轉乘邏輯對不對**。兩者互補不重複。
後續文件：[`.scratch/metro-data-integrity/spec.md`](.scratch/metro-data-integrity/spec.md)（依本文結論撰寫的實作 spec）

---

## 摘要

三句話：

1. **repo 的線路拓撲品質，遠高於它的時刻表品質。** 新加坡有 145 站、25 個換乘站，全部正確；首爾有 279 站、49 個換乘站，全部正確；港鐵有 21 個換乘站，全部正確。這些是紮實的資產。
2. **但轉乘邏輯完全不讀這些拓撲。** `findRoutePaths` 只用路線檔的起訖點當圖的節點，首爾的轉乘搜尋要求同一班車服務起訖站。上述 95 個正確的換乘站，**一個都沒有被用到**。
3. **而時刻表資料裡，真正是實測的只有兩個網路**（首爾、波士頓），其餘不是固定班距生成的，就是把單一時刻的即時快照貼到七個日期。

---

## 第一部分：資料真實性

### 判定結果總表

| 網路 | 來源標籤 | 每日筆數 | 判定 | 依據 |
| --- | --- | --- | --- | --- |
| **首爾地鐵** | Seoul Metro official timetable CSV | 12,314 車次 | ✅ **實測** | 官方 CSV + sourceSha256；279 站、Line 1–9；平日 4,670／週六 3,823／週日假日 3,821 三型分開 |
| **波士頓 MBTA** | `api-v3.mbta.com` | 144 | ✅ **實測（有瑕疵）** | 服務日正確：週日首班 06:15、平日 05:30。瑕疵見下 |
| **倫敦 TfL** | `api.tfl.gov.uk` | 3 | ⚠️ **僅當天為真** | 未來六天是同一次抓取的漂移快照 |
| **香港港鐵** | MTR curated snapshot fallback | 當天 4／其餘 378 | ⚠️ **當天為真但殘缺** | 當天 live 覆蓋掉全日班表；其餘六天為合成 |
| **新加坡 MRT** | LTA curated snapshot | 109 | ❌ **合成** | 固定班距、單一 duration、單一票價 |
| **曼谷 BTS/MRT** | BTS/MRT curated snapshot | 109 | ❌ **合成** | 同上 |
| **東京 Metro／都營** | `JapanScraper` 程式內生成 | — | ❌ **合成** | 程式內固定 10 分班距 |
| **中／德／法／比／挪／瑞／馬 地鐵** | — | 0 | ❌ **無資料** | repo 內無任何該國地鐵資料 |

### 1.1 倫敦 TfL：七天資料全部是同一個早上的實況

`united_kingdom/leicester-square-camden-town.json` 的全部 21 筆：

```
8/1  09:25 09:29 09:31
8/2  09:29 09:33 09:36
8/3  09:31 09:34 09:37
8/4  09:34 09:37 09:39
8/5  09:34 09:37 09:39
8/6  09:37 09:39 09:42
8/7  09:37 09:39 09:42     ← 全部 realtime: true
```

每天往後漂 2–3 分鐘。這不是複製，是同一次 scrape 對七個日期各呼叫一次 TfL API，每次都拿到「此刻的下三班」，而牆上時鐘在這七次呼叫之間走了十幾分鐘。

id 直接把證據寫在裡面——`2026-08-05-uk-tfl-2026-08-01T08:37:00-0`：**日期前綴是 8/5，內嵌時間戳是 8/1。**

嚴重度：**高**。使用者查未來日期，看到的是過去的實況，而且介面聲稱它是即時的。

### 1.2 香港港鐵：live 抓取覆蓋掉當天的全日班表

`hong_kong/central-tsuen-wan.json` 每日筆數：

```
8/1: 4      ← 今天
8/2: 378
8/3: 378 ... 8/7: 378
```

當天那 4 筆涵蓋 **15:27–15:35**，共八分鐘。早上或晚上查中環→荃灣，一片空白。

成因：`ProviderBackedScraper` 先試 live adapter，`BaseScraper.saveRoute` 以「取代當天切片」的方式合併，於是 live 回傳的 4 筆「下班車」蓋掉了 curated 的 378 筆。

附帶問題：那 4 筆的 `source` 寫 `MTR curated snapshot fallback`，卻標 `realtime: true`——來源標籤與真實性標記互相矛盾。同一批 live 資料還混進了未來日期，造成 8/2 有 83 組間隔 0 分鐘的重複班次。

嚴重度：**高**。使用者最常查的就是當天。

### 1.3 新加坡與曼谷：完全合成

各 109 筆／日 × 7 天完全相同，單一 duration、單一票價：

| 路線 | duration | 票價 | direct |
| --- | --- | --- | --- |
| Changi Airport → Jurong East | 55 分 | S$2.30 | false（轉乘 Tanah Merah） |
| HarbourFront → Punggol | 33 分 | S$1.99 | true |
| Jurong East → Raffles Place | 32 分 | S$1.79 | true |
| Woodlands → Orchard | 38 分 | S$2.09 | true |
| Mo Chit → Hua Lamphong | 28 分 | ฿42 | false（轉乘 Chatuchak Park） |
| Siam → Mo Chit | 14 分 | ฿33 | true |
| Siam → Saphan Taksin | 12 分 | ฿30 | true |
| Sukhumvit → Hua Lamphong | 16 分 | ฿33 | true |

`isIndicativeTimetable()` 已經正確判定這些為 indicative，**但只用在 SEO 預渲染頁**。App 內的結果畫面仍以逐班時刻呈現。Google 看到的是誠實的「服務時段＋班距」，App 使用者看到的是 109 筆長得像真班表的東西。這個落差本身是獨立的 finding。

### 1.4 數值抽查

抽查對象為深查網路，重點放在 `scripts/lib/llmTransfer.ts` 可能寫入的轉乘值。

| 項目 | repo 值 | 對照 | 判定 |
| --- | --- | --- | --- |
| Mo Chit → Hua Lamphong 轉乘站 | Chatuchak Park | BTS Mo Chit 與 MRT Chatuchak Park 確為同一轉乘點（兩系統名稱不同） | ✅ **正確** |
| Changi Airport → Jurong East 轉乘站 | Tanah Merah | EWL 樟宜機場支線確實在 Tanah Merah 併入本線 | ✅ **正確** |
| 港鐵 中環→荃灣 車程 | 30 分 | 荃灣線全程約 30 分 | ✅ 相符 |
| 新加坡票價 S$1.79 / S$1.99 / S$2.09 / S$2.30 | — | 新加坡距離制票價實際以 5 分為級距，不會落在 1.79 這種值 | ⚠️ **形狀可疑**，疑為公式推算 |
| 曼谷 ฿30 / ฿33 / ฿42 | — | BTS 單程票階梯確實落在此區間 | 〜 合理但無法逐筆驗證 |

LLM 產出的兩個轉乘站經查**都正確**。但這不能推翻風險判斷：`llmTransfer.ts` 的驗證只要求「換乘站在站名清單內」與「總分鐘數 ±40%」，一個地理上錯誤的換乘站完全可以通過。目前正確是運氣好，不是機制保證。

### 1.5 波士頓 MBTA 的兩個瑕疵

`south-station-harvard.json`：

```
8/1 Sat  n=563  05:30–21:44   ← 563 = 144 的重複累積
8/2 Sun  n=144  06:15–21:44   ← 週日首班 06:15，正確
8/3–8/7  n=144  05:30–16:58   ← 平日五天完全相同，正確
```

- **週六重複累積**：563 筆 vs 實際應為 144 筆
- **平日末班截斷在 16:58**：紅線實際營運至凌晨一點，晚間班次整段消失，疑似 API 分頁上限

服務日邏輯本身是對的（週日首班晚於平日，符合 MBTA 實況）。

---

## 第二部分：跨線轉乘

### 2.1 核心缺陷：轉乘鏈接不讀線路拓撲

`findRoutePaths`（`src/data/scraped/timetableDay.ts:169`）建圖時，節點只有**路線檔的 `origin` 與 `destination`**：

```ts
.flatMap((route) => [
  { route, from: route.origin, to: route.destination, reversed: false },
  { route, from: route.destination, to: route.origin, reversed: true },
]);
```

中途停站（`result.stops`）完全不參與。後果：

**港鐵**的四個路線檔是 `Central↔Tsuen Wan`、`Admiralty↔Tsim Sha Tsui`、`Tung Chung↔Sunny Bay`、`Hong Kong↔Airport`。**荔景**是荃灣線與東涌線的真實換乘站，它存在於 `Central↔Tsuen Wan` 的 `stops` 陣列裡，但因為不是路線檔的端點，荃灣線與東涌線**永遠無法在荔景銜接**。

同時 `src/data/hongKongMtr.ts` 裡有一份完整且正確的港鐵拓撲，`findMtrJourney` 在 live 查詢時會用它——但 scraped 資料的鏈接完全不碰它。**兩套拓撲，只有一套被用。**

### 2.2 首爾：資料完整正確，但轉乘搜尋用不到

artifact 實測內容：**279 站、12,314 車次、Line 1–9、三種服務日**。從車次停站序列反推，artifact 內含 **49 個換乘站**，抽驗全部與維基相符：

| 換乘站 | 線路 |
| --- | --- |
| Jongno 3(sam)-ga 鍾路三街 | Line 1, 3, 5 |
| Dongdaemun History & Culture Park 東大門歷史文化公園 | Line 2, 4, 5 |
| Express Bus Terminal 高速巴士客運站 | Line 3, 7, 9 |
| Seoul Station 首爾站 | Line 1, 4 |
| Sadang 舍堂 | Line 2, 4 |
| Chungmuro 忠武路 | Line 3, 4 |
| Wangsimni 往十里 | Line 2, 5 |
| Yeouido 汝矣島 | Line 5, 9 |
| Sindorim 新道林 | Line 1, 2 |
| Jamsil 蠶室 | Line 2, 8 |
| …（共 49 個） | |

但 `searchSeoulSubwayArtifact`（`src/data/seoulSubwayArtifact.ts:170-171`）的篩選條件是：

```ts
const from = calls.findIndex((call) => call[0] === originIndex);
if (from < 0 || !calls.some((call, index) => index > from && call[0] === destinationIndex)) continue;
```

**要求同一個車次同時經過起訖站。** 因此江南（2 號線）→ 首爾站（1／4 號線）回傳空陣列。這 49 個換乘站沒有任何一個被使用。

首爾是 repo 內唯一完全可信的地鐵資料集，卻連最基本的跨線查詢都做不到。**這是本次稽核最重要的單一發現。**

### 2.3 換乘推導靠站名字串相同，跨系統異名一律失效

`buildLines`（`src/data/metroLines.ts:19`）以「站名完全相同」推導換乘。`transferPlanner.ts` 的註解已自承此限制。實測後果：

**曼谷**——repo 原先只推導出 4 個換乘站（Phaya Thai、Siam、Bang Wa、Tao Poon），全部是兩系統同名的情況。維基確認的真實換乘點中，以下原本**全部漏失**，因為 BTS 與 MRT 對同一轉乘點使用不同名稱：

| BTS 站名 | MRT／ARL 站名 | repo |
| --- | --- | --- |
| Asok | Sukhumvit | ❌ 漏失 |
| Sala Daeng | Si Lom | ❌ 漏失 |
| Mo Chit | Chatuchak Park | ❌ 漏失 |
| Ha Yaek Lat Phrao | Phahon Yothin | ❌ 漏失 |
| Samrong | （MRT Yellow） | ✅ **已修**（2026-08-02 補上 MRT Yellow 線） |
| Wat Phra Sri Mahathat | （MRT Pink） | ✅ **已修**（2026-08-02 補上 MRT Pink 線） |

> **修訂（2026-08-02）：** 別名對照已建立（`stationAliases.ts`），`buildLines` 經別名解析推導換乘；MRT Pink 與 Yellow 兩條線的完整站序也已補入。曼谷現為 **7 線／176 站／17 換乘站**（原 5 線／119 站／4 換乘站），上表所有漏失皆已解決。泰國目前仍在嚴格門檻下隱藏，因此這些換乘要等接上真實時刻表後才對使用者可見。

諷刺的是，`thailand/mo-chit-hua-lamphong.json` 這個 **curated 檔案裡寫對了** Mo Chit→Chatuchak Park 的轉乘，但線路拓撲推不出來。真實世界的知識被寫進了資料，卻沒有進入拓撲。

**港鐵**——`Central`（荃灣線／港島線）與 `Hong Kong`（東涌線／機場快線）是站外行人通道連通的同一個轉乘點，但因為名稱不同，repo 視為兩個無關車站。`Tsim Sha Tsui` ↔ `East Tsim Sha Tsui` 同理。

### 2.4 港鐵拓撲有重複線，推導出 10 個假換乘站

`hongKongMtr.ts` 定義了 14 條線，但其中有重複：`East Rail Line` 與 `East Rail Line via Racecourse` 是同一條線的兩個變體，`Tseung Kwan O Line` 出現兩次。

因此站名共現推導出的 31 個「換乘站」中，有 **10 個是假的**——它們只是同一條線的兩個變體共用站：

> Exhibition Centre、Mong Kok East、Sha Tin、University、Tai Po Market、Tai Wo、Fanling、Sheung Shui、Lo Wu、Lok Ma Chau

扣除後為 21 個真換乘站，與維基百科清單完全相符（Admiralty、Kowloon Tong、Tai Wai、Yau Ma Tei、Mong Kok、Prince Edward、Diamond Hill、Lai King、Central、North Point、Quarry Bay、Yau Tong、Tiu Keng Leng、Tsing Yi、Hung Hom、Ho Man Tin、Sunny Bay、Nam Cheong、Mei Foo、Hong Kong、Kowloon）。

### 2.5 東京：每條線只存兩個站

| 線 | repo 存的站 | 維基實際站數 |
| --- | --- | --- |
| 都營大江戶線 | `["Shinjuku", "Roppongi"]` | 38 |
| 東京 Metro 銀座線 | `["Shibuya", "Asakusa"]` | 19 |
| 東京 Metro 丸之內線 | `["Tokyo", "Ginza"]` | 25 |
| 都營淺草線 | `["Asakusa", "Nihombashi"]` | 20 |
| 都營新宿線 | `["Jimbocho", "Shinjuku"]` | 21 |

東京地下鐵實際為 **13 條線、286 站**。repo 原有 5 條線、10 個站點條目，覆蓋率約 3.5%。

由於換乘靠站名共現推導，而每條線只有端點，真實換乘站（赤坂見附、上野、大手町、日本橋…）原本幾乎全部漏失。

> **修訂（2026-08-02）：** 這 5 條線的完整站序已補入，站點條目 12 → **123**，推導出的換乘站 0 → **13**（赤坂見附、日本橋、新橋、藏前、新宿三丁目、大門、森下、本鄉三丁目、中野坂上、青山一丁目、淺草、銀座、新宿）。仍缺 8 條線（日比谷、東西、千代田、有樂町、半藏門、南北、副都心、三田），需接 ODPT 或補完站序。日本地鐵線目前經 `isJapanMetroLine` 隱藏，這些換乘要等地鐵時刻表到位後才可見。
>
> 兩個模型限制已在程式碼註解記錄：大江戶線是「6」字形（支線＋環線），以直通運轉順序表示，環線閉合的那一段未呈現；丸之內線只收主線，方南町支線未含。

### 2.6 轉乘鏈接的其他缺陷

以下同時影響地鐵與高鐵（`findInRoutes` 為全國共用）：

| 缺陷 | 位置 | 問題 |
| --- | --- | --- |
| 無最短換乘時間 | `timetableDay.ts:264` | 判定僅 `wait >= 2 && wait <= 120`。大型換乘站兩分鐘轉乘物理上不成立 |
| 票價直接相加 | `timetableDay.ts:298-300` | 單一路網內轉乘（首爾、港鐵、新加坡）為一次計費，相加會高估 |
| 反向時刻為推算 | `reverseResult`，`timetableDay.ts:112` | 反向班次時刻由原方向行車時間往前推算，非真實反向班表，且無標記 |
| 無同月台／跨層區分 | — | 完全沒有車站層級的換乘難易度資料 |

---

## 第三部分：全球地鐵網路覆蓋清點

依維基百科 [List of metro systems](https://en.wikipedia.org/wiki/List_of_metro_systems)，14 個服務國家的地鐵網路覆蓋狀態：

| 國家 | 有地鐵的城市數 | repo 涵蓋 | 覆蓋率 |
| --- | --- | --- | --- |
| 中國 | **54**（北京、上海、廣州、深圳、成都、武漢…烏魯木齊、蕪湖） | 0 | **0%** |
| 日本 | 12（東京多系統、大阪、名古屋、札幌、橫濱、神戶、京都、福岡、仙台、廣島、千葉、埼玉） | 東京 5 線／13 線、10 站／286 站 | **~3%** |
| 韓國 | 8（首爾、釜山、大邱、大田、光州、仁川、金浦） | 首爾 Line 1–9 完整 | 首爾完整，其餘 0 |
| 法國 | 6（巴黎、里昂、馬賽、里爾、土魯斯、雷恩） | 0 | **0%** |
| 德國 | 4（柏林、漢堡、慕尼黑、紐倫堡） | 0 | **0%** |
| 美國 | 約 15（波士頓、紐約、華府、芝加哥、舊金山…） | 波士頓 MBTA | 波士頓 only |
| 英國 | 倫敦、格拉斯哥、泰恩威爾 | 倫敦 TfL | 倫敦 only |
| 香港 | 1 | 港鐵拓撲完整（21 換乘站） | 拓撲完整、時刻表殘缺 |
| 新加坡 | 1 | 6 線／145 站／25 換乘站 | **拓撲最完整**、時刻表全合成 |
| 泰國 | 1（曼谷） | 5 線／119 站／4 換乘站 | 拓撲不完整、時刻表全合成 |
| 比利時 | 1（布魯塞爾） | 0 | **0%** |
| 挪威 | 1（奧斯陸） | 0 | **0%** |
| 瑞士 | 1（洛桑） | 0 | **0%** |
| 馬來西亞 | 1（吉隆坡） | 0（`/api/transit/lines` 回空陣列） | **0%** |

約 **110 個地鐵網路中，repo 有實質資料的是 4 個**（首爾、波士頓、倫敦、港鐵），其中只有首爾一個是完整且可信的。

---

## 第四部分：隱藏清單

依已確認的**嚴格門檻**（需真實抓取，合成資料一律隱藏），套用結果：

### 保留

| 網路 | 可查日期 | 依據 |
| --- | --- | --- |
| 首爾地鐵（279 站／Line 1–9） | 7 天 | 官方 CSV，服務日分型，跨日合法有效 |
| 波士頓 MBTA | 7 天 | 真實排班，服務日正確（需先修週六重複與末班截斷） |
| 倫敦 TfL | **僅當天** | 未來日期為過期即時快照 |
| 香港港鐵 | **僅當天** | 未來日期為合成；當天需先修 live 覆蓋 bug |

### 隱藏

| 網路 | 依據 |
| --- | --- |
| 新加坡 MRT（6 線／145 站） | 時刻表 100% 合成 |
| 曼谷 BTS/MRT（5 線／119 站） | 時刻表 100% 合成 |
| 東京 Metro／都營（5 線／10 站） | 程式內固定班距生成；且拓撲僅 3.5% 覆蓋 |
| 中／德／法／比／挪／瑞／馬 地鐵 | 無任何地鐵資料 |

### 連帶後果

- **新加坡與泰國在 repo 內只有地鐵資料**，隱藏後這兩國完全無結果。國家保留在選單並顯示無可驗證資料的說明與業者官方連結（沿用馬來西亞 `catalog_only` 的既有契約）。
- **SEO**：`generate-route-pages.ts` 將少產生新加坡與泰國共 8 條路線 × 6 語系 = **48 個頁面**，已上線 URL 會變 404。依 CLAUDE.md，`npm run redirects` 不在 build 內，必須手動執行並提交。
- 套用後，App 的地鐵功能實質上只剩**首爾**（279 站、完整）與**波士頓**（需修截斷）。

### 一個值得重新考慮的取捨

新加坡擁有 repo 內**品質最高的線路拓撲**——6 條線、145 站（維基：146）、25 個換乘站全部正確。被隱藏的原因純粹是時刻表為合成。

若改採「拓撲照常顯示、時刻表降級為服務時段＋班距」（即把既有的 `isIndicativeTimetable()` 從 SEO 頁擴到 App 端），新加坡與曼谷可以保留可用性，同時完全不呈現任何捏造的發車時間。此路徑不需發明新規則，SEO 頁也不會少產生、不需處理 301。

**已確認採用嚴格門檻，此段僅記錄供日後重新評估。**

---

## 建議修法（依嚴重度排序）

| # | 問題 | 修法方向 |
| --- | --- | --- |
| 1 | 首爾 49 個換乘站無法使用 | 在 artifact 內實作轉乘搜尋：經過起點的車次 → 共同停靠站換乘 → 經過終點的車次。開機時依服務日預算三份可達集（279 站無效能疑慮） |
| 2 | TfL 即時快照寫入未來日期 | 移除「對七個日期各呼叫一次 live API」的迴圈。即時資料只能寫入抓取當天 |
| 3 | 港鐵 live 覆蓋全日班表 | `ProviderBackedScraper` 在 live 回傳筆數遠少於既有切片時，改為合併或保留較完整者 |
| 4 | 轉乘鏈接不讀中途停站 | `findRoutePaths` 建圖時納入 `result.stops` 為可換乘節點 |
| 5 | App 內未套用 indicative 判定 | 將 `isIndicativeTimetable()` 從 `scripts/lib/` 升格至 `src/data/`，SEO 與 App 共用同一定義 |
| 6 | 跨系統異名換乘漏失 | 建立換乘站別名對照（Asok↔Sukhumvit、Mo Chit↔Chatuchak Park、Central↔Hong Kong…），拓撲推導改為經別名解析 |
| 7 | 港鐵拓撲重複線 | 合併 `East Rail Line` 與 `East Rail Line via Racecourse`；去除重複的 `Tseung Kwan O Line` |
| 8 | 無最短換乘時間 | 引進以車站為鍵的最短換乘時間，無資料時用保守預設 |
| 9 | 票價直接相加 | 跨營運商才相加；同營運商標記「票價需向業者確認」 |
| 10 | MBTA 週六重複、末班截斷 | 修正合併去重；調查 API 分頁上限 |
| 11 | LLM 產出可能寫入 committed 資料 | 其輸出不得進入 committed 資料，或帶來源標記使其被判定為非真實資料 |
| 12 | `reverseResult` 推算時刻無標記 | 保留行為（否則反向查詢全滅），但需明確標記且不得標為即時 |

---

## 驗證紀錄

- 所有 repo 側數據由直接讀取 `src/data/scraped/` 與以 `npx tsx` 載入 `src/data/*.ts` 取得，非推測。
- 首爾 279 站／12,314 車次／49 換乘站，由解壓 `seoul-subway-timetable.json.gz` 後遍歷全部車次停站序列計算。
- 港鐵 21 真換乘站、新加坡 25 換乘站、曼谷 4 換乘站，由載入對應 `TransitLine[]` 後以站名共現計算。
- 維基百科來源：[List of metro systems](https://en.wikipedia.org/wiki/List_of_metro_systems)、[List of Hong Kong MTR stations](https://en.wikipedia.org/wiki/List_of_Hong_Kong_MTR_stations)、[List of Singapore MRT stations](https://en.wikipedia.org/wiki/List_of_Singapore_MRT_stations)、[Bangkok Skytrain](https://en.wikipedia.org/wiki/Bangkok_Skytrain)、[Tokyo subway](https://en.wikipedia.org/wiki/Tokyo_subway)、[Seoul Metropolitan Subway](https://en.wikipedia.org/wiki/Seoul_Metropolitan_Subway)。
- 未執行深度換乘比對的網路：**倫敦 TfL 與波士頓 MBTA**。兩者的線路拓撲並非提交在 repo 內，而是由 `src/server/tfl.ts` 與 `src/server/mbta.ts` 向 provider API 即時取得，因此不存在可供比對的已提交拓撲。這兩個網路的稽核僅涵蓋時刻表真實性。

## 實作後 provenance 紀錄（2026-08-01）

- `singapore/changi-airport-jurong-east.json` 與 `thailand/mo-chit-hua-lamphong.json` 內含由 LLM 諮詢確認過的轉乘欄位；兩份 route file 已標記 `provenance: "llm-advisory"`。
- 共用真實性判定器會把 route-level 或 row-level 的 `llm-advisory` 一律判為 `indicative`，因此不會進入可搜尋涵蓋度、車站選單、路線清單或 SEO 頁面。
- LLM 不同意既有人工轉乘點時，產生器只保留人工值；LLM 建議本身不寫入 committed timetable data。
