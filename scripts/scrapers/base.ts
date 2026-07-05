import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import type { ScrapedRoute, ScrapedRouteData, ScraperAdapter } from "./types";

const DATA_DIR = resolve("src/data/scraped");

export abstract class BaseScraper implements ScraperAdapter {
  abstract readonly name: string;
  abstract readonly country: string;
  abstract readonly routes: ScrapedRoute[];

  abstract scrape(route: ScrapedRoute, date: string, page: any): Promise<ScrapedRouteData>;

  async runAll(date: string): Promise<ScrapedRouteData[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const results: ScrapedRouteData[] = [];
    for (const route of this.routes) {
      console.log(`  ${this.country}: scraping ${route.origin} → ${route.destination}...`);
      const page = await context.newPage();
      try {
        const data = await this.scrape(route, date, page);
        results.push(data);
        this.saveRoute(data);
      } catch (error) {
        console.error(`  ✗ ${route.origin} → ${route.destination} FAILED:`, error instanceof Error ? error.message : error);
      } finally {
        await page.close().catch(() => {});
      }
    }

    await browser.close();
    return results;
  }

  private saveRoute(data: ScrapedRouteData): void {
    const dir = `${DATA_DIR}/${this.country}`;
    mkdirSync(dir, { recursive: true });
    const filename = data.origin
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + data.destination.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      + ".json";
    writeFileSync(
      resolve(dir, filename),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
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
