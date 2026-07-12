import {
  pgTable,
  text,
  integer,
  date,
  timestamp,
  numeric,
  doublePrecision,
  uuid,
  serial,
  varchar,
  jsonb
} from "drizzle-orm/pg-core";

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  content: text("content").notNull(),
  contact: varchar("contact", { length: 255 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  county: varchar("county", { length: 100 }),
  district: varchar("district", { length: 100 }),
  locationMethod: varchar("location_method", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const tnAuditLog = pgTable("TN_AUDIT_LOG", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id"),
  transportType: text("transport_type").notNull(),
  originStationId: text("origin_station_id"),
  originStationName: text("origin_station_name"),
  destStationId: text("dest_station_id"),
  destStationName: text("dest_station_name"),
  queryDate: date("query_date"),
  tripType: text("trip_type"),
  returnDate: date("return_date"),
  activeFilter: text("active_filter"),
  resultCount: integer("result_count"),
  language: text("language"),
  timezone: text("timezone"),
  deviceType: text("device_type"),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  userAgent: text("user_agent"),
  countryCode: text("country_code"),
  region: text("region"),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  postalCode: text("postal_code"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  ipTimezone: text("ip_timezone"),
  geoLatitude: doublePrecision("geo_latitude"),
  geoLongitude: doublePrecision("geo_longitude"),
  geoAccuracy: doublePrecision("geo_accuracy"),
});

/** One saved-route watch entry inside a subscription's `watched_routes` JSON array. */
export interface WatchedRoute {
  origin: string;
  destination: string;
  country: string;
  /** Canonical-day timetable snapshot from the last check; compared against the
   *  latest scrape to decide whether to notify. Undefined until the first check runs. */
  fingerprint?: {
    first?: string;
    last?: string;
    departures: number;
  };
}

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  /** The Push API subscription endpoint URL; unique per browser/device registration. */
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  watchedRoutes: jsonb("watched_routes").$type<WatchedRoute[]>().notNull().default([]),
  language: text("language"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
