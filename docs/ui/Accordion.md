# Accordion 摺疊面板規格

Accordion 用來管理同一層級下兩個以上可展開的平行內容區。TransitRail 是行動優先的跨國大眾運輸時刻查詢工具，Accordion 只能降低次要資訊的閱讀密度，不能隱藏乘客做決定所需的出發時間、抵達時間、轉乘、服務中斷、資料來源或查詢錯誤。

本文件是目標規格，不表示現有畫面已通過驗收。實作狀態與驗證證據應記錄在獨立的稽核或工作項目中。

## 使用邊界

使用 Accordion 的前提：

- 同一區塊中至少有兩個彼此平行的標題與內容面板。
- 使用者可能需要在多個面板之間比較補充資訊。
- 收合內容不影響乘客理解目前行程是否可搭乘。
- 預設允許同時展開多段；只有內容互斥時才使用 single 模式。

不要使用 Accordion 的情境：

| 情境 | 正確模式 | 原因 |
| --- | --- | --- |
| 單一班次的行程細節 | Disclosure | 只有一個觸發器與一個內容區 |
| 車站選擇器 | Dialog／Sheet 加搜尋清單 | 它是需要焦點管理的選擇流程 |
| 國家、日期或時間選擇 | Select、原生控制或 Dialog | 切換的是查詢條件，不是內容密度 |
| 收藏、提醒或釘選 | Toggle button 或 Switch | 改變的是持續狀態 |
| 結果檢視切換 | Tabs 或 Segmented control | 切換的是同一區域的視圖 |
| 服務中斷與重大警示 | 常駐 Notice | 不能預設藏起影響搭乘的資訊 |
| 地圖圖例或轉乘說明浮層 | Dialog／Popover | 內容離開文件流並需要關閉行為 |

## TransitRail 適用情境

目前核心流程沒有必須建立通用 Accordion 的情境。未來若同一結果頁需要並列「票價說明」、「無障礙設施」、「營運商規則」等多段補充資訊，才使用 Accordion。

現有介面應維持以下分類：

| 介面 | 模式 | 要求 |
| --- | --- | --- |
| `TripDetails` 班次內容 | Disclosure | 收合時仍顯示出發、抵達、總時長、轉乘數與主要警示 |
| `ServiceDayAdvisoryNotice` | Notice | first／last train、headway、資料限制與來源不得藏在 Accordion 內 |
| `RouteServiceOverview` | 靜態摘要或 Disclosure | 主要服務狀態常駐，冗長來源細節才可收合 |
| `TransitLegend` | Dialog／Popover | 由明確命名的按鈕開啟並管理焦點 |
| `StationBrowser` | Dialog／Sheet | 搜尋、清單與選取屬於一段完整任務 |

## 資訊與文案

- Header 必須直接預告內容，例如「票價與購票限制」，不用「更多」、「詳細」或「其他」。
- 若 Header 顯示摘要，摘要必須在收合時仍足以理解內容，例如「2 次轉乘」。
- 官方來源名稱、資料讀取時間、服務日期與限制不得只存在於收合內容。
- 內容讀取失敗時，在對應 Panel 顯示問題與重試方式，不清空整組面板。
- 面板標題、狀態與操作文字必須走 i18n，不在 JSX 中硬寫英文或繁體中文。

## 視覺與排版

- Accordion 應接近一般內容列，不把每個項目做成獨立高對比卡片。
- Chevron 使用裸圖示，收合朝右、展開朝下，全產品一致。
- Header 與相鄰內容共用基線；Chevron 與第一行文字需數學及光學置中。
- Panel 起點對齊 Header 文字，不對齊 Chevron 外緣。
- 長標題可以換行；不得以固定高度、`overflow: hidden` 或 `clip-path` 裁切。
- 靜止狀態不使用漸層、glow、玻璃、全向陰影、彩色 icon tile 或狀態 pill。
- Hover 與 Pressed 只做安靜的表面或文字色變化，不位移、不縮放。

### 建議尺寸

| 項目 | 桌面 | 觸控版面 |
| --- | --- | --- |
| Header 最小高度 | 36px 至 40px | 44px |
| 左右 padding | 8px 至 10px | 10px 至 12px |
| Chevron | 14px 至 16px | 16px |
| Chevron 與文字間距 | 6px 至 8px | 8px |
| 標題 | `label` 或 `body-strong` 語意樣式 | `body-strong` 語意樣式 |
| Panel 垂直間距 | Header 下方 6px 至 8px | Header 下方 8px |

44px 是 TransitRail 的內部觸控目標，不應被描述成所有 WCAG 等級的唯一門檻。驗收仍需確認目標間距、例外條件與實際裝置操作。

## 狀態

| 狀態 | 必要表現 |
| --- | --- |
| Collapsed | Chevron 朝右；Panel 不呈現且內容不在 Tab 順序 |
| Expanded | Chevron 朝下；Panel 完整呈現；Header 不因高度變化而位移 |
| Hover | 只調整表面或文字色 |
| Pressed | 立即回應按下狀態，元件位置不變 |
| Focus-visible | 完整焦點框包住實際按鈕，且不被相鄰容器裁切 |
| Disabled | 保留標題可讀性並使用正確 disabled 語意 |
| Read-only | 可展開閱讀但無法修改內容，不與 Disabled 混淆 |
| Loading | Header 保持穩定；Panel 內傳達載入進度，不留下無意義空白 |
| Error | 保留其他 Panel，於失敗 Panel 顯示具體錯誤與重試動作 |

## 展開邏輯

### Multiple，預設

- 多個 Panel 可以同時展開，方便比較票價、設施與營運規則。
- 開啟第二段時不應意外收起正在閱讀或操作的第一段。
- 展開狀態只保留於目前畫面生命週期，除非產品明確把它定義為偏好。

### Single，例外

- 只在內容互斥或可用空間極度有限時使用。
- 若面板內含未提交內容，切換前必須保存、阻止切換或清楚提示。
- 不為製造動畫或縮短頁面而強制使用 single 模式。

## 鍵盤與焦點

- Header 使用原生 `button`；Enter 與 Space 由原生按鈕行為切換。
- Tab 與 Shift+Tab 依文件順序移動至 Header 和已展開內容中的控制。
- Escape 不預設收合 Accordion，避免干擾 Panel 中的輸入與浮層。
- 展開或收合後，焦點留在原 Header。
- 收合包含目前焦點的 Panel 前，先將焦點移回對應 Header。
- 若支援 Up／Down、Home／End，必須整組一致實作並在說明中列為額外鍵盤行為。
- 巢狀 Accordion 最多兩層；鍵盤操作只作用於目前層級。

## ARIA 與 DOM

```tsx
<section>
  <h3>
    <button
      id="fare-header"
      type="button"
      aria-expanded={isOpen}
      aria-controls="fare-panel"
    >
      <ChevronRight aria-hidden="true" />
      {t("result.fare_rules")}
    </button>
  </h3>
  <div
    id="fare-panel"
    aria-labelledby="fare-header"
    hidden={!isOpen}
  >
    {children}
  </div>
</section>
```

- Accessible name 來自具體標題文字，不只叫「展開」。
- Chevron 設為 `aria-hidden="true"`。
- `aria-expanded` 必須與 Panel 的真實顯示狀態同步。
- `aria-controls` 指向頁面中唯一且穩定的 Panel ID。
- 收合使用 `hidden` 或條件渲染，不只使用透明度。
- Heading 層級依頁面資訊架構決定，不為配合字級跳級。
- 少量且結構重要的 Panel 才使用 `role="region"`，避免 landmark 過多。
- Header 旁的分享、刪除或更多操作必須是 heading 外的獨立按鈕，不得巢狀互動控制。

## 動效

- 內容可見性由狀態決定，不依賴動畫完成。
- Chevron 可以在 120ms 至 160ms 內旋轉；`prefers-reduced-motion` 下取消轉場。
- Panel 不從 `opacity: 0` 或位移狀態進場。
- 不使用難以量測的 `height: 0` 動畫裁切長內容。
- 快速連續操作時，狀態、Chevron 與 Panel 不得分叉或卡住。

## 響應式與在地化

- 200% 縮放與 320px 寬度下不得水平溢位、裁切焦點框或讓 Chevron 壓住文字。
- 長站名、營運商名稱與德文／法文文案允許自然換行。
- CJK 文案不加入英文式全大寫或過度 letter-spacing。
- Heading 的 accessible name 使用目前語系；站名可依 `stationLabel()` 顯示在地名稱與可辨識的次要名稱。
- 顯示日期、時間與數字時沿用 Typography 規格，不使用 mono 作為裝飾語氣。

## 實作契約

共用元件只負責組合關係、受控狀態與可存取語意，不綁定資料取得、路由、票價邏輯或特定 UI 套件。

```ts
type AccordionMode = "multiple" | "single";

interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface AccordionProps {
  items: readonly AccordionItem[];
  mode?: AccordionMode;
  openItemIds: ReadonlySet<string>;
  onOpenChange: (next: ReadonlySet<string>) => void;
  headingLevel: 2 | 3 | 4 | 5 | 6;
}
```

- 不暴露 `pill`、`glow`、`shadow`、`rounded` 等外觀布林值。
- ID 必須來自穩定 item key，不由畫面順序或翻譯文字產生。
- 呼叫端不應直接依賴 Radix 或其他第三方 primitive 的 Interface；若未安裝依賴，不在文件中宣稱已採用。

## 驗收證據

完成實作後，至少保留以下證據：

1. Collapsed、Expanded、Loading、Error、Disabled 與 Read-only 畫面。
2. Enter、Space、Tab、Shift+Tab 與焦點復原的實際鍵盤紀錄。
3. 320px、一般桌面寬度及 200% 縮放的截圖。
4. `aria-expanded`、`aria-controls`、唯一 ID 與 Panel 顯示狀態的 DOM 檢查。
5. 螢幕閱讀器朗讀 Header 名稱與展開狀態的人工測試。
6. reduced motion、強制色彩模式與長翻譯文案的檢查。

沒有這些證據時，只能標示為「規格已定義」或「實作待驗證」，不能寫成「已完成」。
