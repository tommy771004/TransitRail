import { BaseScraper } from "./base";
import { japanStationToJapanese } from "./stationMaps";
import { japanRoutes } from "./routes";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { Page } from "playwright";

interface ParsedRow {
  service: string;
  departure: string;
  arrival: string;
  durationMinutes?: number;
  price?: number;
}

export class JapanScraper extends BaseScraper {
  readonly name = "Jorudan";
  readonly country = "japan";
  readonly routes = japanRoutes;

  async scrape(route: ScrapedRoute, date: string, page: Page): Promise<ScrapedRouteData> {
    const originJa = japanStationToJapanese[route.origin] || route.origin;
    const destJa = japanStationToJapanese[route.destination] || route.destination;
    const [y, m, d] = date.split("-");

    const allRows: ParsedRow[] = [];

    for (const hour of [8, 14]) {
      const url = `https://www.jorudan.co.jp/norikae/cgi/norikae.cgi`
        + `?eok=R&Soka=${encodeURIComponent(originJa)}&Toka=${encodeURIComponent(destJa)}`
        + `&y=${y}&m=${m}&d=${d}&hh=${hour}&mn=0&way=1`;

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(3000);

        // Try CSS-based table extraction
        const rows = await page.evaluate(() => {
          const resultRows: Array<{ service: string; departure: string; arrival: string; price: string; duration: string }> = [];

          // Look for route result tables — Jorudan uses class names like "route" or "result"
          const tables = document.querySelectorAll("table");
          for (const table of tables) {
            const trs = table.querySelectorAll("tr");
            for (const tr of trs) {
              const tds = tr.querySelectorAll("td");
              if (tds.length >= 4) {
                const text = Array.from(tds).map(td => td.textContent?.trim() || "");
                // Filter out header/summary rows
                if (text.some(t => /^\d{1,2}:\d{2}/.test(t)) && !text[0].includes("経路")) {
                  resultRows.push({
                    service: text[0] || "",
                    departure: text.find(t => /^\d{1,2}:\d{2}/.test(t)) || "",
                    arrival: "",
                    price: text.find(t => /[\d,]+円/.test(t)) || text.find(t => /^\d+/.test(t)) || "",
                    duration: text.find(t => /時間/.test(t) || /分/.test(t)) || "",
                  });
                }
              }
            }
          }

          // Also try div-based result cards
          const cards = document.querySelectorAll(".route-detail, .result-detail, [class*='result']");
          for (const card of cards) {
            const text = card.textContent?.trim() || "";
            if (/\d{1,2}:\d{2}/.test(text)) {
              const lines = card.querySelectorAll(".line-name, .train-name, [class*='line']");
              const times = card.querySelectorAll(".time, [class*='time']");
              const service = Array.from(lines).map(l => l.textContent?.trim()).filter(Boolean).join(" ");
              const departure = Array.from(times).map(t => t.textContent?.trim()).filter(Boolean).join(" ");
              resultRows.push({ service, departure, arrival: "", price: "", duration: "" });
            }
          }

          return resultRows;
        });

        // Parse time strings from text
        for (const row of rows) {
          const times = row.departure.match(/\d{1,2}:\d{2}/g);
          allRows.push({
            service: row.service,
            departure: times?.[0] || "--:--",
            arrival: times?.[1] || "",
            price: this ? undefined : undefined,
          });
        }
      } catch (error) {
        console.warn(`  Jorudan scrape failed for ${route.origin}→${route.destination} at hour ${hour}:`, error instanceof Error ? error.message : error);
      }
    }

    if (allRows.length === 0) {
      console.warn(`  No results from Jorudan, using fallback for ${route.origin} → ${route.destination}`);
      return {
        origin: route.origin,
        destination: route.destination,
        date,
        scrapedAt: new Date().toISOString(),
        source: "https://www.jorudan.co.jp (fallback)",
        results: this.fallbackScrape(route),
      };
    }

    const results = allRows.map((row, i) => ({
      id: `jp-${route.origin}-${route.destination}-${i}`,
      country: "japan" as const,
      operator: "JR",
      service: row.service || `Shinkansen ${String(i + 1).padStart(3, "0")}`,
      departureTime: row.departure,
      arrivalTime: row.arrival || undefined,
      durationMinutes: row.durationMinutes,
      price: row.price,
      currency: "JPY" as const,
      origin: route.origin,
      destination: route.destination,
      direct: true,
      stops: [route.origin, route.destination],
    }));

    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "https://www.jorudan.co.jp",
      results,
    };
  }

  private fallbackScrape(route: ScrapedRoute) {
    const travelTimes: Record<string, { hours: number; price: number }> = {
      "Tokyo-Shin-Osaka": { hours: 2.5, price: 14560 },
      "Tokyo-Kyoto": { hours: 2.3, price: 13890 },
      "Tokyo-Nagoya": { hours: 1.5, price: 11330 },
      "Tokyo-Hakata": { hours: 5, price: 23280 },
      "Tokyo-Sendai": { hours: 2.5, price: 11330 },
      "Tokyo-Kanazawa": { hours: 3.5, price: 14340 },
      "Tokyo-Niigata": { hours: 2, price: 11580 },
      "Shin-Osaka-Hakata": { hours: 2.5, price: 15870 },
      "Shin-Osaka-Tokyo": { hours: 2.5, price: 14560 },
      "Nagoya-Shin-Osaka": { hours: 1, price: 6730 },
      "Sendai-Tokyo": { hours: 2.5, price: 11330 },
    };

    const key = `${route.origin}-${route.destination}`;
    const info = travelTimes[key] || { hours: 2, price: 10000 };
    const results = [];

    for (let h = 6; h <= 21; h += 1) {
      const mins = Math.round(info.hours * 60);
      const depH = Math.floor(h);
      const depM = Math.round((h - depH) * 60);
      const arrTotal = depH * 60 + depM + mins;
      const arrH = Math.floor(arrTotal / 60) % 24;
      const arrM = arrTotal % 60;

      results.push({
        id: `jp-${key}-${h}`,
        country: "japan" as const,
        operator: "JR",
        service: `Shinkansen ${String(100 + h - 6).padStart(3, "0")}`,
        departureTime: `${String(depH).padStart(2, "0")}:${String(depM).padStart(2, "0")}`,
        arrivalTime: `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`,
        durationMinutes: mins,
        price: info.price,
        currency: "JPY" as const,
        origin: route.origin,
        destination: route.destination,
        direct: true,
        stops: [route.origin, route.destination],
      });
    }

    return results;
  }
}
