# TransitRail

## 管理中心 Telemetry 設定

TransitRail 的搜尋、站點目錄、最近車站與回饋操作，會在**不傳送個人資料**的前提下，送至整合管理中心的產品 Telemetry。三個變數都只能設定在伺服器端（本機 `.env.local` 或 Vercel Environment Variables），不可使用 `VITE_` 前綴，也不可寫進前端程式碼。

| 變數 | 值 | 說明 |
| --- | --- | --- |
| `TELEMETRY_INGEST_URL` | `https://<管理中心網域>/api/telemetry/ingest` | 整合管理中心的簽名接收端點 |
| `TELEMETRY_PROJECT_KEY` | `transit` | 固定專案識別，必須與管理中心 JSON 的 key 相同 |
| `TELEMETRY_INGEST_KEY` | 隨機密鑰 | 與管理中心 `TELEMETRY_INGEST_KEYS` 內的 `transit` 值完全相同 |

### 設定步驟

1. 產生一組隨機密鑰，例如：`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`。
2. 在**管理中心**的 Vercel Project → Settings → Environment Variables，將該值放進 `TELEMETRY_INGEST_KEYS` 的 `transit` 欄位：

   ```text
   TELEMETRY_INGEST_KEYS={"pikmin":"<pikmin-key>","veggie":"<veggie-key>","rail":"<rail-key>","estate":"<estate-key>","transit":"<剛產生的密鑰>"}
   ```

3. 在 **TransitRail** Vercel Project 的 Production 與 Preview 設定上述三個變數；`TELEMETRY_INGEST_KEY` 填入同一組密鑰。
4. 兩個專案都 Redeploy。完成後執行一次路線搜尋或站點操作，可在管理中心 `/telemetry` 的 `transit` 專案看到事件。

Telemetry 只送出事件名稱、結果數、HTTP 狀態、是否含國家／時間篩選等摘要；不送出站名、搜尋字串、座標、session、User-Agent、聯絡資料或回饋內容。
