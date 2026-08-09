# Disclosure（Toggle Block）摺疊區塊規格

本文件中的 Toggle 指單一 Disclosure：一個觸發器控制一個位於文件流中的內容區。它不代表設定用的 on／off Switch，也不代表具有 `aria-pressed` 的 Toggle button。

在 TransitRail 中，Disclosure 只能收納補充內容。乘客判斷是否搭乘所需的時間、轉乘、月台、服務中斷、資料可信度與錯誤必須在收合狀態下仍可取得。

## 使用邊界

適合：

- 展開單一班次的逐段行程與轉乘細節。
- 顯示較長的票價、購票、無障礙或營運規則。
- 展開官方來源的補充說明與資料讀取資訊。
- 在小螢幕中收納非必要的地圖或圖例說明。

不適合：

| 情境 | 正確模式 |
| --- | --- |
| 同一區塊有多個平行 Panel | Accordion |
| 收藏、提醒、釘選 | Toggle button 或 Switch |
| 車站清單與搜尋 | Dialog／Sheet |
| 地圖圖例、轉乘資訊浮層 | Dialog／Popover |
| 切換結果檢視 | Tabs／Segmented control |
| 重大服務中斷或查詢錯誤 | 常駐 Notice |

## TransitRail 內容規則

- `TripDetails` 收合摘要至少顯示出發、抵達、總時長、轉乘數與重大警示。
- 展開後才顯示每段路線、等待時間、月台、營運商與較長說明。
- 有轉乘時，Header 使用具體摘要，例如「查看 2 段行程」，不用「更多」。
- 服務日期、來源等級、資料更新時間與「無可驗證時刻」不能只放在收合內容。
- 收合只改變呈現，不刪除資料、不重新排序班次、不重新發出搜尋請求。
- Read-only 模式仍可展開閱讀；它不是 Disabled。

## 結構與外觀

- Chevron 位於標題左側；收合朝右，展開朝下。
- 主要點擊區可以包含 Chevron、標題與摘要，但不得巢狀分享、收藏或刪除按鈕。
- 標題、摘要與一般內容保持一致閱讀節奏，不包成高對比卡片或狀態膠囊。
- 展開內容接續 Header 的內容流，並對齊標題文字起點。
- 巢狀內容不用裝飾性垂直線、accent bar 或光暈建立層級。
- Chevron、文字、數字與焦點框不得被固定高度、overflow 或 clip-path 裁切。
- 靜止狀態不使用全向陰影、玻璃、漸層、彩色 icon tile 或背景 glow。

### 尺寸

- 桌面 Header 最小高度 36px；觸控操作目標至少 44px。
- Chevron 14px 至 16px，與第一行文字光學置中。
- Chevron 與標題間距 6px 至 8px。
- Panel 與 Header 間距 6px 至 8px。
- 觸控目標擴大時不可造成相鄰操作重疊。

## 互動

- 使用原生 button；Enter 與 Space 切換展開狀態。
- 點擊 Header 切換狀態，不干擾 Header 外的收藏、分享或刪除操作。
- 展開與收合立即生效，不需要另外儲存。
- 切換後焦點留在觸發器。
- 收合包含目前焦點的內容前，先把焦點移回觸發器。
- Escape 不預設收合 Disclosure；若內容中另有 Dialog 或 Popover，由該模式先處理 Escape。
- 若支援快捷鍵，必須可被使用者發現，且不能與瀏覽器或輸入法快捷鍵衝突。

## 狀態

| 狀態 | 必要表現 |
| --- | --- |
| Collapsed | 顯示 Chevron、具體標題與必要摘要；內容不在 Tab 順序 |
| Expanded | 顯示完整內容；Header 與周邊操作不位移 |
| Hover | 只提高安靜的表面或文字色差 |
| Pressed | 立即回應，位置與尺寸不變 |
| Focus-visible | 完整焦點框包住實際觸發器 |
| Read-only | 可展開閱讀，不能修改內容 |
| Disabled | 僅在內容確實不可取得時使用，並說明原因 |
| Empty | 展開後顯示具體空狀態，不留下空白區 |
| Loading | Panel 傳達進度，不隱藏 Header 摘要 |
| Error | Panel 顯示具體錯誤與重試；必要警示仍留在 Header 外 |

## ARIA 與 DOM

```tsx
<button
  id="trip-details-trigger"
  type="button"
  aria-expanded={isOpen}
  aria-controls="trip-details-panel"
>
  <ChevronRight aria-hidden="true" />
  {t("result.view_trip_details", { count: legCount })}
</button>

<div
  id="trip-details-panel"
  aria-labelledby="trip-details-trigger"
  hidden={!isOpen}
>
  {children}
</div>
```

- Accessible name 使用目前語系並描述內容，不只叫「展開」或「收合」。
- Chevron 與其他裝飾圖示設定 `aria-hidden="true"`。
- `aria-expanded`、`aria-controls` 與真實顯示狀態保持同步。
- Trigger／Panel ID 來自穩定的 trip 或 item key，不由翻譯文字或陣列位置產生。
- 收合使用 `hidden` 或條件渲染，不能只設定 `opacity: 0`。
- 靜態且不需受控狀態的補充內容可以優先使用原生 `details`／`summary`。

## 動效

- 內容預設可見性由真實狀態決定，不依賴動畫完成。
- Chevron 可以在 120ms 至 160ms 內旋轉；reduced motion 下取消。
- Panel 不使用 opacity 入口淡入、位移、spring、hover lift 或 glow。
- 不以不穩定的 `height: 0` 動畫裁切長行程、表格或警示。
- 快速連續操作時，Chevron 與 Panel 不得卡在不同狀態。

## 響應式與在地化

- 320px 與 200% 縮放下，長站名、營運商名稱與轉乘摘要可以換行。
- 時間欄位保持對齊，但不能以固定欄寬壓縮站名到不可辨識。
- CJK 文案不使用英文式全大寫或過度 letter-spacing。
- Accessible name、摘要、空狀態與錯誤全部使用 i18n key。
- 站名沿用 `stationLabel()` 的顯示策略，不把本地化名稱寫回搜尋 canonical value。

## 驗收證據

1. Collapsed、Expanded、Read-only、Empty、Loading 與 Error 畫面。
2. Enter、Space、Tab、Shift+Tab 與收合前焦點回復的實際測試。
3. 320px、200% 縮放、長站名與多段轉乘的截圖。
4. `aria-expanded`、`aria-controls`、唯一 ID 與 hidden 狀態的 DOM 檢查。
5. 收合後主要時間、轉乘數、服務中斷與資料可信度仍可取得。
6. reduced motion 下沒有非必要旋轉或內容動畫。

沒有這些證據時，不應把 Disclosure 標記為已完成。
