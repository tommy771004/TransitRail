-- Shared affiliate catalog for TransitRail.
-- Run this against SUP_DATABASE_URL, not the app's DATABASE_URL.

CREATE TABLE IF NOT EXISTS affiliates (
  project_name text NOT NULL,
  id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sponsored boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  description text NOT NULL,
  cta_label text NOT NULL,
  url text NOT NULL,
  icon text,
  categories text[] NOT NULL DEFAULT ARRAY['all'],
  crops text[] NOT NULL DEFAULT ARRAY[]::text[],
  priority integer NOT NULL DEFAULT 0,
  partner text,
  PRIMARY KEY (project_name, id)
);

-- These public campaign pages are safe starter records. Replace `url` with
-- each approved tracking/deep link in the affiliate administration system.
-- Existing externally managed TransitRail rows are never overwritten.
INSERT INTO affiliates (
  project_name, id, enabled, sponsored, title, description, cta_label, url,
  categories, crops, priority, partner
) VALUES
  ('transitrail', 'klook-global-travel', true, false, 'Klook', '全球景點、票券、交通、旅遊服務｜活動 2328；4% CPS、30 天 Cookie。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog/post/klook-affiliate-program', ARRAY['all'], ARRAY[]::text[], 60, 'Klook'),
  ('transitrail', 'kkday-global-travel', true, false, 'KKday', '全球體驗、票券、包車、機場接送｜活動 1809；3.5% CPS、30 天 Cookie；覆蓋 52 國／170 城。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog/post/kkday-affiliate-program', ARRAY['all'], ARRAY[]::text[], 50, 'KKday'),
  ('transitrail', 'trip-com-travel', true, false, 'Trip.com', '機票、飯店、旅遊服務｜活動 2226；4.2% CPS、30 天 Cookie。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog/post/trip-dot-com-affiliate-program', ARRAY['all'], ARRAY[]::text[], 40, 'Trip.com'),
  ('transitrail', 'tocoo-japan-car-rental', true, false, 'TOCOO! 日本租車網', '日本租車｜近期新合作商家，適合日本路線搜尋後推薦。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog?page=6', ARRAY['all'], ARRAY['japan'], 70, 'TOCOO!'),
  ('transitrail', 'joytel-esim', true, false, 'JOYTEL 卓一電訊', '出國上網卡／eSIM｜活動 5884；7% CPS、30 天 Cookie。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog/post/joytel-zhuo-dian-xun-tai-wan-affiliate-program', ARRAY['all'], ARRAY[]::text[], 30, 'JOYTEL 卓一電訊'),
  ('transitrail', 'colatour-travel', true, false, 'colatour 可樂旅遊', '機票、住宿、票券、交通票券、網卡｜活動 6788；5.5% CPS、30 天 Cookie。', '查看活動', 'https://blog.affiliates.one/zh-TW/blog/post/colatour-affiliate-program', ARRAY['all'], ARRAY[]::text[], 20, 'colatour 可樂旅遊')
ON CONFLICT (project_name, id) DO NOTHING;
