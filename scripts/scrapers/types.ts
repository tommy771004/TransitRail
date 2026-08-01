import type { ScrapedRouteData } from "../../src/data/scraped/timetableDay";
import type { Country } from "../../src/types";

export type { ScrapedRouteData } from "../../src/data/scraped/timetableDay";

export interface ScrapedRoute {
  origin: string;
  destination: string;
}

export interface ScraperAdapter {
  readonly name: string;
  readonly country: Country;
  readonly routes: ScrapedRoute[];
  scrape(route: ScrapedRoute, date: string, browser: any): Promise<ScrapedRouteData>;
}
