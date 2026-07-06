import { BaseScraper } from "./base";
import { japanRoutes } from "./routes";
import type { ScrapedRoute, ScrapedRouteData } from "./types";

/**
 * Japan does not have a usable live provider. The previous Jorudan DOM scraper
 * never produced usable rows — its CSS/table heuristics never matched Jorudan's
 * markup, and even the happy path dropped price (a no-op ternary), duration
 * (never parsed) and arrival time (read from the wrong cell) — so every run
 * silently fell back to a generated timetable. That dead path is removed; the
 * scraper now deterministically builds the curated JR Shinkansen timetable it
 * was always really serving. Durations and fares are reference values per route.
 */
interface RouteInfo {
  line: string;
  durationMinutes: number;
  price: number;
}

// Keyed by `${origin}-${destination}`. Durations/fares preserved from the
// long-standing fallback table; `line` names the real Shinkansen service.
const ROUTE_INFO: Record<string, RouteInfo> = {
  "Tokyo-Shin-Osaka": { line: "Nozomi", durationMinutes: 150, price: 14560 },
  "Tokyo-Kyoto": { line: "Nozomi", durationMinutes: 138, price: 13890 },
  "Tokyo-Nagoya": { line: "Nozomi", durationMinutes: 90, price: 11330 },
  "Tokyo-Hakata": { line: "Nozomi", durationMinutes: 300, price: 23280 },
  "Tokyo-Sendai": { line: "Hayabusa", durationMinutes: 150, price: 11330 },
  "Tokyo-Kanazawa": { line: "Kagayaki", durationMinutes: 210, price: 14340 },
  "Tokyo-Niigata": { line: "Toki", durationMinutes: 120, price: 11580 },
  "Shin-Osaka-Hakata": { line: "Nozomi", durationMinutes: 150, price: 15870 },
  "Shin-Osaka-Tokyo": { line: "Nozomi", durationMinutes: 150, price: 14560 },
  "Nagoya-Shin-Osaka": { line: "Nozomi", durationMinutes: 60, price: 6730 },
  "Sendai-Tokyo": { line: "Hayabusa", durationMinutes: 150, price: 11330 },
};

const SERVICE_START = 6 * 60; // 06:00
const SERVICE_END = 22 * 60; // 22:00
const HEADWAY = 30; // minutes

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (minutes: number) => `${pad(Math.floor((minutes % 1440) / 60))}:${pad(minutes % 60)}`;

export class JapanScraper extends BaseScraper {
  readonly name = "JR Timetable";
  readonly country = "japan";
  readonly routes = japanRoutes;

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "Curated JR Shinkansen timetable",
      results: this.buildTimetable(route),
    };
  }

  private buildTimetable(route: ScrapedRoute) {
    const info = ROUTE_INFO[`${route.origin}-${route.destination}`]
      ?? { line: "Shinkansen", durationMinutes: 120, price: 10000 };

    const results = [];
    let i = 0;
    for (let m = SERVICE_START; m <= SERVICE_END; m += HEADWAY) {
      results.push({
        id: `jp-${route.origin}-${route.destination}-${i}`,
        country: "japan" as const,
        operator: "JR",
        service: `${info.line} ${pad(100 + i)}`,
        departureTime: fmt(m),
        arrivalTime: fmt(m + info.durationMinutes),
        durationMinutes: info.durationMinutes,
        price: info.price,
        currency: "JPY" as const,
        origin: route.origin,
        destination: route.destination,
        direct: true,
        stops: [route.origin, route.destination],
      });
      i += 1;
    }
    return results;
  }
}
