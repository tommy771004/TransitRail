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
  campaign_code text,
  industry_type text,
  conversion_type text,
  cookie_days integer,
  commission text,
  notes text,
  PRIMARY KEY (project_name, id)
);

ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS campaign_code text;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS industry_type text;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS conversion_type text;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS cookie_days integer;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS commission text;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS notes text;

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

INSERT INTO affiliates (
  project_name, id, enabled, sponsored, title, description, cta_label, url,
  categories, crops, priority, partner, campaign_code, industry_type,
  conversion_type, cookie_days, commission, notes
) VALUES
  ('transitrail', 'tripadvisor-1583', true, false, 'TripAdvisor', 'Travel community and hotel booking.', 'View offer', 'https://www.tripadvisor.com/', ARRAY['all'], ARRAY[]::text[], 1583, 'TripAdvisor', '1583', 'Travel community / Hotel booking', 'CPS', 14, '5.60%–70.00%', 'Highest commission rate'),
  ('transitrail', '12go-6965', true, false, '12Go', 'Transport ticketing and route planning.', 'View offer', 'https://12go.asia/', ARRAY['all'], ARRAY[]::text[], 6965, '12Go', '6965', 'Transport ticketing', 'CPS', 30, '35.00%', 'New campaign with high transport commission'),
  ('transitrail', 'edreams-6060', true, false, 'eDreams', 'Flights, accommodation and travel.', 'View offer', 'https://www.edreams.com/', ARRAY['all'], ARRAY[]::text[], 6060, 'eDreams', '6060', 'Flights / Accommodation / Travel', 'CPA', 30, 'NT$903.08 + 4.20%', 'Highest fixed per-order reward'),
  ('transitrail', 'getyourguide-2868', true, false, 'GetYourGuide', 'Tickets, tours and activities.', 'View offer', 'https://www.getyourguide.com/', ARRAY['all'], ARRAY[]::text[], 2868, 'GetYourGuide', '2868', 'Tickets / Activities', 'CPS', 30, '8.50%', 'High reward for experiences'),
  ('transitrail', 'accor-plus-singapore-4159', true, false, 'Accor Plus Singapore', 'Hotel membership and bookings.', 'View offer', 'https://www.accorplus.com/sg/', ARRAY['all'], ARRAY[]::text[], 4159, 'Accor Plus Singapore', '4159', 'Travel platform / Hotels', 'CPS', 30, '8.50%', 'High reward for memberships and stays'),
  ('transitrail', 'camping-flying-5690', true, false, 'Camping Flying', 'Camping and outdoor equipment.', 'View offer', 'https://www.campingflying.com/', ARRAY['all'], ARRAY[]::text[], 5690, 'Camping Flying', '5690', 'Camping equipment', 'CPS', 90, '8.25%', 'High outdoor reward with long cookie window'),
  ('transitrail', 'cheapoair-1481', true, false, 'CheapOAir', 'Flight booking.', 'View offer', 'https://www.cheapoair.com/', ARRAY['all'], ARRAY[]::text[], 1481, 'CheapOAir', '1481', 'Flight booking', 'CPL', 90, 'NT$172.23', 'Long 90-day cookie window'),
  ('transitrail', 'booking-com-2169', true, false, 'Booking.com', 'Accommodation booking.', 'View offer', 'https://www.booking.com/', ARRAY['all'], ARRAY[]::text[], 2169, 'Booking.com', '2169', 'Accommodation booking', 'CPS', 2, '4.50%', 'High brand awareness; short cookie window'),
  ('transitrail', 'agoda-2148', true, false, 'Agoda', 'Accommodation booking.', 'View offer', 'https://www.agoda.com/', ARRAY['all'], ARRAY[]::text[], 2148, 'Agoda', '2148', 'Accommodation booking', 'CPS', 1, '4.20%', 'High conversion; one-day cookie window')
ON CONFLICT (project_name, id) DO NOTHING;
