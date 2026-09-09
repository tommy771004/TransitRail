# ADR 0001：以來源識別碼作為車站對應鍵

- 狀態：**進行中（Accepted, partially implemented）**
- 已完成：步驟 2 瑞士（commit `1cae367`）
- 未完成：步驟 1 韓國、步驟 3 德／法／馬、步驟 4 日本／香港
- 日期：2026-09-09
- 發現於：`/qa` 各國查詢流程驗證（`.gstack/qa-reports/qa-report-localhost-2026-09-09.md`）

## 背景與問題

搜尋比對車站用的是**名稱字串**，而不是來源提供的站點識別碼。規則是
`src/data/stationKey.ts` 的 `stationSearchKey()`，全部內容就是：

```ts
export function stationSearchKey(name: string): string {
  return name.toLowerCase().trim();
}
```

有五個市場已經走識別碼，其餘沒有 —— **而且其中兩個是「來源給了識別碼，程式卻丟掉」**。

這不是理論風險，是兩處程式碼自己承認的：

`src/server/seoulSubwayTimetable.ts` 的 `resolveStation()`

```ts
// Only fall back to the code when there was no usable name: a numeric code
// that lost its leading zero can name the wrong station (seoulStationNames).
```

站碼被降級成後備，是因為它被當**數字**處理會掉前導零。存成字串就沒有這個問題，
但目前的做法是連存都不存 —— 解析完只留英文名。

`src/server/gtfs/journeys.ts` 的 `stationStopIds()` 有四層後備，最後一層是子字串互含：

```ts
return queryKeys.some((queryKey) => key.includes(queryKey) || queryKey.includes(key));
```

`Genève` 與 `Genève-Aéroport` 這種父子關係就落在這一層。瑞士 GTFS 的 `stop_id`
明明在 feed 裡，四個 GTFS adapter 對它的引用數都是 0。

## 現況盤點

| 市場 | 來源提供的識別 | 目前查詢用什麼 | 風險 |
| --- | --- | --- | --- |
| 🇬🇧 英國 | Naptan（`940GZZLUBST`） | **ID** | 低 |
| 🇺🇸 美國 | MBTA `parent_station` id | **ID** | 低 |
| 🇧🇪 比利時 | iRail station id | **ID** | 低 |
| 🇳🇴 挪威 | Entur NSR id | **ID** | 低 |
| 🇨🇭 瑞士（OJP 即時） | `StopPlaceRef` | **ID** | 低 |
| 🇨🇭 瑞士（GTFS 離線） | DIDOK（`didok` 欄位） | **登錄號** ✅ 已完成 | 低 |
| 🇰🇷 韓國 | `역사코드`，**有但丟棄** | 英文名字串 | **高** |
| 🇩🇪 德國 | **無穩定識別**（見下） | 名稱 | 中 |
| 🇫🇷 法國 | GTFS `stop_id`，有但未用 | 名稱 | 中 |
| 🇲🇾 馬來西亞 | GTFS `stop_id`，有但未用 | 名稱 | 中 |
| 🇯🇵 日本 | ODPT `odpt:Station` id | 名稱 | 中 |
| 🇭🇰 香港 | MTR station code | 名稱（`src/data/stationIdentity.ts`） | 中 |

驗證指令：

```bash
grep -c 'stop_id\|stopId' src/server/germanyGtfs.ts src/server/franceGtfs.ts \
  src/server/swissGtfs.ts scripts/scrapers/malaysiaTimetable.ts   # 全部為 0
```

## 提案

**加一層 ID 主鍵，不是拿掉名稱。** 業者原名仍是人可讀的錨點與 fallback，
韓文／日文／繁中仍是純顯示，經 `stationLabel()` 產生，不參與比對 —— 這條
CLAUDE.md 的規則不變。

| 市場 | 建議主鍵 | 理由 |
| --- | --- | --- |
| 韓國 | `역사코드`，8 碼，**存成字串保留前導零** | 解析時本來就拿到了。`resolveStation` 的註解已經指出數字化會指到錯的站 |
| 瑞士 | GTFS `stop_id` | feed 裡就有；可略過四層後備，特別是子字串互含那層 |
| 德／法／馬 | GTFS `stop_id` | 共用同一個 `collectGtfsJourneysForDates`，改一次全受惠 |
| 日本 | ODPT `odpt:Station` id | 多家業者共用站名時最需要 |
| 香港 | MTR station code | `stationIdentity` 模組已在，接上即可 |
| 英／美／比／挪／瑞(OJP) | 維持現狀 | 已經是 ID |

## 落地順序

1. **韓國** —— 改動最小、風險最高。`SeoulTimetable.stations` 由 `string[]` 改為
   `{ id: string; name: string }[]`，`resolveStation()` 回傳兩者。**需重跑
   `npm run scrape:korea`**，成品格式會變。
2. ~~**瑞士**~~ —— **已完成**（`1cae367`）。用的是 DIDOK 而非 `stop_id`：feed 的
   `didok` 欄位每站一個值且跨版本穩定，平台層級的 `stop_id` 光蘇黎世中央就有 27 個。
   重爬後輸出與名稱比對逐列一致（76 檔 / 529 route-date / 28364 筆 / 0 差異）。

   **實作時踩到的兩個坑，其他市場照做時要避開：**
   - `registerIds` 以**車站名稱**為鍵，由 `stationStopIds` 自行正規化。不要讓呼叫端
     傳正規化後的鍵 —— `normalizeStation` 把標點換成空格而非刪除，寫錯的鍵不會報錯，
     只會默默沒命中並退回名稱比對。
   - 守門測試不能拿設定檔自己的鍵當查詢（循環論證，永遠通過）。要比對該市場路線
     實際使用的站名集合，並用「只有登錄號能找到的探針站」驗證。
3. **法／馬** —— 識別碼已確認可用，但**卡在既有測試**（見下）。
   - 法國：`StopArea:OCE<UIC>`，7 個路線端點全數解析
     （巴黎東站 `87113001`、巴黎里昂 `87686006`、馬賽聖夏爾 `87751008` 等）
   - 馬來西亞：KTMB `stop_id` 為站級 5 碼，一列一站，5 個端點全數解析

   **德國要移出這份清單**：gtfs.de 免費 feed 的 `stop_id` / `parent_station` 是
   自產的合成值（Aachen Hbf = `366170` / `646823`），不帶 IBNR 或 UIC，無法確認
   跨 feed 版本穩定。用它當鍵會比用名稱更糟。與該 feed 沒有 `trip_short_name`
   是同一個限制：免費層不發布穩定識別。
4. **日本、香港** —— 最後，兩者目前都有靜態站表擋著。

每一步都要跑 `npm run lint`、`npm run validate:data`，以及
`npx tsx scripts/audit-station-mapping.ts`。

## 法／馬卡在哪裡

實作後 11 個既有測試失敗，而且不是補 fixture 資料就能解決。其中兩個是：

- `resolves a station the feed names the operator's way`
- `matches a station the feed spells out where the route list abbreviates`

它們存在的目的就是驗證**名稱比對**能處理拼法差異（feed 寫 `Paris Est`，路線清單寫
`Paris Gare de l'Est`）。改用登錄號後這些案例會靠 id 通過，測試的原意被掏空 ——
`FRANCE_STATION_MATCH` 的 `fillerWords` 與 `synonyms` 也會變成死碼。

這不是「照 ADR 修」的範圍，是要重新決定那些測試該保障什麼。建議獨立處理，並在動手
前先決定：登錄號涵蓋的站是否還需要保留名稱比對作為第二層。

## 為什麼現在不做

- **不在 QA 修復範圍**：這是架構改動，不是缺陷修復。
- **會動到已提交的成品格式**：韓國與瑞士都得重爬，混進 QA 分支會讓 diff 無法審閱。
- **還沒出事**：`scripts/audit-station-mapping.ts` 目前回報**名稱不符 0 筆**。
  這是預防性強化，不是急件。

## 觸發條件

出現以下任一情況就該優先處理：

- `audit-station-mapping.ts` 開始回報名稱不符
- 某個市場的來源改了站名拼寫，導致既有路線查無資料
- 新增的市場有同名不同站（父子站、多業者共站）
