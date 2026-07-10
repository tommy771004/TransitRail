// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Express server handling APIs for worldwide transit routes, station catalogs, and currency rates

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
  switzerlandRailLines,
} from "./src/data/metroLines";
import { getTflLines, getTflStations, searchTflJourney } from "./src/server/tfl";
import { getMbtaLines, getMbtaStations, searchMbtaJourney } from "./src/server/mbta";
import { searchBelgiumJourney } from "./src/server/belgium";
import { searchNorwayJourney } from "./src/server/norway";
import { findScrapedResults, loadScrapedData } from "./src/data/scraped";
import { getCbcRates } from "./src/server/cbc";
import { getExternalExchangeRates } from "./src/server/exchangeRates";
import type { TransitLine } from "./src/types";
import { db } from "./src/db";
import { feedbacks, tnAuditLog } from "./src/db/schema";
import { generateSeoulSubwayTimetable } from "./src/utils/seoulSubwayPathfinder";
import { generateFallbackTimetable } from "./src/utils/fallbackPathfinder";
import { newCountryStationLists } from "./src/data/scraped/stations";
import { getStationsForCountry, getLinesForCountry } from "./src/server/catalog";
import { searchSwissJourney } from "./src/server/swiss";
import { enrichTransitResultsWithLineStations } from "./src/utils/metroEnricher";
import { transferCatalog, getTransferInfo } from "./src/data/transfers";
import { fetchOpenRouterWithFallback } from "./src/openRouterHelper";

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

    if (countryValue === "malaysia") {
      statusCode = 422;
      payload = {
        error: "Timetable unavailable",
        message: "Malaysia currently provides an official station catalog derived from historical data.gov.my ridership files. Those files do not contain train schedules or real-time arrivals, so no timetable is shown.",
        results: [],
        source: "data.gov.my historical ridership station catalog",
      };
    } else if (countryValue === "united_kingdom") {
      const providerResponse = await searchTflJourney(origin, destination, date, timeValue);
      statusCode = providerResponse.status;
      payload = providerResponse.body;
    } else if (countryValue === "united_states") {
      const providerResponse = await searchMbtaJourney(origin, destination, date);
      statusCode = providerResponse.status;
      payload = providerResponse.body;
    } else if (countryValue === "belgium") {
      const providerResponse = await searchBelgiumJourney(origin, destination, date, timeValue);
      statusCode = providerResponse.status;
      payload = providerResponse.body;
    } else if (countryValue === "norway") {
      const providerResponse = await searchNorwayJourney(origin, destination, date, timeValue);
      statusCode = providerResponse.status;
      payload = providerResponse.body;
    } else if (countryValue === "switzerland") {
      const providerResponse = await searchSwissJourney(origin, destination, date, timeValue);
      if (providerResponse.status >= 200 && providerResponse.status < 300 && providerResponse.body.results.length > 0) {
        statusCode = providerResponse.status;
        payload = providerResponse.body;
      }
    }

    let scraped = findScrapedResults(country as any, origin, destination, date);
    if (!payload && scraped && scraped.length > 0) {
      if (timeValue && timeValue.match(/^\d{2}:\d{2}$/)) {
        scraped = scraped.filter(r => r.departureTime >= time);
      }
      payload = { results: scraped, source: "scraped" };
    } else if (!payload && country === "korea") {
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

    if (payload && payload.results && payload.results.length > 0 && countryValue) {
      try {
        const countryLines = await getLinesForCountry(countryValue);
        if (countryLines && countryLines.length > 0) {
          payload.results = enrichTransitResultsWithLineStations(payload.results, countryLines, countryValue);
        }
      } catch (e) {
        console.error(e);
      }
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

  app.get("/api/exchange-rates", async (req, res) => {
    const requestedBase = typeof req.query.base === "string" ? req.query.base : "TWD";
    const base = /^[A-Za-z]{3}$/.test(requestedBase) ? requestedBase.toUpperCase() : "TWD";
    const fallbackRates: Record<string, Record<string, number>> = {
      TWD: { TWD:1, USD:0.031, JPY:4.95, KRW:42.6, HKD:0.24, GBP:0.024, EUR:0.028, CHF:0.028, SGD:0.041, MYR:0.14, THB:1.11, CNY:0.22, AUD:0.047, CAD:0.042, NZD:0.051, PHP:1.74, IDR:485, VND:770, SEK:0.32, NOK:0.33, DKK:0.21, PLN:0.12, TRY:0.96, ZAR:0.56, BRL:0.15, MXN:0.53, RUB:2.83, INR:2.57, SAR:0.12, AED:0.11, ILS:0.11, CZK:0.71, HUF:11.2, RON:0.14 },
      USD: { USD:1, TWD:32.5, JPY:160.8, KRW:1385, HKD:7.8, GBP:0.78, EUR:0.92, CHF:0.90, SGD:1.35, MYR:4.71, THB:36.2, CNY:7.24, AUD:1.54, CAD:1.37, NZD:1.64, PHP:56.5, IDR:15750, VND:25000, SEK:10.4, NOK:10.7, DKK:6.85, PLN:3.95, TRY:31.2, ZAR:18.1, BRL:4.95, MXN:17.2, RUB:92.0, INR:83.5, SAR:3.75, AED:3.67, ILS:3.65, CZK:23.1, HUF:365, RON:4.58 },
      EUR: { EUR:1, USD:1.09, TWD:35.3, JPY:174.8, KRW:1505, HKD:8.48, GBP:0.85, CHF:0.98, SGD:1.47, MYR:5.12, THB:39.4, CNY:7.88, AUD:1.67, CAD:1.49, NZD:1.78, PHP:61.4, IDR:17120, VND:27170, SEK:11.3, NOK:11.6, DKK:7.44, PLN:4.29, TRY:33.9, ZAR:19.7, BRL:5.38, MXN:18.7, RUB:100, INR:90.7, SAR:4.08, AED:3.99, ILS:3.97, CZK:25.1, HUF:397, RON:4.98 },
      GBP: { GBP:1, USD:1.28, TWD:41.6, JPY:206.1, KRW:1775, HKD:10.0, EUR:1.18, CHF:1.15, SGD:1.73, MYR:6.04, THB:46.5, CNY:9.26, AUD:1.97, CAD:1.76, NZD:2.10, PHP:72.4, IDR:20160, VND:32000, SEK:13.3, NOK:13.7, DKK:8.77, PLN:5.06, TRY:40.0, ZAR:23.2, BRL:6.34, MXN:22.0, RUB:118, INR:107, SAR:4.81, AED:4.70, ILS:4.68, CZK:29.6, HUF:468, RON:5.87 },
    };

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

    console.warn("All exchange-rate providers unavailable; using static fallback rates.");
    res.set({
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Rate-Source": "static-fallback",
    });
    {
      const fallbackBase = fallbackRates[base] ? base : "TWD";
      return res.json({ base: fallbackBase, rates: fallbackRates[fallbackBase], isFallback: true });
    }
  });

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

    if (country === "malaysia") {
      return res.json({
        lines: [],
        source: "https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily",
        message: "Historical ridership data supplies station names only; no timetable topology is available.",
      });
    }

    const staticLines: Record<string, TransitLine[]> = {
      singapore: singaporeMrtLines,
      thailand: thailandTransitLines,
      china: chinaRailLines,
      germany: germanyRailLines,
      france: franceRailLines,
        switzerland: switzerlandRailLines,
    };
    if (typeof country === "string" && staticLines[country]) {
      return res.json({ lines: staticLines[country] });
    }

    return res.status(400).json({
      error: "Invalid country",
      message: "Country must be one of japan, korea, taiwan, singapore, malaysia, thailand, hong_kong, united_kingdom, united_states, germany, france, switzerland, china.",
      lines: [],
    });
  });

  app.get("/api/transit/transfers/:stationId", (req, res) => {
    const { stationId } = req.params;
    const info = transferCatalog[stationId];
    if (info) {
      return res.json(info);
    }
    return res.status(404).json({
      error: "Not found",
      message: `No transfer info found for station ID ${stationId}.`
    });
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

  app.post("/api/generate-poster", async (req, res) => {
    try {
      const { origin, destination, country } = req.body;
      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and Destination are required." });
      }
      const openRouterKey = process.env.OPENROUTER_API_KEY || "";
      const systemPrompt = "You are a professional graphic designer and SVG illustrator. Your task is to generate a highly stylized, beautiful, responsive, modern flat-design vector SVG travel poster or header card for a trip between the specified locations. Guidelines: - The output MUST be a valid, standalone, responsive SVG starting with <svg and ending with </svg>. - Use viewBox=\"0 0 800 320\" to make it wide and suitable as a header card. - Make it look incredibly artistic and professional: use rich linear/radial CSS gradients, beautiful layered shapes to match the vibe of the locations. - Use landmarks or general aesthetic elements corresponding to the destinations if known. - Include stylized text labels in a beautiful, elegant sans-serif/serif display font showing the departure and destination name, e.g., 'TOKYO → KYOTO'. Place it elegantly so it's readable and blends with the artwork. - Do NOT import external fonts or resources; use standard safe system fonts. - Make sure the SVG is self-contained. Use <defs> for gradients, masks, and shadow effects. - Ensure high contrast and a highly polished feel. - Wrap your SVG inside a markdown XML codeblock, or just return it directly. Do NOT include any introductory or concluding text. Return ONLY the SVG code.";
      const prompt = `Create a gorgeous, stylized travel poster SVG for a journey from "${origin}" to "${destination}" in "${country || "any"}" country. Make it a stunning flat vector design with gradients, nice landmarks or nature, and elegant typography.`;
      let svgCode = "";
      if (openRouterKey) {
        try {
          const response = await fetchOpenRouterWithFallback(
            openRouterKey,
            prompt,
            undefined,
            undefined,
            undefined,
            "openrouter",
            undefined,
            undefined,
            "auto",
            systemPrompt
          );
          let text = response.text || "";
          const codeBlockMatch = text.match(/```(?:xml|html)?\s*([\s\S]*?)```/i);
          if (codeBlockMatch) {
            svgCode = codeBlockMatch[1].trim();
          } else {
            const svgStart = text.indexOf("<svg");
            const svgEnd = text.lastIndexOf("</svg>");
            if (svgStart !== -1 && svgEnd !== -1 && svgEnd > svgStart) {
              svgCode = text.substring(svgStart, svgEnd + 6).trim();
            } else {
              svgCode = text.trim();
            }
          }
        } catch (apiError) {
          console.error("OpenRouter API call failed, generating fallback SVG:", apiError);
        }
      }
      if (!svgCode || !svgCode.startsWith("<svg")) {
        svgCode = generateFallbackSvg(origin, destination, country);
      }
      res.json({ svg: svgCode });
    } catch (error) {
      console.error("Poster generation failed", error);
      res.status(500).json({ error: "Failed to generate travel poster." });
    }
  });

function generateFallbackSvg(origin: string, destination: string, country?: string): string {
  const hash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  };
  const cCode = (country || "").toLowerCase();
  const oHash = hash(origin);
  const dHash = hash(destination);
  const combinedHash = hash(origin + destination);
  let gradStart = "#1e1b4b";
  let gradEnd = "#311042";
  let accentColor = "#f43f5e";
  let patternType = "mountains";
  if (cCode === "japan" || cCode === "jp") {
    gradStart = "#111827";
    gradEnd = "#4c0519";
    accentColor = "#e11d48";
    patternType = "mountains-sun";
  } else if (cCode === "switzerland" || cCode === "ch") {
    gradStart = "#0c4a6e";
    gradEnd = "#0284c7";
    accentColor = "#ffffff";
    patternType = "swiss-alps";
  } else if (cCode === "korea" || cCode === "kr") {
    gradStart = "#0f172a";
    gradEnd = "#1e3a8a";
    accentColor = "#f43f5e";
    patternType = "modern-city";
  } else {
    const presets = [
      { start: "#1e1b4b", end: "#311042", accent: "#f43f5e", pattern: "mountains" },
      { start: "#065f46", end: "#022c22", accent: "#10b981", pattern: "forest" },
      { start: "#7c2d12", end: "#431407", accent: "#f97316", pattern: "sunset-desert" },
      { start: "#1e3a8a", end: "#172554", accent: "#3b82f6", pattern: "city-night" },
      { start: "#581c87", end: "#3b0764", accent: "#a855f7", pattern: "aurora" }
    ];
    const preset = presets[combinedHash % presets.length];
    gradStart = preset.start;
    gradEnd = preset.end;
    accentColor = preset.accent;
    patternType = preset.pattern;
  }
  let artwork = "";
  if (patternType === "mountains-sun" || patternType === "mountains") {
    artwork = `
      <circle cx="400" cy="140" r="70" fill="${accentColor}" opacity="0.8" />
      <circle cx="400" cy="140" r="90" fill="none" stroke="${accentColor}" stroke-width="2" stroke-dasharray="10 15" opacity="0.4" />
      <polygon points="100,320 300,100 500,320" fill="#1f2937" opacity="0.8" />
      <polygon points="300,320 500,80 700,320" fill="#111827" opacity="0.9" />
      <polygon points="-50,320 150,150 350,320" fill="#374151" opacity="0.6" />
      <polygon points="380,320 420,320 405,180 395,180" fill="#4b5563" opacity="0.5" />
      <line x1="390" y1="220" x2="410" y2="220" stroke="#9ca3af" stroke-width="3" opacity="0.7" />
      <line x1="385" y1="240" x2="415" y2="240" stroke="#9ca3af" stroke-width="4" opacity="0.7" />
      <line x1="380" y1="270" x2="420" y2="270" stroke="#9ca3af" stroke-width="5" opacity="0.7" />
      <line x1="370" y1="300" x2="430" y2="300" stroke="#9ca3af" stroke-width="6" opacity="0.7" />
    `;
  } else if (patternType === "swiss-alps") {
    artwork = `
      <circle cx="150" cy="100" r="120" fill="#fef08a" opacity="0.15" />
      <polygon points="-50,320 150,60 350,320" fill="#38bdf8" opacity="0.6" />
      <polygon points="100,320 350,30 600,320" fill="#0284c7" opacity="0.8" />
      <polygon points="400,320 600,100 800,320" fill="#0369a1" opacity="0.9" />
      <polygon points="120,100 150,60 170,100 155,90 145,95" fill="#f8fafc" opacity="0.95" />
      <polygon points="310,80 350,30 380,80 365,65 350,75 335,65" fill="#f8fafc" opacity="0.95" />
      <polygon points="560,140 600,100 630,140 615,125 600,135 585,125" fill="#f8fafc" opacity="0.95" />
    `;
  } else if (patternType === "forest") {
    artwork = `
      <circle cx="650" cy="110" r="50" fill="#fef08a" opacity="0.85" />
      <circle cx="650" cy="110" r="65" fill="none" stroke="#fef08a" stroke-width="1" stroke-dasharray="5 10" opacity="0.5" />
      <g fill="#022c22">
        <polygon points="150,320 150,220 130,240 170,240 140,200 160,200 150,170" opacity="0.4" />
        <polygon points="350,320 350,200 330,220 370,220 340,180 360,180 350,150" opacity="0.4" />
        <polygon points="550,320 550,210 530,230 570,230 540,190 560,190 550,160" opacity="0.4" />
        <polygon points="250,320 250,180 220,210 280,210 235,160 265,160 250,120" fill="#064e3b" opacity="0.7" />
        <polygon points="450,320 450,170 420,200 480,200 435,150 465,150 450,110" fill="#064e3b" opacity="0.7" />
        <polygon points="100,320 100,150 60,190 140,190 75,130 125,130 100,80" fill="#022c22" />
        <polygon points="700,320 700,150 660,190 740,190 675,130 725,130 700,80" fill="#022c22" />
      </g>
    `;
  } else if (patternType === "sunset-desert") {
    artwork = `
      <circle cx="400" cy="320" r="180" fill="#f97316" opacity="0.9" />
      <circle cx="400" cy="320" r="150" fill="#facc15" opacity="0.95" />
      <path d="M-100,320 Q150,200 400,320 Z" fill="#7c2d12" opacity="0.8" />
      <path d="M300,320 Q550,180 900,320 Z" fill="#9a3412" opacity="0.9" />
      <path d="M100,320 Q400,240 700,320 Z" fill="#ea580c" opacity="0.6" />
    `;
  } else if (patternType === "city-night" || patternType === "modern-city") {
    artwork = `
      <circle cx="120" cy="80" r="40" fill="#e2e8f0" opacity="0.9" />
      <g fill="#1e293b">
        <rect x="50" y="160" width="60" height="160" opacity="0.5" />
        <rect x="180" y="120" width="80" height="200" opacity="0.6" />
        <rect x="340" y="180" width="50" height="140" opacity="0.5" />
        <rect x="440" y="140" width="70" height="180" opacity="0.7" />
        <rect x="600" y="100" width="90" height="220" opacity="0.8" />
      </g>
      <g fill="#0f172a">
        <rect x="100" y="200" width="50" height="120" />
        <rect x="230" y="150" width="70" height="170" />
        <polygon points="265,150 265,90 270,150" stroke="#0f172a" stroke-width="4" />
        <rect x="380" y="170" width="80" height="150" />
        <rect x="520" y="120" width="60" height="200" />
        <polygon points="550,120 550,60 555,120" stroke="#0f172a" stroke-width="3" />
      </g>
      <g fill="#fef08a" opacity="0.7">
        <rect x="110" y="220" width="8" height="12" />
        <rect x="130" y="220" width="8" height="12" />
        <rect x="110" y="250" width="8" height="12" />
        <rect x="245" y="170" width="10" height="15" />
        <rect x="275" y="170" width="10" height="15" />
        <rect x="245" y="200" width="10" height="15" />
        <rect x="400" y="190" width="12" height="12" />
        <rect x="420" y="190" width="12" height="12" />
        <rect x="400" y="220" width="12" height="12" />
        <rect x="535" y="140" width="8" height="14" />
        <rect x="535" y="170" width="8" height="14" />
        <rect x="535" y="200" width="8" height="14" />
      </g>
    `;
  } else {
    artwork = `
      <circle cx="400" cy="160" r="120" fill="none" stroke="${accentColor}" stroke-width="4" opacity="0.3" />
      <circle cx="400" cy="160" r="100" fill="${accentColor}" opacity="0.1" />
      <line x1="0" y1="160" x2="800" y2="160" stroke="#9ca3af" stroke-width="1" stroke-dasharray="5 5" opacity="0.3" />
      <line x1="400" y1="0" x2="400" y2="320" stroke="#9ca3af" stroke-width="1" stroke-dasharray="5 5" opacity="0.3" />
    `;
  }
  const label = `${origin.toUpperCase()}  →  ${destination.toUpperCase()}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="100%" height="100%" style="border-radius: 1.5rem; overflow: hidden; background: linear-gradient(135deg, ${gradStart}, ${gradEnd});">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${gradStart}" />
        <stop offset="100%" stop-color="${gradEnd}" />
      </linearGradient>
    </defs>
    <rect width="800" height="320" fill="url(#skyGrad)" />
    ${artwork}
    <rect x="0" y="240" width="800" height="80" fill="#0f172a" opacity="0.75" />
    <text x="400" y="285" fill="#ffffff" font-family="'Inter', system-ui, sans-serif" font-size="20" font-weight="900" letter-spacing="4" text-anchor="middle" opacity="0.95">${label}</text>
    <text x="400" y="302" fill="#94a3b8" font-family="'Inter', system-ui, sans-serif" font-size="10" font-weight="700" letter-spacing="2" text-anchor="middle" opacity="0.8">TRANSITRAIL EXPLORER POSTER</text>
  </svg>`;
  return svg;
}

async function startServer() {
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
