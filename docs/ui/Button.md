# Button 按鈕規格

Button 用來執行動作。TransitRail 的按鈕必須讓乘客快速理解「按下後會發生什麼」，並在搜尋、儲存、提醒、分享與錯誤重試時保持一致。視覺優先順序由任務重要性決定，不靠膠囊、光暈、陰影或跳動製造可點擊感。

本文件是目標規格，不表示所有既有按鈕已完成遷移或通過實機驗證。

## 使用邊界

| 使用者意圖 | 正確元素 | TransitRail 範例 |
| --- | --- | --- |
| 執行目前畫面中的動作 | Button | 搜尋班次、重試、交換起訖站 |
| 前往頁面或外部資源 | Link | 開啟官方營運商時刻表、前往靜態路線頁 |
| 開啟選單或浮層 | Menu／Dialog button | 開啟車站選擇器、圖例、語言選單 |
| 切換持續狀態 | Toggle button 或 Switch | 收藏路線、啟用提醒、設定偏好 |
| 切換檢視 | Tabs／Segmented control | 清單與地圖檢視 |

- 不以 `div`、`span` 或只有 click handler 的容器模擬按鈕。
- 不把 Link 加上 Button 語意，也不把外部連結做成會提交表單的按鈕。
- Icon-only button 只用於空間受限且圖示已具穩定意義的操作。
- Haptic 只能補強操作回饋，不能取代視覺、文字或輔助科技狀態。

## TransitRail 操作層級

按鈕以「強調程度」和「操作意圖」兩個維度組合。

| 強調程度 | 使用時機 | 典型操作 | 視覺方向 |
| --- | --- | --- | --- |
| Strong | 當前任務唯一主要動作 | 搜尋班次、確認座位選擇 | 高對比實色表面，無 glow 或外擴陰影 |
| Neutral | 一般或次要操作 | 交換站點、重試、套用篩選 | 與背景有清楚色調差，不依賴硬外框 |
| Quiet | 工具列與列內操作 | 分享、加入行事曆、關閉 | 透明底；hover／focus 才提高表面差 |

操作意圖：

- `default`：一般動作。
- `danger`：刪除已儲存行程、取消提醒等可能造成資料損失的動作。
- `danger` 只有在即將提交破壞性動作時才使用高對比危險色。

同一個操作區原則上只有一個 Strong button。不使用「實色主要按鈕加外框次要按鈕」作為預設配對；次要操作改用 Neutral、Quiet 或文字 Link。

## 產品情境

### 搜尋表單

- 「搜尋班次」是完成起點、終點與日期後的唯一 Strong action。
- 缺少必要條件時，優先在對應欄位提供說明；若按鈕 disabled，附近必須解釋原因。
- 搜尋中保持按鈕寬度與文案脈絡，阻止重複提交並傳達忙碌狀態。
- 搜尋失敗後恢復可操作，保留所有查詢條件。

### 車站選擇器

- 返回、清除搜尋與關閉使用 Quiet icon button，但都需要目前語系的 accessible name。
- 車站列若可點擊，整列是單一按鈕；不可在同一按鈕中再巢狀其他按鈕。
- 「沒有可驗證時刻」是資料狀態，不以看似可點擊的 pill 取代說明。

### 行程結果

- 收藏、提醒等持續狀態使用 `aria-pressed`，並以圖示與文字／tooltip 共同表示。
- 分享與加入行事曆是一般動作，不使用 `aria-pressed`。
- 刪除已儲存行程使用準確的本地化名稱，必要時提供確認或可復原機制。
- 開啟官方來源是 Link，清楚標示外部開啟行為。

## 尺寸與形狀

| 尺寸 | 視覺高度 | 實際操作目標 | 使用位置 |
| --- | --- | --- | --- |
| Compact | 28px 至 32px | 桌面至少 36px；觸控至少 44px | 工具列、結果列內操作 |
| Default | 36px 至 40px | 觸控至少 44px | 表單與 Dialog |
| Prominent | 44px 至 48px | 至少 44px | 搜尋與主要確認 |

- 文字按鈕水平 padding 至少 12px；圖示與文字間距 6px 至 8px。
- 一般圓角採 6px 至 10px 的小範圍，不預設 fully rounded pill。
- Icon-only button 的視覺容器保持正方形，圖示需數學及光學置中。
- 靜止狀態不使用 shadow；浮層內若需要深度，只用緊實且單一方向的陰影。
- 文案、圖示、spinner 與焦點框不得被固定高度或 overflow 裁切。
- 44px 是 TransitRail 的內部觸控標準，實際驗收仍需檢查目標間距與例外情境。

## 文案與圖示

- 使用「動詞＋對象」描述結果，例如「搜尋班次」、「儲存行程」、「移除提醒」。
- 不使用只有「確定」、「好的」、「繼續」而無法預測結果的文案。
- 破壞性操作明確寫出對象與後果，不以模糊詞降低風險感知。
- 裝飾圖示設定 `aria-hidden="true"`。
- Icon-only button 必須有目前語系的 accessible name；不能硬寫英文或只靠 `title`。
- Tooltip 必須同時支援 hover 與 keyboard focus，但不能承擔唯一必要說明。
- 不預設在 CTA 後加入右箭頭；只有外開、前進或階層關係確實需要時才使用對應圖示。
- 使用既有圖示庫時，只選真正提高辨識的圖示，不在每個按鈕後方加彩色 tile。

## 狀態

| 狀態 | 必要表現 |
| --- | --- |
| Default | 文字、圖示與操作範圍清楚，無預設 glow 或大陰影 |
| Hover | 只改變表面、文字或圖示色；不位移、不縮放 |
| Pressed | 立即產生色調回應；位置與尺寸不變 |
| Focus-visible | 完整焦點框包住實際操作目標，且不被裁切 |
| Loading | 維持原寬度，保留可理解的動作名稱並阻止重複提交 |
| Disabled | 無法操作但文案仍可讀；不能只降低 opacity 到失去對比 |
| Selected | 只供 Toggle button 使用，`aria-pressed` 與視覺狀態同步 |
| Success | 必要時短暫回饋結果，但不讓按鈕寬度跳動 |
| Error | 恢復可操作，保留使用者資料並提供具體重試方式 |

- Success 與 Error 若只短暫出現，使用鄰近 live region 傳達。
- 非必要轉場在 `prefers-reduced-motion` 下停用。
- 不使用 hover boop、scale、translate、underline animation、光暈或脈衝 halo。

## 行為與無障礙

- 使用原生 `<button>`；非提交按鈕明確設定 `type="button"`。
- Enter 與 Space 由原生按鈕行為觸發，不攔截標準鍵盤操作。
- Menu button 使用 `aria-haspopup`、`aria-expanded` 與 `aria-controls`。
- Toggle button 使用 `aria-pressed`；一般執行動作不得誤用。
- Loading 使用 `aria-busy` 或鄰近 live region，並避免焦點無預警消失。
- Disabled 原因若無法從上下文理解，提供可見說明；不只放在 tooltip。
- 危險、選取、成功與錯誤狀態不能只依靠顏色。
- 焦點框必須有可辨識的面積與對比，並在強制色彩模式中仍可見。
- 若按鈕打開 Dialog／Sheet，關閉後焦點回到原觸發器；觸發器卸載時回到合理的替代位置。

## 響應式與在地化

- 320px 寬度與 200% 縮放下，按鈕文案可換行或讓版面重排，不裁切文字。
- 行動版底部主要操作須避開 safe-area，且不被 BottomNav 遮住。
- 德文與法文較長動詞需預留寬度；CJK 文案不加入全大寫或過度字距。
- Icon-only accessible name、loading、success 與 error 文案全部使用 i18n key。
- 相同動作在各結果檢視中使用相同名稱，不能在不同國家頁面變成不同術語。

## 共用元件契約

```ts
type ButtonEmphasis = "strong" | "neutral" | "quiet";
type ButtonIntent = "default" | "danger";
type ButtonSize = "compact" | "default" | "prominent";

type ButtonProps = Omit<React.ComponentPropsWithoutRef<"button">, "size"> & {
  emphasis?: ButtonEmphasis;
  intent?: ButtonIntent;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
};
```

- 元件預設 `type="button"`，呼叫端可明確覆寫為 `submit`。
- `loading` 阻止重複觸發，但不清除原 accessible name。
- `iconOnly` 缺少 accessible name 時，開發環境應提出警告。
- `className` 只調整位置、寬度或局部 composition，不重新發明變體。
- 不提供 `primary`、`secondary`、`outline`、`pill`、`glow`、`elevated` 等互相重疊的布林屬性。

## 驗收證據

1. 搜尋、Loading、Disabled、Error、Toggle selected 與 Danger 操作的畫面。
2. Mouse、touch、Enter、Space 與 keyboard focus 的實際操作紀錄。
3. Icon-only button 的本地化 accessible name 與 tooltip 驗證。
4. 320px、200% 縮放、強制色彩模式與長翻譯文案截圖。
5. Loading／success／error 過程中沒有寬度跳動、重複提交或焦點遺失。
6. Dialog／Sheet 關閉後的焦點回復與 BottomNav safe-area 檢查。

沒有操作與畫面證據時，不能把元件標記為已通過驗收。
