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
import { sql } from "drizzle-orm";
import { uniqueIndex } from "drizzle-orm/pg-core";

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
  /** Affiliate offer id for impression/click attribution. */
  target: text("target"),
  /** Structured, non-identifying event context (affiliate placement/partner). */
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

/** One saved-route watch entry inside a subscription's `watched_routes` JSON array. */
export interface WatchedRoute {
  origin: string;
  destination: string;
  country: string;
  /** The service date and query time the user saved, when available. */
  serviceDate?: string;
  selectedTime?: string;
  /** Canonical-day timetable snapshot from the last check; compared against the
   *  latest scrape to decide whether to notify. Undefined until the first check runs. */
  fingerprint?: {
    first?: string;
    last?: string;
    departures: number;
    serviceDate?: string;
    serviceDayType?: "weekday" | "saturday" | "sunday_holiday" | "special";
    coverage?: "supported" | "partial";
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

export type ErrorLogSeverity = "warning" | "error" | "critical";
export type ErrorLogStatus = "open" | "resolved" | "ignored";

/**
 * Server-side operational failures. Repeated open incidents with the same
 * fingerprint are aggregated once per UTC day; resolved/ignored incidents
 * remain immutable history and a recurrence opens a new row.
 */
export const errorLogs = pgTable(
  "error_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull(),
    occurrenceDate: date("occurrence_date").notNull(),
    severity: varchar("severity", { length: 20 }).$type<ErrorLogSeverity>().notNull(),
    status: varchar("status", { length: 20 }).$type<ErrorLogStatus>().notNull().default("open"),
    module: varchar("module", { length: 120 }).notNull(),
    operation: varchar("operation", { length: 160 }).notNull(),
    errorCode: varchar("error_code", { length: 160 }),
    message: text("message").notNull(),
    stack: text("stack"),
    country: varchar("country", { length: 80 }),
    provider: varchar("provider", { length: 200 }),
    httpStatus: integer("http_status"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    firstContext: jsonb("first_context").$type<Record<string, unknown>>(),
    lastContext: jsonb("last_context").$type<Record<string, unknown>>(),
    firstOccurredAt: timestamp("first_occurred_at", { withTimezone: true }).notNull(),
    lastOccurredAt: timestamp("last_occurred_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("error_log_open_fingerprint_day_uq")
      .on(table.fingerprint, table.occurrenceDate)
      .where(sql`${table.status} = 'open'`),
  ],
);
