# TransitRail 資料庫資料表說明

更新日期：2026-07-10

## 範圍與架構

本文件只盤點應用程式程式碼明確定義、並會寫入 PostgreSQL 的資料表。資料庫由 Drizzle ORM 透過 Neon serverless driver 連線，使用 `DATABASE_URL`。未設定此變數時，資料庫寫入會略過：回饋 API 仍回傳成功，稽核事件也不會影響主要 API 的回應。

程式目前只定義下列兩張表：

| 資料表 | 用途 | 主要寫入來源 |
| --- | --- | --- |
| `feedbacks` | 使用者送出的回饋 | `POST /api/feedbacks` |
| `TN_AUDIT_LOG` | 搜尋、站點目錄與定位操作的稽核紀錄 | `/api/transit/*` 路由 |

> 注意：repository 內沒有 Drizzle migration 目錄或 migration 指令。因此本文件描述的是目前程式碼 schema；實際部署資料庫是否已建立或同步這些表，需以目標資料庫查詢結果為準。

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

## 非 PostgreSQL 資料表的儲存

以下資料有儲存行為，但不是後端資料庫資料表，不應與上述兩表混列：

| 類型 | 位置／機制 | 說明 |
| --- | --- | --- |
| 時刻表資料 | `src/data/scraped/<country>/*.json` | 爬蟲或快照產生的版本控制 JSON；搜尋時由伺服器讀取。 |
| 搜尋快取 | 瀏覽器 IndexedDB（`idb-keyval`） | 前端快取搜尋結果，不會寫入 PostgreSQL。 |
| 使用者偏好與 audit session | `localStorage`／`sessionStorage` | 只存在使用者瀏覽器端。 |

## 相關程式位置

- Schema：`src/db/schema.ts`
- 資料庫連線：`src/db/index.ts`
- Drizzle 設定：`drizzle.config.ts`
- 回饋與稽核寫入：`server.ts`
- Telemetry 環境變數範本：`.env.example`
