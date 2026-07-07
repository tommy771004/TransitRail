import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { hongKongMtrLineCatalog, hongKongStations } from "./src/data/hongKongMtr";
import { mtrInterchanges } from "./src/data/hongKongMtr";
import { japanRailLines, japanStations, koreaStations } from "./src/data/stations";
import { seoulSubwayLines, seoulSubwayStationNames } from "./src/data/seoulSubway";
import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
} from "./src/data/metroLines";
import { getTflLines, getTflStations } from "./src/server/tfl";
import { getMbtaLines, getMbtaStations } from "./src/server/mbta";
import { findScrapedResults, loadScrapedData } from "./src/data/scraped";
import { getCbcRates } from "./src/server/cbc";
import type { TransitLine } from "./src/types";
import { db } from "./src/db";
import { feedbacks, tnAuditLog } from "./src/db/schema";
import { generateSeoulSubwayTimetable } from "./src/utils/seoulSubwayPathfinder";
import { generateFallbackTimetable } from "./src/utils/fallbackPathfinder";
import { newCountryStationLists } from "./src/data/scraped/stations";
import { getStationsForCountry, getLinesForCountry } from "./src/server/catalog";

dotenv.config();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const app = express();

loadScrapedData();
app.use(express.json());

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
}

  // Search API. It never fabricates schedules; providers must be wired before
  // result cards can be rendered.
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
    let statusCode = 200;
    let payload: {
      error?: string;
      message?: string;
      results: any[];
      source?: string;
    };

    let scraped = findScrapedResults(country as any, origin, destination, date);
    if (scraped && scraped.length > 0) {
      if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
        scraped = scraped.filter(r => r.departureTime >= time);
      }
      payload = { results: scraped, source: "scraped" };
    } else if (country === "korea") {
      const subwayResults = generateSeoulSubwayTimetable(origin, destination, date);
      if (subwayResults && subwayResults.length > 0) {
        let filtered = subwayResults;
        if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
          filtered = subwayResults.filter(r => r.departureTime >= time);
        }
        payload = { results: filtered, source: "Seoul Metro Pathfinder" };
      }
    }

    if (!payload) {
      try {
        const countryLines = await getLinesForCountry(country as string);
        if (countryLines && countryLines.length > 0) {
          const fallbackResults = generateFallbackTimetable(countryLines, origin, destination, date, country as string);
          if (fallbackResults && fallbackResults.length > 0) {
            let filtered = fallbackResults;
            if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
              filtered = fallbackResults.filter(r => r.departureTime >= time);
            }
            payload = { results: filtered, source: "Dynamic Pathfinder Fallback" };
          }
        }
      } catch (e) {
        console.error("[search] Fallback pathfinder failed:", e);
      }
    }

    if (!payload) {
      statusCode = 404;
      payload = {
        error: "No data available",
        message: `No scraped timetable data found for ${origin} → ${destination}. The daily scraper may not have covered this route yet.`,
        results: [],
        source: "scraped",
      };
    }

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

    return res.status(204).end();
  });

  // Stations API
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
          message: "Country must be one of japan, korea, taiwan, singapore, thailand, hong_kong, united_kingdom, united_states, germany, france, china.",
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
        } else if (!process.env.GEMINI_API_KEY) {
          statusCode = 501;
          payload = { error: "Gemini API key not configured." };
        } else {
          const prompt = `Given the user's location (latitude: ${latitudeValue}, longitude: ${longitudeValue}) in ${countryValue}, which of the following train stations is physically closest to them?

List of stations:
${stations.join(", ")}

Respond ONLY with the exact name of the closest station from the list above. Do not include any other text or explanation.`;

          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: prompt,
            config: {
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.HIGH,
              }
            }
          });
          
          let nearest = response.text?.trim() || "";
          nearest = nearest.replace(/^["']|["']$/g, '');
          payload = { station: nearest };
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
      
    return res.status(statusCode).json(payload);
  });

  // Currency Exchange Rates API
  // Tries Taiwan Central Bank (CBC) as primary source, falls back to open.er-api.com,
  // then hardcoded rates.
  app.get("/api/exchange-rates", async (req, res) => {
    const base = (req.query.base as string) || "TWD";
    const fallbackRates: Record<string, Record<string, number>> = {
      TWD: { TWD:1, USD:0.031, JPY:4.95, KRW:42.6, HKD:0.24, GBP:0.024, EUR:0.028, CHF:0.028, SGD:0.041, MYR:0.14, THB:1.11, CNY:0.22, AUD:0.047, CAD:0.042, NZD:0.051, PHP:1.74, IDR:485, VND:770, SEK:0.32, NOK:0.33, DKK:0.21, PLN:0.12, TRY:0.96, ZAR:0.56, BRL:0.15, MXN:0.53, RUB:2.83, INR:2.57, SAR:0.12, AED:0.11, ILS:0.11, CZK:0.71, HUF:11.2, RON:0.14 },
      USD: { USD:1, TWD:32.5, JPY:160.8, KRW:1385, HKD:7.8, GBP:0.78, EUR:0.92, CHF:0.90, SGD:1.35, MYR:4.71, THB:36.2, CNY:7.24, AUD:1.54, CAD:1.37, NZD:1.64, PHP:56.5, IDR:15750, VND:25000, SEK:10.4, NOK:10.7, DKK:6.85, PLN:3.95, TRY:31.2, ZAR:18.1, BRL:4.95, MXN:17.2, RUB:92.0, INR:83.5, SAR:3.75, AED:3.67, ILS:3.65, CZK:23.1, HUF:365, RON:4.58 },
      EUR: { EUR:1, USD:1.09, TWD:35.3, JPY:174.8, KRW:1505, HKD:8.48, GBP:0.85, CHF:0.98, SGD:1.47, MYR:5.12, THB:39.4, CNY:7.88, AUD:1.67, CAD:1.49, NZD:1.78, PHP:61.4, IDR:17120, VND:27170, SEK:11.3, NOK:11.6, DKK:7.44, PLN:4.29, TRY:33.9, ZAR:19.7, BRL:5.38, MXN:18.7, RUB:100, INR:90.7, SAR:4.08, AED:3.99, ILS:3.97, CZK:25.1, HUF:397, RON:4.98 },
      GBP: { GBP:1, USD:1.28, TWD:41.6, JPY:206.1, KRW:1775, HKD:10.0, EUR:1.18, CHF:1.15, SGD:1.73, MYR:6.04, THB:46.5, CNY:9.26, AUD:1.97, CAD:1.76, NZD:2.10, PHP:72.4, IDR:20160, VND:32000, SEK:13.3, NOK:13.7, DKK:8.77, PLN:5.06, TRY:40.0, ZAR:23.2, BRL:6.34, MXN:22.0, RUB:118, INR:107, SAR:4.81, AED:4.70, ILS:4.68, CZK:29.6, HUF:468, RON:5.87 },
    };

    // Try CBC first (TWD-based rates), then cross-convert if needed
    try {
      const cbcResult = await getCbcRates();
      if (cbcResult && cbcResult.rates) {
        const twdRates = cbcResult.rates;
        if (base === "TWD") {
          return res.json({ base: "TWD", rates: twdRates, source: "cbc" });
        }
        const baseToTwd = twdRates[base];
        if (baseToTwd && baseToTwd > 0) {
          const converted: Record<string, number> = {};
          for (const [currency, rate] of Object.entries(twdRates)) {
            converted[currency] = rate / baseToTwd;
          }
          converted[base] = 1;
          return res.json({ base, rates: converted, source: "cbc" });
        }
      }
    } catch (e) {
      console.warn("CBC rates unavailable, falling back:", e);
    }

    // Fallback: open.er-api.com
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.rates) {
        return res.json({ base, rates: data.rates, source: "er-api" });
      }
      throw new Error("Invalid exchange rates data format");
    } catch (error) {
      console.warn("Using fallback exchange rates:", error);
      const rates = fallbackRates[base] || fallbackRates["TWD"];
      return res.json({ base, rates, isFallback: true });
    }
  });

  // Line catalog API: per-line station lists with interchange info.
  // Japan/Korea/Hong Kong come from static directories; London and Boston are
  // fetched live from the provider and cached server-side.
  app.get("/api/transit/lines", async (req, res) => {
    const { country } = req.query;

    if (country === "japan") {
      return res.json({ lines: japanRailLines });
    }

    if (country === "korea") {
      return res.json({ lines: seoulSubwayLines });
    }

    if (country === "hong_kong") {
      const lines: TransitLine[] = hongKongMtrLineCatalog.map((line) => ({
        id: line.code,
        name: line.name,
        color: line.color,
        stations: line.stations.map((station) => {
          const others = (mtrInterchanges.get(station.name) || []).filter((code) => code !== line.code);
          const names = others
            .map((code) => hongKongMtrLineCatalog.find((entry) => entry.code === code)?.name)
            .filter((name): name is string => Boolean(name));
          return {
            name: station.name,
            interchanges: names.length > 0 ? names : undefined,
          };
        }),
      }));
      return res.json({ lines });
    }

    if (country === "united_kingdom") {
      try {
        const lines = await getTflLines();
        return res.json({ lines, source: "https://api.tfl.gov.uk" });
      } catch (error) {
        return res.status(502).json({
          error: "Provider request failed",
          message: error instanceof Error ? error.message : "Could not reach TfL.",
          lines: [],
        });
      }
    }

    if (country === "united_states") {
      try {
        const lines = await getMbtaLines();
        return res.json({ lines, source: "https://api-v3.mbta.com" });
      } catch (error) {
        return res.status(502).json({
          error: "Provider request failed",
          message: error instanceof Error ? error.message : "Could not reach MBTA.",
          lines: [],
        });
      }
    }

    const staticLines: Record<string, TransitLine[]> = {
      singapore: singaporeMrtLines,
      thailand: thailandTransitLines,
      china: chinaRailLines,
      germany: germanyRailLines,
      france: franceRailLines,
    };
    if (typeof country === "string" && staticLines[country]) {
      return res.json({ lines: staticLines[country] });
    }

    return res.status(400).json({
      error: "Invalid country",
      message: "Country must be one of japan, korea, taiwan, singapore, thailand, hong_kong, united_kingdom, united_states, germany, france, china.",
      lines: [],
    });
  });

  // AI Planning Endpoint with High Thinking Level
  app.post("/api/feedbacks", async (req, res) => {
    try {
      const { category, content, contact, latitude, longitude, county, district, locationMethod } = req.body;
      if (!category || !content) {
        return res.status(400).json({ error: "Category and content are required." });
      }
      if (!process.env.DATABASE_URL) {
        console.warn("DATABASE_URL is not set. Skipping DB insertion for feedback.");
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
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save feedback", error);
      res.status(500).json({ error: "Failed to save feedback." });
    }
  });

  app.post("/api/ai-plan", async (req, res) => {
    try {
      if (!ai) {
        return res.status(501).json({ error: "Gemini API key not configured." });
      }
      const { prompt } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          }
        }
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate AI plan." });
    }
  });

async function startServer() {
  // Vite middleware for development. Imported lazily so production builds and
  // the Vercel serverless function never load the vite toolchain — a top-level
  // vite import gets traced into the lambda and can crash or bloat cold starts.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express 4 uses *
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
