import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { ScrapedRoute, ScrapedRouteData, ScraperAdapter } from "./types";
import { recordError } from "../../src/server/errorLog";
import { dedupeScrapedResults, describingRoute, replaceDateSlice } from "./merge";
import type { Country } from "../../src/types";
import {
  buildSourceMeta,
  findOfficialSource,
  type OfficialSourceId,
  type SourceCompleteness,
  type SourceType,
} from "../../src/data/sourceRegistry";

const DATA_DIR = resolve("src/data/scraped");

interface RunAllOptions {
  keepDates?: string[];
}

/** What one route attempt did, for the run's metadata and its exit status. */
export interface RouteOutcome {
  origin: string;
  destination: string;
  date: string;
  status: "ok" | "failed";
  rowCount: number;
  sourceId?: OfficialSourceId;
  error?: string;
}

export interface ScrapeRunReport {
  country: Country;
  scraper: string;
  date: string;
  outcomes: RouteOutcome[];
}

function stationSlug(name: string): string {
  return name
    .replace(/\s*\([A-Z0-9]+\)\s*/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Shared machinery for every scraper: run the configured routes, stamp each
 * result with the registered source that produced it, and merge one service
 * day into the stored file.
 *
 * The rule this class enforces, and the reason it has no `scrape` fallback of
 * its own: **a route that fails leaves its previous file untouched.** Yesterday's
 * real timetable, clearly stamped with yesterday's fetch time, is a better
 * answer than anything this process could invent to fill the gap, and it is a
 * far better answer than an empty file that reads as "no service today".
 *
 * Concrete scrapers do not extend this directly. They extend one of the source
 * kinds in `kinds.ts`, which additionally constrains what they may claim about
 * where their data came from.
 */
export abstract class BaseScraper implements ScraperAdapter {
  abstract readonly name: string;
  abstract readonly country: Country;
  abstract readonly routes: ScrapedRoute[];

  /**
   * The artifact families this scraper kind is allowed to produce. Set by the
   * kind subclass, checked against the register for every route, so a class
   * cannot stamp a source type it does not actually fetch.
   */
  protected abstract readonly permittedSourceTypes: readonly SourceType[];

  /** The registered source backing every route, unless {@link sourceIdFor} narrows it. */
  abstract readonly sourceId: OfficialSourceId;

  abstract scrape(route: ScrapedRoute, date: string, page: any): Promise<ScrapedRouteData>;

  /** Live browser scrapers set this true; feed and API scrapers skip Chromium. */
  protected readonly usesBrowser: boolean = false;

  /**
   * Browser query pages interpret date pickers in the browser's local zone.
   * A provider-specific zone prevents a Taiwan runner from selecting the
   * previous service date on an American or European journey planner.
   */
  protected readonly browserTimezoneId?: string;

  /** Most of a run's routes share one source; Japan's span three operators. */
  sourceIdFor(_route: ScrapedRoute): OfficialSourceId {
    return this.sourceId;
  }

  /** What this run can substantiate for a route. Frequency scrapers narrow it. */
  protected completenessFor(_route: ScrapedRoute): SourceCompleteness | undefined {
    return undefined;
  }

  private lastReport: ScrapeRunReport | undefined;

  /** The outcome of the most recent {@link runAll}, for metadata and exit status. */
  report(): ScrapeRunReport | undefined {
    return this.lastReport;
  }

  async runAll(date: string, options: RunAllOptions = {}): Promise<ScrapedRouteData[]> {
    this.assertRegisteredSources();
    const { chromium } = this.usesBrowser
      ? await import("playwright")
      : { chromium: undefined };
    const browser = chromium ? await chromium.launch({ headless: true }) : null;
    const context = browser
      ? await browser.newContext({
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...(this.browserTimezoneId ? { timezoneId: this.browserTimezoneId } : {}),
        })
      : null;

    const results: ScrapedRouteData[] = [];
    const outcomes: RouteOutcome[] = [];
    for (const route of this.routes) {
      console.log(`  ${this.country}: scraping ${route.origin} → ${route.destination}...`);
      const page = context ? await context.newPage() : undefined;
      try {
        const data = this.withResultDates(this.stampSource(await this.scrape(route, date, page), route, date));
        results.push(data);
        this.saveRoute(data, options);
        outcomes.push({
          origin: route.origin,
          destination: route.destination,
          date,
          status: "ok",
          rowCount: data.results.length,
          sourceId: this.sourceIdFor(route),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${route.origin} → ${route.destination} FAILED: ${message}`);
        console.error(`    keeping the previously committed file for this route`);
        outcomes.push({
          origin: route.origin,
          destination: route.destination,
          date,
          status: "failed",
          rowCount: 0,
          sourceId: this.sourceIdFor(route),
          error: message,
        });
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
            sourceId: this.sourceIdFor(route),
          },
        });
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }

    if (browser) await browser.close();
    this.lastReport = { country: this.country, scraper: this.name, date, outcomes };

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

  /**
   * Fail the run before it touches the network if a route names a source this
   * kind cannot produce. Catching it here rather than at write time means a
   * mis-declared scraper never gets as far as putting a wrongly-labelled file
   * on disk for a later run to merge into.
   */
  assertRegisteredSources(): void {
    for (const route of this.routes) {
      const id = this.sourceIdFor(route);
      const source = findOfficialSource(id);
      if (!source) {
        throw new Error(`${this.name}: route ${route.origin} → ${route.destination} names unregistered source "${id}".`);
      }
      if (source.country !== this.country) {
        throw new Error(`${this.name}: source "${id}" belongs to ${source.country}, not ${this.country}.`);
      }
      if (!this.permittedSourceTypes.includes(source.sourceType)) {
        throw new Error(
          `${this.constructor.name} may not produce ${source.sourceType} data (source "${id}").`,
        );
      }
    }
  }

  /**
   * Attach the provenance block. Adapters return timetable rows; they never get
   * to describe their own trustworthiness, so anything they set here is
   * overwritten from the register.
   */
  private stampSource(data: ScrapedRouteData, route: ScrapedRoute, date: string): ScrapedRouteData {
    const sourceId = this.sourceIdFor(route);
    const sourceMeta = buildSourceMeta({
      sourceId,
      fetchedAt: data.scrapedAt || new Date().toISOString(),
      completeness: this.completenessFor(route),
    });
    if (data.results.some((result) => result.country !== this.country)) {
      throw new Error(`${this.name}: ${route.origin} → ${route.destination} returned rows for another country.`);
    }
    return {
      ...data,
      date,
      source: sourceMeta.sourceName,
      sourceMeta,
      provenance: "official",
    };
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

    const describedBy = describingRoute(existing ?? undefined, data, mergedResults.length);

    writeFileSync(
      path,
      JSON.stringify({
        ...describedBy,
        // The description follows the rows: if a sparse live response was
        // rejected in favour of the fuller stored slice, the file keeps saying
        // where those stored rows actually came from.
        source: replacement.preservedExisting && existing?.source ? existing.source : describedBy.source,
        sourceMeta: replacement.preservedExisting && existing?.sourceMeta
          ? existing.sourceMeta
          : describedBy.sourceMeta,
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
}
