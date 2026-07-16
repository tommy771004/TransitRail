// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Express server handling APIs for worldwide transit routes, station catalogs, and currency rates

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { findScrapedResults, loadScrapedData } from "./src/data/scraped";
import { getCbcRates } from "./src/server/cbc";
import { getExternalExchangeRates } from "./src/server/exchangeRates";
import type { Country } from "./src/types";
import { db } from "./src/db";
import { feedbacks, tnAuditLog, pushSubscriptions, type WatchedRoute } from "./src/db/schema";
import { getStationsForCountry, getLinesForCountry } from "./src/server/catalog";
import { transferCatalog, getTransferInfo } from "./src/data/transfers";
import { findNearestKnownStation } from "./src/utils/geoCoordinates";
import { getTransitSituations } from "./src/server/situations";
import { countryOptions, providerDateValue } from "./src/data/countries";
import { runTransitSearch } from "./src/server/transitSearch";
import { timetableFingerprint } from "./src/utils/timetableChanges";

dotenv.config();

const app = express();

loadScrapedData();
app.use(express.json());

type TelemetryProperties = Record<string, string | number | boolean | null>;

/**
 * Send only server-generated, non-identifying product events to the Admin Console.
 * If the optional telemetry environment variables are absent, TransitRail keeps working.
 */
async function sendTelemetry(name: string, properties: TelemetryProperties) {
  const url = process.env.TELEMETRY_INGEST_URL;
  const project = process.env.TELEMETRY_PROJECT_KEY;
  const secret = process.env.TELEMETRY_INGEST_KEY;
  if (!url || !project || !secret) return;

  const rawBody = JSON.stringify({
    events: [
      {
        id: randomUUID(),
        name,
        source: "server",
        occurredAt: new Date().toISOString(),
        properties,
      },
    ],
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telemetry-project": project,
        "x-telemetry-timestamp": timestamp,
        "x-telemetry-signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) console.warn(`[telemetry] ${name} rejected: ${response.status}`);
  } catch (error) {
    console.warn("[telemetry] delivery failed:", error instanceof Error ? error.message : error);
  }
}

function eventGroup(value: string | undefined) {
  if (value?.startsWith("station.")) return "station";
  if (value?.startsWith("search.")) return "search";
  return "other";
}

function readHeader(req: express.Request, name: string) {
  const value = req.header(name);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseInteger(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDecimal(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

const legacyAuditEventAliases: Record<string, string> = {
  station_browser_open: "station.browser.open",
  station_selected: "station.select",
  nearest_station_failed: "station.geolocation.failed",
};

function normalizeAuditEvent(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const aliased = legacyAuditEventAliases[trimmed] ?? trimmed;
  return aliased.toLowerCase().replace(/_/g, ".");
}

function encodeAuditValue(value: string | number) {
  return encodeURIComponent(String(value));
}

function inferDeviceType(userAgent: string | undefined) {
  if (!userAgent) {
    return undefined;
  }

  const normalized = userAgent.toLowerCase();
  if (/(ipad|tablet)/.test(normalized)) {
    return "tablet";
  }
  if (/(mobi|android|iphone)/.test(normalized)) {
    return "mobile";
  }
  return "desktop";
}

function buildActiveFilter(input: {
  event: string;
  country?: string;
  tags?: Record<string, string | number | undefined>;
}) {
  const event = normalizeAuditEvent(input.event);
  if (!event) {
    return undefined;
  }

  const filters = [`event:${encodeAuditValue(event)}`];
  if (input.country) {
    filters.push(`country:${encodeAuditValue(input.country)}`);
  }

  const tags = Object.entries(input.tags ?? {})
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of tags) {
    filters.push(`tag:${key}=${encodeAuditValue(value as string | number)}`);
  }

  return filters.join("|");
}

async function insertAuditLog(
  req: express.Request,
  entry: {
    transportType: string;
    originStationName?: string;
    destStationName?: string;
    queryDate?: string;
    activeFilter?: string;
    resultCount?: number;
    latitude?: number;
    longitude?: number;
    geoAccuracy?: number;
  },
) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const userAgent = readHeader(req, "user-agent");
  const acceptLanguage = readHeader(req, "accept-language");

  await db.insert(tnAuditLog).values({
    sessionId: readHeader(req, "x-tr-session-id"),
    transportType: entry.transportType,
    originStationName: entry.originStationName,
    destStationName: entry.destStationName,
    queryDate: normalizeDate(entry.queryDate),
    activeFilter: entry.activeFilter,
    resultCount: entry.resultCount,
    language: readHeader(req, "x-tr-language") ?? acceptLanguage?.split(",")[0]?.trim(),
    timezone: readHeader(req, "x-tr-timezone"),
    deviceType: readHeader(req, "x-tr-device-type") ?? inferDeviceType(userAgent),
    screenWidth: parseInteger(readHeader(req, "x-tr-screen-width")),
    screenHeight: parseInteger(readHeader(req, "x-tr-screen-height")),
    userAgent,
    countryCode: readHeader(req, "x-vercel-ip-country"),
    region: readHeader(req, "x-vercel-ip-country-region"),
    city: readHeader(req, "x-vercel-ip-city"),
    postalCode: readHeader(req, "x-vercel-ip-postal-code"),
    latitude: entry.latitude,
    longitude: entry.longitude,
    ipTimezone: readHeader(req, "x-vercel-ip-timezone"),
    geoLatitude: parseDecimal(readHeader(req, "x-vercel-ip-latitude")),
    geoLongitude: parseDecimal(readHeader(req, "x-vercel-ip-longitude")),
    geoAccuracy: entry.geoAccuracy,
  });
}

async function logTransitSearch(
  req: express.Request,
  search: {
    origin: string;
    destination: string;
    date: string;
    country?: string;
    time?: string;
    source?: string;
    statusCode: number;
    resultCount: number;
  },
) {
  await insertAuditLog(req, {
    transportType: "rail",
    originStationName: search.origin,
    destStationName: search.destination,
    queryDate: search.date,
    activeFilter: buildActiveFilter({
      event: "search.execute",
      country: search.country,
      tags: {
        "filter.departure_after": search.time && /^\d{2}:\d{2}$/.test(search.time) ? search.time : undefined,
        "result.source": search.source,
        "result.status": search.statusCode,
      },
    }),
    resultCount: search.resultCount,
  });
  void sendTelemetry("journey.search.completed", {
    has_country: Boolean(search.country),
    has_time_filter: Boolean(search.time),
    result_count: search.resultCount,
    status_code: search.statusCode,
  });
}

  app.get("/api/transit/search", async (req, res) => {
    const { origin, destination, country, date, time } = req.query;

    if (typeof origin !== "string" || typeof destination !== "string" || typeof date !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Origin, destination, and date are required.",
        results: [],
      });
    }

    const countryValue = typeof country === "string" ? country : undefined;
    const timeValue = typeof time === "string" ? time : undefined;

    const { statusCode, payload } = await runTransitSearch({
      origin,
      destination,
      date,
      country: countryValue,
      time: timeValue,
    });

    await logTransitSearch(req, {
      origin,
      destination,
      date,
      country: countryValue,
      time: timeValue,
      source: payload.source,
      statusCode,
      resultCount: payload.results.length,
    }).catch((error) => {
      console.error("[audit] Failed to record transit search:", error);
    });

    return res.status(statusCode).json(payload);
  });

  app.get("/api/transit/situations", async (req, res) => {
    const country = typeof req.query.country === "string" ? req.query.country as Country : undefined;
    if (country && !countryOptions.includes(country)) {
      return res.status(400).json({ error: "Invalid country.", situations: [] });
    }
    const situations = await getTransitSituations(country);
    res.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    return res.json({ situations, checkedAt: new Date().toISOString() });
  });

  app.post("/api/transit/audit", async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : undefined;
    const eventValue = normalizeAuditEvent(readText(body?.event) ?? readText(body?.action));

    if (!eventValue) {
      return res.status(400).json({ error: "Event is required." });
    }

    const countryValue = readText(body?.country);
    const targetValue = readText(body?.target);
    const stationValue = readText(body?.station);
    const lineIdValue = readText(body?.lineId);
    const reasonValue = readText(body?.reason);

    await insertAuditLog(req, {
      transportType: "rail",
      originStationName: targetValue === "origin" ? stationValue : undefined,
      destStationName: targetValue === "destination" ? stationValue : undefined,
      activeFilter: buildActiveFilter({
        event: eventValue,
        country: countryValue,
        tags: {
          "context.target": targetValue,
          "line.id": lineIdValue,
          "failure.reason": reasonValue,
        },
      }),
      resultCount: parseInteger(body?.resultCount),
      latitude: parseDecimal(body?.latitude),
      longitude: parseDecimal(body?.longitude),
      geoAccuracy: parseDecimal(body?.accuracy),
    }).catch((error) => {
      console.error("[audit] Failed to record transit event:", error);
    });
    void sendTelemetry("transit.action.recorded", {
      action_group: eventGroup(eventValue),
      has_country: Boolean(countryValue),
      result_count: parseInteger(body?.resultCount) ?? null,
    });

    return res.status(204).end();
  });

  app.get("/api/transit/stations", async (req, res) => {
    const { country, q } = req.query;
    const countryValue = typeof country === "string" ? country : undefined;
    const queryValue = typeof q === "string" ? q.trim() || undefined : undefined;
    let statusCode = 200;
    let payload: {
      stations: string[];
      source?: string;
      error?: string;
      message?: string;
    };

    try {
      const { stations, source } = await getStationsForCountry(country as string, q as string);
      payload = { stations, source };
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid country") {
        statusCode = 400;
        payload = {
          error: "Invalid country",
          message: "Country must be one of japan, korea, taiwan, singapore, malaysia, thailand, hong_kong, united_kingdom, united_states, germany, france, switzerland, china.",
          stations: [],
        };
      } else {
        statusCode = 502;
        payload = {
          error: "Provider request failed",
          message: error instanceof Error ? error.message : "Could not fetch stations.",
          stations: [],
        };
      }
    }

    await insertAuditLog(req, {
      transportType: "rail",
      originStationName: queryValue,
      activeFilter: buildActiveFilter({
        event: queryValue ? "station.catalog.search" : "station.catalog.fetch",
        country: countryValue,
        tags: {
          "query.term": queryValue,
          "result.source": payload.source,
          "result.status": statusCode,
        },
      }),
      resultCount: payload.stations.length,
    }).catch((error) => {
      console.error("[audit] Failed to record station catalog access:", error);
    });
    void sendTelemetry("station.catalog.completed", {
      has_country: Boolean(countryValue),
      has_query: Boolean(queryValue),
      result_count: payload.stations.length,
      status_code: statusCode,
    });

    return res.status(statusCode).json(payload);
  });

  app.get("/api/transit/nearest-station", async (req, res) => {
    const { country, lat, lng, accuracy } = req.query;
    const countryValue = typeof country === "string" ? country : undefined;
    const latitudeValue = parseDecimal(lat);
    const longitudeValue = parseDecimal(lng);
    const accuracyValue = parseDecimal(accuracy);
    let statusCode = 200;
    let payload: {
      station?: string;
      distanceKm?: number;
      matchedStationCount?: number;
      error?: string;
    };

    if (!countryValue || latitudeValue === undefined || longitudeValue === undefined) {
      statusCode = 400;
      payload = { error: "Missing required parameters: country, lat, lng" };
    } else {
      try {
        const { stations } = await getStationsForCountry(countryValue);
        if (stations.length === 0) {
          statusCode = 404;
          payload = { error: "No stations found for country" };
        } else {
          const nearest = findNearestKnownStation(stations, latitudeValue, longitudeValue);
          if (!nearest) {
            statusCode = 404;
            payload = { error: "No verified station coordinates are available for this country." };
          } else {
            payload = {
              station: nearest.station,
              distanceKm: Math.round(nearest.distanceKm * 100) / 100,
              matchedStationCount: nearest.matchedStationCount,
            };
          }
        }
      } catch (e) {
        console.error(e);
        statusCode = 500;
        payload = { error: "Failed to determine nearest station" };
      }
    }

    await insertAuditLog(req, {
      transportType: "rail",
      originStationName: payload.station,
      activeFilter: buildActiveFilter({
        event: "station.lookup.nearest",
        country: countryValue,
        tags: {
          "result.status": statusCode,
        },
      }),
      resultCount: payload.station ? 1 : 0,
      latitude: latitudeValue,
      longitude: longitudeValue,
      geoAccuracy: accuracyValue,
    }).catch((error) => {
      console.error("[audit] Failed to record nearest-station lookup:", error);
    });
    void sendTelemetry("station.nearest.completed", {
      has_country: Boolean(countryValue),
      result_count: payload.station ? 1 : 0,
      status_code: statusCode,
    });
      
    return res.status(statusCode).json(payload);
  });

  app.get("/api/exchange-rates", async (req, res) => {
    const requestedBase = typeof req.query.base === "string" ? req.query.base : "TWD";
    const base = /^[A-Za-z]{3}$/.test(requestedBase) ? requestedBase.toUpperCase() : "TWD";
    try {
      const cbcResult = await getCbcRates();
      if (cbcResult && cbcResult.rates) {
        const twdRates = cbcResult.rates;
        res.set({
          // Vercel's CDN keeps the gateway response available across
          // serverless cold starts while the module cache protects a warm one.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
          "X-Rate-Source": "cbc",
          "X-Rate-Cache": cbcResult.cacheStatus,
        });
        if (base === "TWD") {
          return res.json({
            base: "TWD",
            rates: twdRates,
            source: "cbc",
            updatedAt: cbcResult.updatedAt,
            cacheStatus: cbcResult.cacheStatus,
            cacheAgeSeconds: cbcResult.cacheAgeSeconds,
          });
        }
        const baseToTwd = twdRates[base];
        if (baseToTwd && baseToTwd > 0) {
          const converted: Record<string, number> = {};
          for (const [currency, rate] of Object.entries(twdRates)) {
            converted[currency] = rate / baseToTwd;
          }
          converted[base] = 1;
          return res.json({
            base,
            rates: converted,
            source: "cbc",
            updatedAt: cbcResult.updatedAt,
            cacheStatus: cbcResult.cacheStatus,
            cacheAgeSeconds: cbcResult.cacheAgeSeconds,
          });
        }
      }
    } catch (e) {
      console.warn("CBC rates unavailable, falling back:", e);
    }

    const externalRates = await getExternalExchangeRates(base);
    if (externalRates) {
      res.set({
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        "X-Rate-Source": externalRates.source,
        "X-Rate-Cache": externalRates.cacheStatus,
      });
      return res.json(externalRates);
    }

    console.warn("All exchange-rate providers unavailable; refusing to return stale static rates.");
    res.set({
      "Cache-Control": "no-store",
      "X-Rate-Source": "unavailable",
    });
    return res.status(503).json({ error: "Exchange rates are temporarily unavailable." });
  });

  app.get("/api/transit/lines", async (req, res) => {
    const { country } = req.query;
    if (typeof country !== "string" || !countryOptions.includes(country as Country)) {
      return res.status(400).json({
        error: "Invalid country",
        message: `Country must be one of ${countryOptions.join(", ")}.`,
        lines: [],
      });
    }

    if (country === "malaysia") {
      return res.json({
        lines: [],
        source: "https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily",
        message: "Historical ridership data supplies station names only; no timetable topology is available.",
      });
    }

    try {
      const lines = await getLinesForCountry(country);
      const source =
        country === "united_kingdom"
          ? "https://api.tfl.gov.uk"
          : country === "united_states"
            ? "https://api-v3.mbta.com"
            : undefined;
      return res.json(source ? { lines, source } : { lines });
    } catch (error) {
      return res.status(502).json({
        error: "Provider request failed",
        message: error instanceof Error ? error.message : "Could not fetch lines.",
        lines: [],
      });
    }
  });

  app.get("/api/transit/transfers", (req, res) => {
    const { stationId, stationName, country } = req.query;

    if (typeof stationId === "string" && stationId) {
      const info = transferCatalog[stationId];
      if (info) {
        return res.json(info);
      }
      return res.status(404).json({
        error: "Not found",
        message: `No transfer info found for station ID ${stationId}.`
      });
    }

    if (typeof stationName === "string" && typeof country === "string") {
      const info = getTransferInfo(stationName, country);
      if (info) {
        return res.json(info);
      }
      return res.status(404).json({
        error: "Not found",
        message: `No transfer info found for station "${stationName}" in ${country}.`
      });
    }

    return res.status(400).json({
      error: "Bad request",
      message: "Must provide either 'stationId' or both 'stationName' and 'country'."
    });
  });

  app.post("/api/feedbacks", async (req, res) => {
    try {
      const { category, content, contact, latitude, longitude, county, district, locationMethod } = req.body;
      if (!category || !content) {
        return res.status(400).json({ error: "Category and content are required." });
      }
      if (!process.env.DATABASE_URL) {
        console.warn("DATABASE_URL is not set. Skipping DB insertion for feedback.");
        void sendTelemetry("feedback.submitted", { has_category: true, has_contact: Boolean(contact) });
        return res.json({ success: true });
      }
      await db.insert(feedbacks).values({
        category,
        content,
        contact,
        latitude,
        longitude,
        county,
        district,
        locationMethod,
      });
      void sendTelemetry("feedback.submitted", { has_category: true, has_contact: Boolean(contact) });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save feedback", error);
      res.status(500).json({ error: "Failed to save feedback." });
    }
  });

  // Web Push: schedule-change notifications for saved routes. The public key is
  // safe to expose — VAPID_PRIVATE_KEY never leaves the server. The daily
  // scripts/check-push-notifications.ts job (run after the scrape commits new
  // data) is what actually sends notifications; these endpoints only manage
  // subscriptions.
  app.get("/api/push/vapid-public-key", (_req, res) => {
    const available = Boolean(process.env.DATABASE_URL && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    res.json({ publicKey: available ? process.env.VAPID_PUBLIC_KEY : null });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      if (!process.env.DATABASE_URL || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return res.status(501).json({ error: "Push notifications are not configured on this server." });
      }
      const { subscription, routes, language } = req.body as {
        subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        routes?: Array<{ origin?: string; destination?: string; country?: string }>;
        language?: string;
      };
      if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return res.status(400).json({ error: "A valid push subscription is required." });
      }
      if (!Array.isArray(routes) || routes.length === 0) {
        return res.status(400).json({ error: "At least one route to watch is required." });
      }

      const cleanRoutes: WatchedRoute[] = [];
      for (const route of routes.slice(0, 20)) {
        const origin = readText(route?.origin);
        const destination = readText(route?.destination);
        const country = readText(route?.country);
        if (!origin || !destination || !country) continue;
        if (!countryOptions.includes(country as Country)) continue;

        const today = providerDateValue(country as Country);
        const results = findScrapedResults(country as Country, origin, destination, today);
        cleanRoutes.push({
          origin,
          destination,
          country,
          fingerprint: results ? timetableFingerprint(results) : undefined,
        });
      }
      if (cleanRoutes.length === 0) {
        return res.status(400).json({ error: "None of the provided routes could be resolved against scraped data." });
      }

      await db
        .insert(pushSubscriptions)
        .values({
          endpoint: subscription.endpoint,
          p256dhKey: subscription.keys.p256dh,
          authKey: subscription.keys.auth,
          watchedRoutes: cleanRoutes,
          language: readText(language),
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            p256dhKey: subscription.keys.p256dh,
            authKey: subscription.keys.auth,
            watchedRoutes: cleanRoutes,
            language: readText(language),
            updatedAt: new Date(),
          },
        });

      res.json({ success: true, watching: cleanRoutes.length });
    } catch (error) {
      console.error("Failed to save push subscription", error);
      res.status(500).json({ error: "Failed to save push subscription." });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) {
        return res.json({ success: true });
      }
      const endpoint = readText((req.body as { endpoint?: string } | undefined)?.endpoint);
      if (!endpoint) {
        return res.status(400).json({ error: "endpoint is required." });
      }
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove push subscription", error);
      res.status(500).json({ error: "Failed to remove push subscription." });
    }
  });

  app.post("/api/share-card", (req, res) => {
    const trip = readShareCardPayload(req.body);
    if (!trip) {
      return res.status(400).json({ error: "Origin, destination, service, date, and departure time are required." });
    }

    res.set("Cache-Control", "no-store");
    return res.json({ svg: generateShareCardSvg(trip) });
  });

  app.get("/api/share-card.svg", (req, res) => {
    const trip = readShareCardPayload(req.query);
    if (!trip) return res.status(400).type("text/plain").send("Missing journey details.");
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.type("image/svg+xml").send(generateShareCardSvg(trip));
  });

  app.get("/api/share", (req, res) => {
    const trip = readShareCardPayload(req.query);
    if (!trip) return res.status(400).type("text/plain").send("Missing journey details.");

    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const query = new URLSearchParams({
      origin: trip.origin,
      destination: trip.destination,
      country: trip.country,
      service: trip.service,
      date: trip.date,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
    }).toString();
    const pageUrl = `${baseUrl}/api/share?${query}`;
    const imageUrl = `${baseUrl}/api/share-card.svg?${query}`;
    const title = `${trip.origin} → ${trip.destination} · ${trip.departureTime}`;
    const description = `${trip.service} · ${trip.date} · ${trip.departureTime} → ${trip.arrivalTime}`;
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeSvgText(title)}</title><meta name="robots" content="noindex"><meta property="og:type" content="website"><meta property="og:site_name" content="Rail Nation"><meta property="og:title" content="${escapeSvgText(title)}"><meta property="og:description" content="${escapeSvgText(description)}"><meta property="og:url" content="${escapeSvgText(pageUrl)}"><meta property="og:image" content="${escapeSvgText(imageUrl)}"><meta property="og:image:type" content="image/svg+xml"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeSvgText(title)}"><meta name="twitter:description" content="${escapeSvgText(description)}"><meta name="twitter:image" content="${escapeSvgText(imageUrl)}"></head><body><p>${escapeSvgText(description)}</p></body></html>`);
  });

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ShareCardPayload {
  origin: string;
  destination: string;
  country: string;
  service: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
}

function readShareCardPayload(input: unknown): ShareCardPayload | undefined {
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const required = ["origin", "destination", "service", "date", "departureTime"] as const;
  if (required.some((key) => typeof data[key] !== "string" || !data[key].trim())) return undefined;
  return {
    origin: (data.origin as string).trim(),
    destination: (data.destination as string).trim(),
    country: typeof data.country === "string" ? data.country.trim() : "",
    service: (data.service as string).trim(),
    date: (data.date as string).trim(),
    departureTime: (data.departureTime as string).trim(),
    arrivalTime: typeof data.arrivalTime === "string" && data.arrivalTime.trim() ? data.arrivalTime.trim() : "—",
  };
}

function generateShareCardSvg(trip: ShareCardPayload): string {
  const countryLabel = trip.country.replace(/_/g, " ").toUpperCase() || "RAIL";
  const values = {
    origin: escapeSvgText(trip.origin),
    destination: escapeSvgText(trip.destination),
    country: escapeSvgText(countryLabel),
    service: escapeSvgText(trip.service),
    date: escapeSvgText(trip.date),
    departureTime: escapeSvgText(trip.departureTime),
    arrivalTime: escapeSvgText(trip.arrivalTime),
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${values.origin} to ${values.destination} journey card">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f766e"/><stop offset="1" stop-color="#155e75"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#042f2e" flood-opacity=".35"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#background)"/>
  <circle cx="1060" cy="60" r="210" fill="#99f6e4" fill-opacity=".15"/><circle cx="120" cy="620" r="250" fill="#020617" fill-opacity=".18"/>
  <path d="M50 372 C250 230 420 520 640 344 S990 250 1170 138" fill="none" stroke="#ccfbf1" stroke-opacity=".42" stroke-width="7" stroke-dasharray="12 18"/>
  <text x="76" y="84" fill="#ccfbf1" font-size="25" font-family="system-ui, sans-serif" font-weight="800" letter-spacing="2">RAIL NATION · ${values.country}</text>
  <text x="76" y="172" fill="#fff" font-size="42" font-family="system-ui, sans-serif" font-weight="700">${values.service}</text>
  <text x="76" y="240" fill="#fff" font-size="52" font-family="system-ui, sans-serif" font-weight="800">${values.origin}</text>
  <text x="76" y="306" fill="#ccfbf1" font-size="44" font-family="system-ui, sans-serif" font-weight="700">→ ${values.destination}</text>
  <g transform="translate(76 402)" filter="url(#shadow)">
    <rect width="322" height="126" rx="24" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-opacity=".25"/>
    <text x="26" y="38" fill="#ccfbf1" font-size="19" font-family="system-ui, sans-serif" font-weight="700">DEPARTURE · ${values.date}</text>
    <text x="26" y="94" fill="#fff" font-size="52" font-family="ui-monospace, SFMono-Regular, monospace" font-weight="800">${values.departureTime}</text>
  </g>
  <g transform="translate(430 402)" filter="url(#shadow)">
    <rect width="322" height="126" rx="24" fill="#fff" fill-opacity=".16" stroke="#fff" stroke-opacity=".25"/>
    <text x="26" y="38" fill="#ccfbf1" font-size="19" font-family="system-ui, sans-serif" font-weight="700">ARRIVAL</text>
    <text x="26" y="94" fill="#fff" font-size="52" font-family="ui-monospace, SFMono-Regular, monospace" font-weight="800">${values.arrivalTime}</text>
  </g>
  <text x="76" y="585" fill="#ccfbf1" fill-opacity=".8" font-size="18" font-family="system-ui, sans-serif">Confirm times with the operator before travelling.</text>
</svg>`;
}


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Serve prerendered SEO route pages (public/<country>/<route>/index.html)
    // with directory-index resolution, which Vite's publicDir middleware does
    // not do. Mirrors Vercel's static-file-before-rewrite behaviour in dev.
    // redirect:false keeps /japan (a directory of route pages but no index
    // itself) falling through to the SPA instead of 301ing to /japan/.
    app.use(express.static(path.join(process.cwd(), "public"), { index: "index.html", redirect: false }));
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer();
}

export { app };

// --- End of server.ts ---
