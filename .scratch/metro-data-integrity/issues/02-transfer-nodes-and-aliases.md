# 02 — 轉乘鏈接納入中途停站與換乘站別名

**What to build:** 讓跨線轉乘能在**真實的換乘站**發生，而不是只能在路線檔剛好的起訖點。

今天使用者查港鐵荃灣線到東涌線的行程會查不到，因為兩條線的交會點荔景只出現在班次的停站序列裡，不是任何路線檔的端點，而轉乘鏈接建圖時只認端點。同樣地，曼谷 BTS 與 MRT 在同一個轉乘點使用不同名稱（Asok / Sukhumvit），拓撲靠站名字串相同推導，於是整組跨系統換乘全部漏失。

完成後：路線的中途停站可以作為換乘點；兩系統對同一轉乘點的不同稱呼會被視為同一個地方。

**Blocked by:** None — can start immediately.

**Status:** resolved

**驗證（2026-08-02）：** 港鐵線 14→10（重複線已合併）；曼谷換乘站 4→12，含 Asok↔Sukhumvit、Mo Chit↔Chatuchak Park、Sala Daeng↔Si Lom、Ha Yaek Lat Phrao↔Phahon Yothin；findRoutePaths 納入 stops。

- [x] 轉乘鏈接建圖時，路線班次的中途停站可作為換乘節點（不再只有路線檔的起訖點）
- [x] 建立換乘站別名對照，至少涵蓋：Asok↔Sukhumvit、Sala Daeng↔Si Lom、Mo Chit↔Chatuchak Park、Ha Yaek Lat Phrao↔Phahon Yothin、Central↔Hong Kong、Tsim Sha Tsui↔East Tsim Sha Tsui
- [x] 線路拓撲的換乘推導改為經別名解析，曼谷推導出的換乘站數由 4 增加至涵蓋上列各點
- [x] 修正港鐵拓撲的重複線：合併 `East Rail Line` 與 `East Rail Line via Racecourse`，去除重複的 `Tseung Kwan O Line`
- [x] 港鐵推導出的換乘站由 31 降為 21，且不再包含沙田、大學、粉嶺、羅湖等同線變體造成的假換乘
- [x] 新增測試涵蓋「中途停站作為換乘點」與「異名換乘」兩種情境
- [x] `npm run lint` 綠燈
