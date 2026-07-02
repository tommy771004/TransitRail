import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { hongKongStations } from "./src/data/hongKongMtr";
import { japanStations, koreaStations } from "./src/data/stations";
import { searchHongKongMtr } from "./src/server/hongKongMtr";
import { getTflStations, searchTflJourney } from "./src/server/tfl";
import { getMbtaStations, searchMbtaJourney } from "./src/server/mbta";

dotenv.config();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Search API. It never fabricates schedules; providers must be wired before
  // result cards can be rendered.
  app.get("/api/transit/search", async (req, res) => {
    const { origin, destination, country, date } = req.query;

    if (typeof origin !== "string" || typeof destination !== "string" || typeof date !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Origin, destination, and date are required.",
        results: [],
      });
    }

    if (country === "japan") {
      const apiKey = process.env.ODPT_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          error: "API Key Missing",
          message: "Please configure the ODPT_API_KEY environment variable to fetch real Japan transit data.",
          results: [],
          source: "https://developer.odpt.org/",
        });
      }
      return res.status(502).json({
        error: "Provider Adapter Missing",
        message: "ODPT credentials are configured, but a route-search adapter has not been connected yet. No schedule data was fabricated.",
        results: [],
        source: "https://developer.odpt.org/",
      });
    }

    if (country === "korea") {
      const apiKey = process.env.ODSAY_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          error: "API Key Missing",
          message: "Please configure the ODSAY_API_KEY environment variable to fetch real Korea transit data.",
          results: [],
          source: "https://lab.odsay.com/",
        });
      }
      return res.status(502).json({
        error: "Provider Adapter Missing",
        message: "ODsay credentials are configured, but a route-search adapter has not been connected yet. No schedule data was fabricated.",
        results: [],
        source: "https://lab.odsay.com/",
      });
    }

    if (country === "hong_kong") {
      const result = await searchHongKongMtr(origin, destination, date);
      return res.status(result.status).json(result.body);
    }

    if (country === "united_kingdom") {
      const result = await searchTflJourney(origin, destination, date);
      return res.status(result.status).json(result.body);
    }

    if (country === "united_states") {
      const result = await searchMbtaJourney(origin, destination, date);
      return res.status(result.status).json(result.body);
    }

    return res.status(400).json({
      error: "Invalid country",
      message: "Country must be japan, korea, hong_kong, united_kingdom, or united_states.",
      results: [],
    });
  });

  // Stations API
  app.get("/api/transit/stations", async (req, res) => {
    const { country } = req.query;

    if (country === "japan") {
      return res.json({ stations: japanStations });
    }

    if (country === "korea") {
      return res.json({ stations: koreaStations });
    }

    if (country === "hong_kong") {
      return res.json({ stations: hongKongStations });
    }

    if (country === "united_kingdom") {
      try {
        const stations = await getTflStations();
        return res.json({ stations, source: "https://api.tfl.gov.uk" });
      } catch (error) {
        return res.status(502).json({
          error: "Provider request failed",
          message: error instanceof Error ? error.message : "Could not reach TfL.",
          stations: [],
        });
      }
    }

    if (country === "united_states") {
      try {
        const stations = await getMbtaStations();
        return res.json({ stations, source: "https://api-v3.mbta.com" });
      } catch (error) {
        return res.status(502).json({
          error: "Provider request failed",
          message: error instanceof Error ? error.message : "Could not reach MBTA.",
          stations: [],
        });
      }
    }

    return res.status(400).json({
      error: "Invalid country",
      message: "Country must be japan, korea, hong_kong, united_kingdom, or united_states.",
      stations: [],
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
