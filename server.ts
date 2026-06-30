import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { japanStations, koreaStations } from "./src/data/stations";

dotenv.config();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Search API that acts as a proxy/stub for the real APIs
  app.get("/api/transit/search", async (req, res) => {
    const { origin, destination, country } = req.query;

    if (country === "japan") {
      const apiKey = process.env.ODPT_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          error: "API Key Missing",
          message: "Please configure the ODPT_API_KEY environment variable to fetch real Japan transit data.",
          source: "https://developer.odpt.org/",
        });
      }
      return res.json({ results: [] });
    }

    if (country === "korea") {
      const apiKey = process.env.ODSAY_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          error: "API Key Missing",
          message: "Please configure the ODSAY_API_KEY environment variable to fetch real Korea transit data.",
          source: "https://lab.odsay.com/",
        });
      }
      return res.json({ results: [] });
    }

    return res.status(400).json({ error: "Invalid country" });
  });

  // Stations API
  app.get("/api/transit/stations", (req, res) => {
    const { country } = req.query;
    
    if (country === "japan") {
      return res.json({ stations: japanStations });
    }
    
    if (country === "korea") {
      return res.json({ stations: koreaStations });
    }
    
    return res.status(400).json({ error: "Invalid country" });
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
