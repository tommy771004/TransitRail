import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import type { ScrapedRoute, ScrapedRouteData, ScraperAdapter } from "./types";

const DATA_DIR = resolve("src/data/scraped");

interface RunAllOptions {
  keepDates?: string[];
}

function stationSlug(name: string): string {
  return name
    .replace(/\s*\([A-Z0-9]+\)\s*/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export abstract class BaseScraper implements ScraperAdapter {
  abstract readonly name: string;
  abstract readonly country: string;
  abstract readonly routes: ScrapedRoute[];

  abstract scrape(route: ScrapedRoute, date: string, page: any): Promise<ScrapedRouteData>;

  async runAll(date: string, options: RunAllOptions = {}): Promise<ScrapedRouteData[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const results: ScrapedRouteData[] = [];
    for (const route of this.routes) {
      console.log(`  ${this.country}: scraping ${route.origin} → ${route.destination}...`);
      const page = await context.newPage();
      try {
        const data = this.withResultDates(await this.scrape(route, date, page));
        results.push(data);
        this.saveRoute(data, options);
      } catch (error) {
        console.error(`  ✗ ${route.origin} → ${route.destination} FAILED:`, error instanceof Error ? error.message : error);
      } finally {
        await page.close().catch(() => {});
      }
    }

    await browser.close();
    return results;
  }

  private saveRoute(data: ScrapedRouteData, options: RunAllOptions): void {
    const dir = `${DATA_DIR}/${this.country}`;
    mkdirSync(dir, { recursive: true });
    const filename = `${stationSlug(data.origin)}-${stationSlug(data.destination)}.json`;
    const path = resolve(dir, filename);
    const existing = this.readRoute(path);
    const keepDates = options.keepDates ? new Set(options.keepDates) : null;

    const previousResults = existing
      ? this.withResultDates(existing).results.filter((result) => result.date !== data.date)
      : [];
    const mergedResults = [...previousResults, ...data.results]
      .filter((result) => !keepDates || (result.date ? keepDates.has(result.date) : false))
      .sort((a, b) => {
        const dateCompare = (a.date || "").localeCompare(b.date || "");
        if (dateCompare !== 0) return dateCompare;
        return a.departureTime.localeCompare(b.departureTime);
      });
    const dates = Array.from(new Set(mergedResults.map((result) => result.date).filter(Boolean))).sort();
    const dateLabel = dates.length > 1 ? `${dates[0]}..${dates[dates.length - 1]}` : (dates[0] || data.date);

    writeFileSync(
      path,
      JSON.stringify({
        ...data,
        date: dateLabel,
        scrapedAt: new Date().toISOString(),
        results: mergedResults,
      }, null, 2),
      "utf-8",
    );
  }

  private readRoute(path: string): ScrapedRouteData | null {
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as ScrapedRouteData;
    } catch {
      return null;
    }
  }

  private withResultDates(data: ScrapedRouteData): ScrapedRouteData {
    return {
      ...data,
      results: data.results.map((result) => {
        const resultDate = result.date || data.date;
        return {
          ...result,
          date: resultDate,
          id: result.date ? result.id : `${resultDate}-${result.id}`,
        };
      }),
    };
  }

  saveMetadata(results: ScrapedRouteData[]): void {
    const dir = `${DATA_DIR}/${this.country}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "metadata.json"),
      JSON.stringify({
        country: this.country,
        scraper: this.name,
        lastScraped: new Date().toISOString(),
        routeCount: results.length,
        routes: results.map((r) => ({
          origin: r.origin,
          destination: r.destination,
          resultCount: r.results.length,
          date: r.date,
        })),
      }, null, 2),
      "utf-8",
    );
  }
}
