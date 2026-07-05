import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { hongKongMtrLineCatalog, hongKongStations } from "./src/data/hongKongMtr";
import { mtrInterchanges } from "./src/data/hongKongMtr";
import { japanRailLines, japanStations, koreaStations } from "./src/data/stations";
import { seoulSubwayLines, seoulSubwayStationNames } from "./src/data/seoulSubway";
import { getTflLines, getTflStations } from "./src/server/tfl";
import { getMbtaLines, getMbtaStations } from "./src/server/mbta";
import { findScrapedResults, loadScrapedData } from "./src/data/scraped";
import type { TransitLine } from "./src/types";

dotenv.config();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  loadScrapedData();
  app.use(express.json());

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

    let scraped = findScrapedResults(country as any, origin, destination);
    if (scraped && scraped.length > 0) {
      if (typeof time === "string" && time.match(/^\d{2}:\d{2}$/)) {
        scraped = scraped.filter(r => r.departureTime >= time);
      }
      return res.json({ results: scraped, source: "scraped" });
    }
    return res.status(404).json({
      error: "No data available",
      message: `No scraped timetable data found for ${origin} → ${destination}. The daily scraper may not have covered this route yet.`,
      results: [],
      source: "scraped",
    });
  });

  // Stations API
  app.get("/api/transit/stations", async (req, res) => {
    const { country, q } = req.query;
    let stations: string[] = [];
    let source: string | undefined;

    try {
      const { newCountryStationLists } = await import("./src/data/scraped/stations");

      if (country === "japan") {
        stations = japanStations;
      } else if (country === "korea") {
        stations = Array.from(new Set([...koreaStations, ...seoulSubwayStationNames]))
          .sort((a, b) => a.localeCompare(b));
      } else if (country === "hong_kong") {
        stations = hongKongStations;
      } else if (country === "united_kingdom") {
        stations = await getTflStations();
        source = "https://api.tfl.gov.uk";
      } else if (country === "united_states") {
        stations = await getMbtaStations();
        source = "https://api-v3.mbta.com";
      } else if (newCountryStationLists[country as string]) {
        stations = newCountryStationLists[country as string];
      } else {
        return res.status(400).json({
          error: "Invalid country",
          message: "Country must be one of japan, korea, taiwan, singapore, thailand, hong_kong, united_kingdom, united_states, germany, france, china.",
          stations: [],
        });
      }

      if (typeof q === "string" && q.trim().length > 0) {
        const queryVal = q.trim().toLowerCase();
        stations = stations.filter((station) => station.toLowerCase().includes(queryVal));
      }

      return res.json({ stations, source });
    } catch (error) {
      return res.status(502).json({
        error: "Provider request failed",
        message: error instanceof Error ? error.message : "Could not fetch stations.",
        stations: [],
      });
    }
  });

  // Currency Exchange Rates API
  app.get("/api/exchange-rates", async (req, res) => {
    const base = (req.query.base as string) || "USD";
    const fallbackRates: Record<string, Record<string, number>> = {
      USD: { USD: 1, JPY: 160.8, KRW: 1385.0, HKD: 7.8, GBP: 0.78, EUR: 0.92, CHF: 0.90, SGD: 1.35, MYR: 4.71, TWD: 32.5, THB: 36.2, CNY: 7.24 },
      EUR: { USD: 1.09, JPY: 174.8, KRW: 1505.0, HKD: 8.48, GBP: 0.85, EUR: 1, CHF: 0.98, SGD: 1.47, MYR: 5.12, TWD: 35.3, THB: 39.4, CNY: 7.88 },
      GBP: { USD: 1.28, JPY: 206.1, KRW: 1775.0, HKD: 10.0, GBP: 1, EUR: 1.18, CHF: 1.15, SGD: 1.73, MYR: 6.04, TWD: 41.6, THB: 46.5, CNY: 9.26 },
      JPY: { USD: 0.0062, JPY: 1, KRW: 8.61, HKD: 0.048, GBP: 0.0048, EUR: 0.0057, CHF: 0.0056, SGD: 0.0084, MYR: 0.029, TWD: 0.20, THB: 0.22, CNY: 0.045 },
      KRW: { USD: 0.00072, JPY: 0.12, KRW: 1, HKD: 0.0056, GBP: 0.00056, EUR: 0.00066, CHF: 0.00065, SGD: 0.00097, MYR: 0.0034, TWD: 0.023, THB: 0.026, CNY: 0.0052 },
      HKD: { USD: 0.13, JPY: 20.6, KRW: 177.5, HKD: 1, GBP: 0.10, EUR: 0.12, CHF: 0.12, SGD: 0.17, MYR: 0.60, TWD: 4.17, THB: 4.65, CNY: 0.93 },
      SGD: { USD: 0.74, JPY: 119.0, KRW: 1025.0, HKD: 5.78, GBP: 0.58, EUR: 0.68, CHF: 0.67, SGD: 1, MYR: 3.49, TWD: 24.1, THB: 26.8, CNY: 5.36 },
      TWD: { USD: 0.031, JPY: 4.95, KRW: 42.6, HKD: 0.24, GBP: 0.024, EUR: 0.028, CHF: 0.028, SGD: 0.041, MYR: 0.14, TWD: 1, THB: 1.11, CNY: 0.22 },
      THB: { USD: 0.028, JPY: 4.45, KRW: 38.3, HKD: 0.22, GBP: 0.022, EUR: 0.025, CHF: 0.025, SGD: 0.037, MYR: 0.13, TWD: 0.90, THB: 1, CNY: 0.20 },
      CNY: { USD: 0.14, JPY: 22.2, KRW: 191.5, HKD: 1.08, GBP: 0.11, EUR: 0.13, CHF: 0.13, SGD: 0.19, MYR: 0.65, TWD: 4.49, THB: 5.0, CNY: 1 }
    };

    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.rates) {
        return res.json({ base, rates: data.rates });
      }
      throw new Error("Invalid exchange rates data format");
    } catch (error) {
      console.warn("Using fallback exchange rates:", error);
      const rates = fallbackRates[base] || fallbackRates["USD"];
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

    return res.status(400).json({
      error: "Invalid country",
      message: "Country must be one of japan, korea, taiwan, singapore, thailand, hong_kong, united_kingdom, united_states, germany, france, china.",
      lines: [],
    });
  });

  // AI Planning Endpoint with High Thinking Level
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express 4 uses *
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
