# Input Field 輸入欄位規格

Input Field 用來輸入或搜尋文字、日期與時間。TransitRail 的核心任務是選擇國家、起點、終點、服務日期與時間，再取得可信的時刻結果；不是所有查詢條件都應做成自由文字欄位。

本文件是目標規格。既有 `SearchForm`、`StationBrowser` 與其他輸入介面仍需依驗收證據確認實際狀態。

## 使用邊界

| 資料或任務 | 正確控制 | TransitRail 情境 |
| --- | --- | --- |
| 從已知站點選擇一站 | Button 開啟 Dialog／Sheet | 起點與終點 |
| 在車站清單中縮小結果 | Search field | `StationBrowser` 站名搜尋 |
| 選擇服務日期 | 原生 date input 或可存取日期選擇器 | 查詢日期 |
| 輸入出發時間 | 原生 time input 或時間選擇器 | 自訂搜尋時間 |
| 從固定選項選擇 | Select／Radio group | 國家、偏好或模式 |
| 多行回饋 | Textarea | 使用者意見與錯誤回報 |

- 起點與終點的真實值必須來自站點清單，不讓任意自由文字繞過站名映射。
- 有建議清單且輸入本身負責選取時才使用 Combobox；只篩選下方既有清單時使用 Search field 加清單。
- 日期、時間、Email、URL 與電話使用符合資料意義的原生型別和 `inputMode`。
- Placeholder 只提供短例子或提示，不取代 label、格式說明或 accessible name。
- Switch、Checkbox 與 Toggle button 負責二元狀態，不使用文字欄位輸入「是／否」。

## TransitRail 搜尋流程

### 起點與終點

- 畫面上以有名稱的選擇控制呈現，按下後開啟 `StationBrowser`。
- 控制同時顯示欄位角色與目前值，例如「起點：台北車站」。
- 尚未選擇時仍保留可見 label，不只顯示 placeholder。
- 交換起訖站是獨立 Button；交換後立即更新兩個值與 accessible name。
- 不可搜尋的車站要在選擇前說明「TransitRail 尚無可驗證時刻」，避免使用者提交後才走入死路。

### 車站搜尋

- 輸入欄位有目前語系的名稱，例如「搜尋車站」。
- 搜尋同時比對原始站名、在地化名稱及已核准別名，但提交值保持資料層使用的 canonical name。
- 中文輸入法組字期間不更新 active option、提交或關閉清單。
- 清除按鈕只在有值時出現，使用原生 button，清除後焦點留在輸入欄位。
- Loading、無結果、載入失敗與資料涵蓋限制顯示在結果區，不塞進 placeholder。
- 若使用者在切換語言後仍保留 query，搜尋結果與顯示名稱需同步更新。

### 日期與時間

- 可選日期範圍必須由 `countryConfig` 的 provider 能力決定，不能提供後端無法回答的日期。
- 日期 label、顯示格式與錯誤文案依 locale 呈現；送往 API 的值保持明確格式。
- Live-only 市場不能讓未來日期看起來可正常取得即時班次。
- 時間欄位保留原生鍵盤與系統選擇器能力，並使用目前 locale 可理解的格式。
- 跨午夜班次必須同時顯示服務日期脈絡，不能只靠一個模糊的時間值。

## 顯示模式

| 模式 | 使用位置 | 靜止狀態 | Focus 狀態 |
| --- | --- | --- | --- |
| Form | 搜尋條件、設定、Dialog | 清楚表面與低對比自色邊界 | 提高邊界與完整焦點框 |
| Inline | 只供少量原地編輯 | 跟隨所在表面，不持續畫框 | 顯示欄位邊界，版面不跳動 |
| Search | 車站清單與篩選 | 搜尋圖示與 label 說明用途 | 保持輸入寬度，結果區同步更新 |
| Textarea | 回饋與補充內容 | 穩定高度及行高 | 可調整或自動增高，不裁切游標 |

- 不把 Form、Inline 與 Search 全做成相同的白色大圓角框。
- Search icon 使用裸圖示，不加彩色 tile。
- 靜止狀態不使用陰影、光暈、漸層或玻璃效果。
- Focus 不靠 glow 或背景 bloom；焦點框必須清楚且可在強制色彩模式辨認。

## Label、說明與錯誤

### Label

- Form input 使用可見 label，通常位於控制上方或同一欄位群組中清楚對應。
- Label 使用目前語系的正常句式，不套用全大寫、過度字距或 10px 粗體 eyebrow。
- Search field 即使視覺上精簡，也必須用 `label`、`aria-label` 或 `aria-labelledby` 建立名稱。
- 必填狀態以可見文字或清楚符號搭配可存取名稱表示，不只改變顏色。

### Placeholder

- 只顯示短提示，例如「輸入車站名稱」。
- 不放快捷鍵、錯誤訊息、完整格式規則或多句操作說明。
- 使用者開始輸入後，必要資訊仍必須留在畫面上。
- Placeholder 與已輸入內容需要明確色階差，但仍保持可閱讀。

### Description 與 Error

- 輔助說明放在欄位附近，只在格式、資料來源或結果不容易理解時出現。
- Error 說明問題與修正方式，例如「這個日期超出目前可查詢的 7 天範圍」。
- Error 不只使用紅色邊框，並透過 `aria-invalid` 與 `aria-describedby` 關聯。
- 顯示 Error 時保留原輸入，不清空起點、終點、日期或時間。
- 同一位置不並列互相競爭的 description、error 與 success；Error 優先。

## 尺寸與排版

| 控制 | 桌面視覺高度 | 觸控目標 | 文字 |
| --- | --- | --- | --- |
| Form input | 36px 至 40px | 至少 44px | 14px；行動版至少 16px |
| Search field | 40px | 至少 44px | 行動版至少 16px |
| Compact inline input | 28px 至 32px | 依情境擴大 hit area | 不小於 12px，且不承載主要資訊 |
| Textarea | 至少 3 行 | 控制列至少 44px | 行動版至少 16px |

- 水平 padding 建議 10px 至 12px；圖示與文字間距 8px。
- 一般圓角採 6px 至 10px，不預設 fully rounded pill。
- Inline input 與相鄰文字保持相同字級、行高和基線。
- Textarea 自動增高時不得裁切游標或最後一行。
- Placeholder、原生日期控制、清除按鈕與焦點框不得被固定高度或 overflow 裁切。

## 狀態

| 狀態 | 必要表現 |
| --- | --- |
| Empty | 顯示短 placeholder；label 與必要說明仍存在 |
| Filled | 使用主要文字色，不以額外色塊標示 |
| Hover | 只改變表面或低對比邊界，不位移或縮放 |
| Focus-visible | 顯示完整焦點框與清楚邊界，不被容器裁切 |
| Invalid | 保留值，顯示具體錯誤並設定錯誤語意 |
| Disabled | 不可聚焦或修改，但 label、值與原因仍可辨識 |
| Read-only | 可聚焦、選取與複製，不與 Disabled 混淆 |
| Loading | 保留輸入能力；在結果區傳達進度 |
| Autofill | 自動填入後仍符合文字、背景與焦點對比 |

- 驗證通常在 blur 或提交後開始，不在每次按鍵後立即責備使用者。
- 使用者修正為有效內容後立即清除對應錯誤。
- 狀態轉場只使用短促色調變化，並支援 reduced motion。
- 不使用 hover boop、glow、全向陰影或 underline fill animation。

## 資料型別與格式

| 資料 | 建議設定 | 注意事項 |
| --- | --- | --- |
| 車站搜尋 | `type="search"` 或 `type="text"` | 設定適當 `enterKeyHint`，組字期間不提交 |
| Email | `type="email"`, `inputMode="email"` | 使用正確 `autocomplete` |
| URL | `type="url"`, `inputMode="url"` | 提供包含協定的例子與錯誤 |
| 日期 | `type="date"` 或可存取日期選擇器 | 顯示 locale 格式，資料值與顯示值分離 |
| 時間 | `type="time"` | 顯示服務日期與跨午夜脈絡 |
| 數字 | `type="number"` 或文字 draft 搭配 `inputMode` | 編輯時允許空字串，不強制轉成 0 |

- 使用原生約束時仍提供目前語系的產品錯誤訊息。
- 格式化日期、時間與數字時，編輯值與顯示值分開處理，避免游標跳動。
- 不用 mono 字體營造技術感；時間對齊使用 `font-variant-numeric: tabular-nums`。

## 鍵盤、IME 與非同步行為

- Tab 與 Shift+Tab 依畫面順序移動，不攔截標準焦點行為。
- 提交前檢查 `event.nativeEvent.isComposing`，CJK 組字期間不得提交。
- Textarea 的 Enter 預設換行；只有產品明確定義時才用 Cmd／Ctrl + Enter 提交。
- Escape 關閉建議清單時不清除已輸入 query；若是 Dialog，依 Dialog 規格關閉並回復焦點。
- 不攔截複製、貼上、復原、重做與文字選取快捷鍵。
- 非同步搜尋時保留輸入；舊請求回來不得覆蓋較新的 query 結果。
- 失敗後提供重試，不清空已選站點或查詢條件。

## Search 與 Combobox

純篩選清單：

- Search field 有清楚名稱；結果數量與無結果狀態由鄰近 live region 傳達。
- 下方清單保留正常 list／button 語意，不因搜尋而強行改成 listbox。
- 清除搜尋後焦點留在欄位，清單恢復完整結果。

真正的 Combobox：

- 輸入欄位使用 `role="combobox"`、`aria-expanded`、`aria-controls` 與 `aria-activedescendant`。
- 建議容器使用 `listbox`，選項使用 `option`。
- Arrow Up／Down 移動選項，Enter 選取，Escape 關閉但不清除文字。
- 視覺 active option、鍵盤 active option 與 `aria-activedescendant` 永遠同步。

## 共用元件契約

```ts
type InputAppearance = "form" | "inline" | "search";
type InputSize = "compact" | "default";
type InputLabelMode = "visible" | "accessible";

type InputFieldProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "size"
> & {
  label: string;
  appearance?: InputAppearance;
  size?: InputSize;
  labelMode?: InputLabelMode;
  description?: string;
  error?: string;
};
```

- `label` 必填，由元件建立 label、input、description 與 error 的 ID 關聯。
- `error` 自動設定 `aria-invalid` 並優先成為 `aria-describedby` 內容。
- `className` 只處理位置或寬度，不重新定義 appearance 與狀態。
- 不提供 `bordered`、`rounded`、`glow`、`floatingLabel` 等外觀布林值。
- Station picker、Search combobox、日期選擇器與 inline editor 在較高層封裝各自的資料和鍵盤邏輯。

## 驗收證據

1. 起點、終點、車站搜尋、日期、時間與回饋欄位的 Empty、Filled、Focus、Invalid、Disabled、Read-only 與 Autofill 畫面。
2. 中文、日文與韓文輸入法組字期間 Enter 不會提早提交的紀錄。
3. 320px、200% 縮放、長站名及德文／法文長文案截圖。
4. 行動裝置聚焦時不因字級過小自動放大。
5. 日期範圍與 `countryConfig` 能力一致，不能選出後端無法回答的日期。
6. `aria-invalid`、`aria-describedby`、Search 結果 live region 與 Combobox active option 的 DOM／輔助科技測試。
7. 非同步競態、清除 query、搜尋失敗與重試不會遺失已選條件。

沒有上述證據時，只能說明規格與程式結構，不能宣稱輸入流程已通過 UX 或無障礙驗收。
