import type { TransitResult } from "../../src/types";

export interface ScrapedRoute {
  origin: string;
  destination: string;
}

export interface ScrapedRouteData {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

export interface ScraperAdapter {
  readonly name: string;
  readonly country: string;
  readonly routes: ScrapedRoute[];
  scrape(route: ScrapedRoute, date: string, browser: any): Promise<ScrapedRouteData>;
}
