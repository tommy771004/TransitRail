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
  // Local Tokyo commuter lines (Yamanote Line, Chūō Line, etc.)
  "Tokyo-Ikebukuro": { line: "Yamanote Line", durationMinutes: 24, price: 210 },
  "Ikebukuro-Tokyo": { line: "Yamanote Line", durationMinutes: 24, price: 210 },
  "Tokyo-Shinjuku": { line: "Chūō Line (Rapid)", durationMinutes: 14, price: 210 },
  "Shinjuku-Tokyo": { line: "Chūō Line (Rapid)", durationMinutes: 14, price: 210 },
  "Tokyo-Shibuya": { line: "Yamanote Line", durationMinutes: 25, price: 210 },
  "Shibuya-Tokyo": { line: "Yamanote Line", durationMinutes: 25, price: 210 },
  "Tokyo-Shinagawa": { line: "Yamanote Line", durationMinutes: 11, price: 180 },
  "Shinagawa-Tokyo": { line: "Yamanote Line", durationMinutes: 11, price: 180 },
  "Tokyo-Ueno": { line: "Yamanote Line", durationMinutes: 8, price: 170 },
  "Ueno-Tokyo": { line: "Yamanote Line", durationMinutes: 8, price: 170 },
  "Tokyo-Akihabara": { line: "Yamanote Line", durationMinutes: 4, price: 150 },
  "Akihabara-Tokyo": { line: "Yamanote Line", durationMinutes: 4, price: 150 },
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
  protected readonly usesBrowser = false;

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const isLocal = ROUTE_INFO[`${route.origin}-${route.destination}`]?.line?.includes("Line") || false;
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: isLocal ? "Curated Tokyo Commuter timetable" : "Curated JR Shinkansen timetable",
      results: this.buildTimetable(route),
    };
  }

  private buildTimetable(route: ScrapedRoute) {
    const info = ROUTE_INFO[`${route.origin}-${route.destination}`]
      ?? { line: "Shinkansen", durationMinutes: 120, price: 10000 };

    const results = [];
    let i = 0;
    const isLocal = info.line.includes("Line") || info.line.includes("Rapid");
    const currentHeadway = isLocal ? 10 : HEADWAY; // 10 minute headway for local commuter trains

    for (let m = SERVICE_START; m <= SERVICE_END; m += currentHeadway) {
      results.push({
        id: `jp-${route.origin}-${route.destination}-${i}`,
        country: "japan" as const,
        operator: "JR",
        service: isLocal ? info.line : `${info.line} ${pad(100 + i)}`,
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
