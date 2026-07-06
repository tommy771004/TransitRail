import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { BaseScraper } from "./base";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { SearchResponse, TransitResult } from "../../src/types";

const DATA_DIR = resolve("src/data/scraped");

const key = (value: string) => value.toLowerCase().trim();

/**
 * Collapse a stored route file back to a single, dateless canonical day of
 * departures. A saved file accumulates one dated copy of the timetable per
 * scrape date; without this, loadSnapshot would hand every one of those dates
 * back to saveRoute, which re-merges them and duplicates the results on every
 * run (the cause of the 64× row explosion seen in older files). Stripping the
 * date lets BaseScraper.withResultDates re-stamp the template with the current
 * scrape date, keeping each day's timetable to one clean copy.
 */
export function canonicalDay(results: TransitResult[]): TransitResult[] {
  const byBaseId = new Map<string, TransitResult>();
  for (const result of results) {
    const baseId = result.id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (byBaseId.has(baseId)) continue;
    const { date: _date, ...rest } = result;
    byBaseId.set(baseId, { ...rest, id: baseId });
  }
  return Array.from(byBaseId.values());
}

export class SnapshotScraper extends BaseScraper {
  constructor(
    readonly name: string,
    readonly country: string,
    readonly routes: ScrapedRoute[],
  ) {
    super();
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    return {
      ...this.loadSnapshot(route),
      date,
      scrapedAt: new Date().toISOString(),
      source: `${this.name} curated snapshot`,
    };
  }

  protected loadSnapshot(route: ScrapedRoute): ScrapedRouteData {
    const dir = resolve(DATA_DIR, this.country);
    if (!existsSync(dir)) {
      throw new Error(`No scraped data directory found for ${this.country}`);
    }

    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      const data = JSON.parse(readFileSync(resolve(dir, file), "utf-8")) as ScrapedRouteData;
      if (key(data.origin) === key(route.origin) && key(data.destination) === key(route.destination)) {
        return { ...data, results: canonicalDay(data.results) };
      }
    }

    throw new Error(`No snapshot found for ${this.country}: ${route.origin} → ${route.destination}`);
  }
}

export class ProviderBackedScraper extends SnapshotScraper {
  constructor(
    name: string,
    country: string,
    routes: ScrapedRoute[],
    private readonly providerSearch: (
      origin: string,
      destination: string,
      date: string,
    ) => Promise<{ status: number; body: SearchResponse & { error?: string } }>,
  ) {
    super(name, country, routes);
  }

  override async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const response = await this.providerSearch(route.origin, route.destination, date);
    if (response.status >= 200 && response.status < 300 && response.body.results.length > 0) {
      return {
        origin: route.origin,
        destination: route.destination,
        date,
        scrapedAt: new Date().toISOString(),
        source: response.body.source || this.name,
        results: response.body.results,
      };
    }

    const snapshot = this.loadSnapshot(route);
    return {
      ...snapshot,
      date,
      scrapedAt: new Date().toISOString(),
      source: `${this.name} curated snapshot fallback (${response.body.message || response.body.error || response.status})`,
    };
  }
}
