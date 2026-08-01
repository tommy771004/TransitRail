import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import type { ScrapedRoute, ScrapedRouteData, ScraperAdapter } from "./types";
import { recordError } from "../../src/server/errorLog";
import { dedupeScrapedResults, replaceDateSlice } from "./merge";
import type { Country } from "../../src/types";

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
  abstract readonly country: Country;
  abstract readonly routes: ScrapedRoute[];

  abstract scrape(route: ScrapedRoute, date: string, page: any): Promise<ScrapedRouteData>;

  /** Live browser scrapers (Japan) set this true. Snapshot / provider-backed
   *  scrapers read a curated file or call a JSON API, so they skip Chromium. */
  protected readonly usesBrowser: boolean = true;

  async runAll(date: string, options: RunAllOptions = {}): Promise<ScrapedRouteData[]> {
    const browser = this.usesBrowser ? await chromium.launch({ headless: true }) : null;
    const context = browser
      ? await browser.newContext({
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
      : null;

    const results: ScrapedRouteData[] = [];
    for (const route of this.routes) {
      console.log(`  ${this.country}: scraping ${route.origin} → ${route.destination}...`);
      const page = context ? await context.newPage() : undefined;
      try {
        const data = this.withResultDates(await this.scrape(route, date, page));
        results.push(data);
        this.saveRoute(data, options);
      } catch (error) {
        console.error(`  ✗ ${route.origin} → ${route.destination} FAILED:`, error instanceof Error ? error.message : error);
        await recordError({
          severity: "error",
          module: "scraper",
          operation: "route.scrape",
          errorCode: "SCRAPER_ROUTE_FAILED",
          error,
          country: this.country,
          provider: this.name,
          context: {
            origin: route.origin,
            destination: route.destination,
            date,
            usesBrowser: this.usesBrowser,
          },
        });
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }

    if (browser) await browser.close();
    if (results.length === 0 && this.routes.length > 0) {
      await recordError({
        severity: "critical",
        module: "scraper",
        operation: "country.scrape",
        errorCode: "SCRAPER_COUNTRY_EMPTY",
        message: `No routes were refreshed for ${this.country}.`,
        country: this.country,
        provider: this.name,
        context: { date, routeCount: this.routes.length },
      });
    }
    return results;
  }

  private saveRoute(data: ScrapedRouteData, options: RunAllOptions): void {
    const dir = `${DATA_DIR}/${this.country}`;
    mkdirSync(dir, { recursive: true });
    const filename = `${stationSlug(data.origin)}-${stationSlug(data.destination)}.json`;
    const path = resolve(dir, filename);
    const existing = this.readRoute(path);
    const keepDates = options.keepDates ? new Set(options.keepDates) : null;

    const existingWithDates = existing ? this.withResultDates(existing) : undefined;
    const existingDateResults = existingWithDates?.results.filter((result) => result.date === data.date) || [];
    const replacement = replaceDateSlice(existingDateResults, data.results);
    const previousResults = existingWithDates
      ? existingWithDates.results.filter((result) => result.date !== data.date)
      : [];
    const mergedResults = dedupeScrapedResults(
      [...previousResults, ...replacement.results]
        .filter((result) => !keepDates || (result.date ? keepDates.has(result.date) : false)),
    )
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
        source: replacement.preservedExisting && existing?.source ? existing.source : data.source,
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

  protected withResultDates(data: ScrapedRouteData): ScrapedRouteData {
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
