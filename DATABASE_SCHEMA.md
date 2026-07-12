# TransitRail 資料庫資料表說明

更新日期：2026-07-12

## 範圍與架構

本文件只盤點應用程式程式碼明確定義、並會寫入 PostgreSQL 的資料表。資料庫由 Drizzle ORM 透過 Neon serverless driver 連線，使用 `DATABASE_URL`。未設定此變數時，資料庫寫入會略過：回饋 API 仍回傳成功，稽核事件也不會影響主要 API 的回應。**`push_subscriptions` 是例外**——Web Push 訂閱本質上需要伺服器持久化狀態才能運作，`DATABASE_URL` 未設定時 `/api/push/*` 直接回傳 501，沒有優雅降級路徑。

程式目前定義下列三張表：

| 資料表 | 用途 | 主要寫入來源 |
| --- | --- | --- |
| `feedbacks` | 使用者送出的回饋 | `POST /api/feedbacks` |
| `TN_AUDIT_LOG` | 搜尋、站點目錄與定位操作的稽核紀錄 | `/api/transit/*` 路由 |
| `push_subscriptions` | Web Push 訂閱與收藏路線的時刻表變動通知 | `POST /api/push/subscribe`、`scripts/check-push-notifications.ts` |

> 注意：repository 內沒有 Drizzle migration 目錄或 migration 指令。因此本文件描述的是目前程式碼 schema；實際部署資料庫是否已建立或同步這些表，需以目標資料庫查詢結果為準（可用 `npx drizzle-kit push` 依 `drizzle.config.ts` 同步 schema）。

## `feedbacks`：使用者回饋

用途：儲存使用者從回饋表單提交的分類、內容與選填聯絡／地理資訊。

| 欄位 | 型別 | 可否為空 | 說明 |
| --- | --- | --- | --- |
| `id` | `serial` | 否 | 主鍵，自動遞增。 |
| `category` | `varchar(100)` | 否 | 回饋分類。 |
| `content` | `text` | 否 | 回饋文字內容。 |
| `contact` | `varchar(255)` | 是 | 使用者選填的聯絡方式。 |
| `latitude` | `double precision` | 是 | 使用者提供的位置緯度。 |
| `longitude` | `double precision` | 是 | 使用者提供的位置經度。 |
| `county` | `varchar(100)` | 是 | 縣市。 |
| `district` | `varchar(100)` | 是 | 鄉鎮市區。 |
| `location_method` | `varchar(50)` | 是 | 位置取得方式。 |
| `created_at` | `timestamp with time zone` | 是 | 預設為寫入當下時間。 |

寫入流程：前端回饋表單呼叫 `POST /api/feedbacks`。後端要求 `category` 與 `content`，有設定 `DATABASE_URL` 時才會插入；沒有設定時會記錄 warning，但仍回傳 `{ success: true }`。

讀取狀態：目前未找到此表的查詢、列表或管理 API，因此程式碼中只有寫入路徑。

## `TN_AUDIT_LOG`：交通操作稽核紀錄

用途：記錄交通查詢、站點目錄瀏覽、站點選擇及最近車站定位等操作的上下文、結果數量與裝置／粗略地理資訊。

| 欄位 | 型別 | 可否為空 | 說明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 否 | 主鍵，預設隨機 UUID。 |
| `session_id` | `text` | 是 | 前端稽核 session ID。 |
| `transport_type` | `text` | 否 | 運輸類型；目前寫入 `rail`。 |
| `origin_station_id` | `text` | 是 | 起站 ID。 |
| `origin_station_name` | `text` | 是 | 起站名稱或查詢目標。 |
| `dest_station_id` | `text` | 是 | 迄站 ID。 |
| `dest_station_name` | `text` | 是 | 迄站名稱。 |
| `query_date` | `date` | 是 | 查詢日期。 |
| `trip_type` | `text` | 是 | 行程類型。 |
| `return_date` | `date` | 是 | 回程日期。 |
| `active_filter` | `text` | 是 | 事件、國家與結果等以字串編碼的篩選資訊。 |
| `result_count` | `integer` | 是 | 查詢或操作結果數。 |
| `language` | `text` | 是 | 使用者語言。 |
| `timezone` | `text` | 是 | 使用者時區。 |
| `device_type` | `text` | 是 | 裝置類型；可由 User-Agent 推定。 |
| `screen_width` | `integer` | 是 | 螢幕寬度。 |
| `screen_height` | `integer` | 是 | 螢幕高度。 |
| `user_agent` | `text` | 是 | 瀏覽器 User-Agent。 |
| `country_code` | `text` | 是 | Vercel 提供的國家代碼。 |
| `region` | `text` | 是 | Vercel 提供的地區資訊。 |
| `city` | `text` | 是 | Vercel 提供的城市資訊。 |
| `created_at` | `timestamp with time zone` | 否 | 建立時間，預設為寫入當下時間。 |
| `postal_code` | `text` | 是 | Vercel 提供的郵遞區號。 |
| `latitude` | `numeric(9,6)` | 是 | 事件傳入的緯度。 |
| `longitude` | `numeric(9,6)` | 是 | 事件傳入的經度。 |
| `ip_timezone` | `text` | 是 | Vercel 提供的 IP 時區。 |
| `geo_latitude` | `double precision` | 是 | Vercel 提供的地理緯度。 |
| `geo_longitude` | `double precision` | 是 | Vercel 提供的地理經度。 |
| `geo_accuracy` | `double precision` | 是 | 用戶端回報的位置精度。 |

目前寫入時機：

- `GET /api/transit/search`：記錄起迄站、日期、國家、時間篩選、資料來源、HTTP 狀態與結果數。
- `POST /api/transit/audit`：記錄前端主動送出的車站選擇、站點瀏覽等事件。
- `GET /api/transit/stations`：記錄站點目錄讀取或搜尋。
- `GET /api/transit/nearest-station`：記錄最近站點查詢與位置精度。

稽核寫入失敗會被捕捉並只輸出伺服器錯誤日誌，不會改變原本 API 的回應。部分 schema 欄位（例如 `origin_station_id`、`dest_station_id`、`trip_type`、`return_date`）目前已保留但尚未在現有寫入 payload 中賦值。程式碼目前也沒有讀取此表的查詢 API。

## `push_subscriptions`：Web Push 訂閱與收藏路線監控

用途：儲存瀏覽器 Push API 訂閱憑證，以及該訂閱要監控的收藏路線清單與其最近一次已知的時刻表指紋（首末班車時間、班次數）。**這是唯一一張沒有優雅降級路徑的表**——真正的推播（App 關閉時仍能送達）必須由伺服器主動觸發，因此無法像 `feedbacks` 那樣在 `DATABASE_URL` 未設定時安靜跳過寫入；`/api/push/subscribe`、`/api/push/unsubscribe` 在缺少 `DATABASE_URL` 或 VAPID 金鑰時直接回傳 `501`。

| 欄位 | 型別 | 可否為空 | 說明 |
| --- | --- | --- | --- |
| `id` | `serial` | 否 | 主鍵，自動遞增。 |
| `endpoint` | `text` | 否 | Push API 訂閱端點 URL；每個瀏覽器／裝置註冊唯一，`UNIQUE` 約束。 |
| `p256dh_key` | `text` | 否 | 訂閱的加密公鑰（Push API 標準欄位）。 |
| `auth_key` | `text` | 否 | 訂閱的驗證密鑰（Push API 標準欄位）。 |
| `watched_routes` | `jsonb` | 否 | `WatchedRoute[]`（見 `src/db/schema.ts`）：每筆含 `origin`／`destination`／`country`，以及選填的 `fingerprint`（`first`／`last`／`departures`，即上次檢查時的時刻表快照）。 |
| `language` | `text` | 是 | 訂閱當下的 UI 語言，決定通知文字的語言。 |
| `created_at` | `timestamp with time zone` | 否 | 建立時間，預設為寫入當下時間。 |
| `updated_at` | `timestamp with time zone` | 否 | 最後一次更新時間（重新訂閱、監控路線變動、或每日檢查後寫回新指紋）。 |

寫入流程：

- `GET /api/push/vapid-public-key`：回傳公開金鑰，供前端 `pushManager.subscribe()` 使用；未設定 VAPID 金鑰時回傳 `{ publicKey: null }`，前端據此隱藏此功能入口。
- `POST /api/push/subscribe`：前端在使用者啟用通知、或收藏路線清單變動時呼叫。以 `endpoint` 為衝突鍵 upsert；每筆路線會先呼叫 `findScrapedResults` 取得當下的時刻表指紋作為初始基準，避免第一次檢查就誤判「已變動」。
- `POST /api/push/unsubscribe`：使用者關閉通知時呼叫，依 `endpoint` 刪除該筆訂閱。
- `scripts/check-push-notifications.ts`：由 `.github/workflows/scrape.yml` 在每日 scrape 提交完成後執行。對每筆訂閱的每條監控路線重新查詢時刻表、比對指紋，有變動就透過 `web-push` 送出通知並更新 `watched_routes` 的指紋；推播失敗回傳 404／410（訂閱已失效）時會直接刪除該筆訂閱。

## 非 PostgreSQL 資料表的儲存

以下資料有儲存行為，但不是後端資料庫資料表，不應與上述資料表混列：

| 類型 | 位置／機制 | 說明 |
| --- | --- | --- |
| 時刻表資料 | `src/data/scraped/<country>/*.json` | 爬蟲或快照產生的版本控制 JSON；搜尋時由伺服器讀取。 |
| 搜尋快取 | 瀏覽器 IndexedDB（`idb-keyval`） | 前端快取搜尋結果，不會寫入 PostgreSQL。 |
| 使用者偏好、收藏行程與 audit session | `localStorage`／`sessionStorage` | 只存在使用者瀏覽器端；`push_subscriptions.watched_routes` 只存路線識別資訊與指紋的伺服器端副本，不是收藏行程本身的權威來源。 |

## 相關程式位置

- Schema：`src/db/schema.ts`
- 資料庫連線：`src/db/index.ts`
- Drizzle 設定：`drizzle.config.ts`
- 回饋、稽核與 Push 訂閱寫入：`server.ts`
- 每日推播檢查：`scripts/check-push-notifications.ts`（由 `.github/workflows/scrape.yml` 排程執行）
- Push 環境變數：`.env.example`（`VAPID_PUBLIC_KEY`／`VAPID_PRIVATE_KEY`／`VAPID_SUBJECT`）
- Telemetry 環境變數範本：`.env.example`
