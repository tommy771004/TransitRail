# Typography 字體與文字層級規格

TransitRail 的文字系統首先服務「快速掃讀時刻、辨認站名、理解轉乘、判斷資料可信度」。裝飾性品牌語氣不能壓過乘客在移動中讀取資訊的速度與準確性。

本文件定義語意層級與驗收條件。它不表示目前 `index.css` 的 Hanken Grotesk、JetBrains Mono 或現有 Tailwind 字級已符合目標規格。

## 字體方向

### 介面與內文

在選定並合法自託管品牌字體前，介面使用平台 system stack，避免載入另一套通用 Google grotesque 作為假性品牌：

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "PingFang TC",
  "Hiragino Sans",
  "Yu Gothic UI",
  "Malgun Gothic",
  "Microsoft JhengHei",
  sans-serif;
```

- 介面需要中性、清晰並具有完整繁中、日文、韓文與拉丁字元 fallback。
- 品牌 Display face 若未經實際字樣、授權、載入效能及多語系評估，不在文件中假裝已選定。
- 不以 Hanken Grotesk、Inter、Space Grotesk 等常見免費 grotesque 承載品牌識別。
- 不以 JetBrains Mono 或其他 mono 作為 caption、按鈕、站名、來源說明與一般 metadata 的 house voice。
- 真正的程式碼、原始 provider ID 等工程資料才可使用 mono；乘客介面通常不需要顯示這些內容。

### 時間與數字

時間、票價、月台與行程長度沿用介面字體，透過 OpenType 數字特性對齊：

```css
font-variant-numeric: tabular-nums lining-nums;
font-feature-settings: "tnum" 1, "lnum" 1;
```

- 不用 mono 字體解決時間對齊。
- 出發與抵達時間必須使用一致數字寬度，更新時不造成卡片左右跳動。
- 貨幣符號、數字、小數與單位保留合理間距，不擠成一團。
- 跨日時間加上「翌日」或等價本地化訊息，不能只靠顏色或 `+1` 符號。

## 語意文字樣式

樣式以用途命名，不使用 `text-24`、`font-14` 等尺寸名稱作為公開 Interface。

| 語意樣式 | 行動版字級／行高 | 寬螢幕字級／行高 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| `display` | 32／38px | 40／46px | 650 至 750 | 少量品牌或空狀態主標，不用於一般結果頁 |
| `page-title` | 24／30px | 28／34px | 650 至 750 | 搜尋、收藏、提醒等頁面標題 |
| `section-title` | 18／24px | 20／26px | 600 至 700 | 結果群組、服務狀態區段 |
| `journey-time` | 28／32px | 32／36px | 650 至 750 | 主要出發或抵達時間，使用 tabular numerals |
| `route-title` | 16／22px | 16／22px | 600 至 700 | 站名、路線名稱、行程卡標題 |
| `body` | 16／24px | 14／21px | 400 至 500 | 一般操作說明與內容 |
| `body-strong` | 16／24px | 14／21px | 600 至 650 | 控制標題與重要摘要 |
| `label` | 14／20px | 13／18px | 500 至 650 | 欄位 label、按鈕與短狀態 |
| `caption` | 12／17px | 12／17px | 400 至 550 | 來源、更新時間、次要站名 |
| `micro` | 11／15px | 11／15px | 500 至 650 | 極短且非必要 metadata，不能承載主要操作或警示 |

### 使用限制

- 同一畫面主要使用 4 至 6 個語意層級，不為每個區塊發明新尺寸。
- 行動裝置的 input、select 與 textarea 文字至少 16px，避免聚焦自動放大。
- `micro` 不能用於資料來源限制、錯誤、主要 CTA、站名或轉乘警示。
- Display headline 控制在一至兩行，不讓強調詞孤立成第三或第四行。
- 不用全頁粗體補救層級；字級、空間與色調共同建立資訊排序。

## TransitRail 資訊優先順序

### 搜尋畫面

1. 起點、終點與已選值。
2. 服務日期、時間與搜尋動作。
3. 國家、營運商與資料可查範圍。
4. 歷史、收藏與輔助說明。

### 結果卡

1. 出發時間、抵達時間、總時長與是否跨日。
2. 起終站、路線與轉乘數。
3. 月台、等待時間、班次狀態與服務中斷。
4. 票價、營運商、官方來源與讀取時間。
5. 收藏、提醒、分享與加入行事曆等操作。

主要時間不能因 badge、國旗、裝飾圖示或長營運商名稱失去視覺主導。重大警示則可優先於一般 metadata，但不得只靠高飽和顏色表示。

## 多語系與站名

- UI 文案目前涵蓋 EN、zh-TW，預渲染路線頁另有 ja、ko、fr、de；語意樣式必須容納所有這些字系與較長翻譯。
- 站名依 `stationLabel()` 與 country override 顯示，不能用截短後的顯示名稱作搜尋 key。
- 使用雙語站名時，主要名稱用 `route-title` 或 `body-strong`，次要名稱用 `caption`；兩者不能同時搶主導。
- 中文、日文與韓文不使用英文式 uppercase、過度 letter-spacing 或強制單字間空格。
- 德文與法文允許按詞換行；按鈕與 label 不以固定寬度切掉字尾。
- 數字、日期與時間使用 locale formatter；API 值與畫面顯示值分離。
- 對螢幕閱讀器提供完整站名與狀態，不讓視覺省略號成為 accessible name。

## 換行、截斷與密度

- 主要站名、警示、錯誤與操作文字優先換行，不截斷。
- 車站清單可在空間有限時截斷視覺文字，但必須可取得完整名稱，且不能只依靠 hover tooltip。
- 時間欄保持穩定寬度；站名欄彈性換行，避免互相擠壓。
- 行程卡不能用固定高度裁切長站名、多段轉乘或翻譯文案。
- `overflow: hidden`、`line-clamp` 與 `clip-path` 只能用於明確的次要摘要，並提供完整內容入口。
- 顯示數字與單位之間保留空間，例如 `12 min`、`NT$ 1,280`，不要使用過度負 tracking。

## 色彩、對比與狀態

- 一般文字、次要文字、placeholder、disabled 與錯誤都需要各自明確的色調角色。
- 來源與更新時間雖是次要資訊，仍不可低對比到難以閱讀。
- 服務中斷、錯誤、成功與選取狀態不能只靠文字顏色；搭配具體文案和必要圖示。
- 文字放在國家色、圖片或漸層上時，必須以實際像素檢查對比，不以設計 token 名稱推定安全。
- Dark mode 不是將灰階反相；每一種文字角色都需在實際背景上驗證。
- 強制色彩模式中仍需保留標題、焦點、錯誤與控制邊界。

## 響應式與縮放

- 320px 寬度下，頁面標題、站名、時間與 CTA 不互相覆蓋。
- 200% browser zoom 下保持單欄重排，不水平捲動主要任務區。
- 使用者調整文字大小或 text spacing 時，不裁切、重疊或隱藏內容。
- 行動橫向與桌面寬螢幕可以提高資訊密度，但不縮小核心文字。
- Safe-area 與 BottomNav 不能遮住最後一行文字或頁面主要操作。
- 動畫停止或 JavaScript 尚未執行時，文字仍預設可見。

## 實作 token

目標語意 token：

```css
:root {
  --font-interface: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "PingFang TC", "Hiragino Sans", "Yu Gothic UI",
    "Malgun Gothic", "Microsoft JhengHei", sans-serif;

  --text-page-title-size: 1.5rem;
  --text-page-title-line: 1.875rem;
  --text-journey-time-size: 1.75rem;
  --text-journey-time-line: 2rem;
  --text-body-size: 1rem;
  --text-body-line: 1.5rem;
  --text-label-size: 0.875rem;
  --text-label-line: 1.25rem;
  --text-caption-size: 0.75rem;
  --text-caption-line: 1.0625rem;
}
```

- Tailwind class 可以作為 implementation，但元件 Interface 與文件使用語意名稱。
- 字重與 line-height 一併定義，不讓呼叫端自由拼出無限組合。
- 品牌字體未選定前，不建立指向不存在檔案的 `@font-face`。
- 字體變更需要以主要搜尋頁、車站選擇器與至少四種國家結果頁做視覺回歸。

## 驗收證據

1. 搜尋頁、車站選擇器、直達結果、多段轉乘、服務警示與無資料畫面截圖。
2. EN、zh-TW、ja、ko、fr、de 的長字串與站名壓力測試。
3. 320px、桌面寬度、200% zoom 與使用者文字間距設定的畫面。
4. 出發／抵達時間更新時 tabular numerals 不造成水平跳動。
5. Light、dark、強制色彩模式與實際背景上的文字對比檢查。
6. 字體載入失敗或品牌字體尚未載入時，fallback 不造成控制裁切或大幅 layout shift。
7. 逐項確認沒有 mono house voice、全頁 tracked caps、Google 預設品牌字體、漸層 headline 或低對比 metadata。

沒有上述畫面與測試證據時，只能說明 Typography 規格已建立，不能宣稱視覺品質或無障礙已通過。
