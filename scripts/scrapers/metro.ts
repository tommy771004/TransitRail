import { searchHongKongMtr } from "../../src/server/hongKongMtr";
import { searchMbtaJourney } from "../../src/server/mbta";
import { searchTflJourney } from "../../src/server/tfl";
import { prepareSwissGtfsBatch, searchSwissGtfs } from "../../src/server/swissGtfs";
import { searchBelgiumJourney } from "../../src/server/belgium";
import { searchNorwayJourney } from "../../src/server/norway";
import { chromium } from "playwright";
import {
  belgiumRoutes,
  norwayRoutes,
  chinaRoutes,
  franceRoutes,
  germanyRoutes,
  hongKongRoutes,
  singaporeRoutes,
  switzerlandRoutes,
  thailandRoutes,
  unitedKingdomRoutes,
  unitedStatesRoutes,
} from "./routes";
import { ProviderBackedScraper, SnapshotScraper } from "./snapshot";
import type { ScrapedRouteData } from "./types";
import { collectFranceServiceDayArtifact, searchFranceGtfs } from "../../src/server/franceGtfs";
import { searchGermanyGtfs } from "../../src/server/germanyGtfs";
import { recordError } from "../../src/server/errorLog";
import { collectThailandServiceDayArtifact, THAILAND_BEM_URL } from "../../src/server/thailandBem";
import { collectSingaporeServiceDayArtifact } from "../../src/server/singaporeSmrt";

function dateInThailand(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export class SingaporeScraper extends SnapshotScraper {
  constructor() {
    super("LTA", "singapore", singaporeRoutes);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    try {
      await collectSingaporeServiceDayArtifact(this.routes, date);
    } catch (error) {
      console.warn(`  ${this.country}: SMRT service-day artifact refresh skipped:`, error instanceof Error ? error.message : error);
      await recordError({
        severity: "error",
        module: "scraper",
        operation: "service-day.artifact",
        errorCode: "SMRT_ARTIFACT_REFRESH_FAILED",
        error,
        country: "singapore",
        provider: "SMRT official station information API",
        context: { date, routeCount: this.routes.length },
      });
    }
    return results;
  }
}

export class ThailandScraper extends SnapshotScraper {
  constructor() {
    super("BTS/MRT", "thailand", thailandRoutes);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    if (date !== dateInThailand()) return results;

    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      });
      await page.goto(THAILAND_BEM_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await collectThailandServiceDayArtifact(await page.content(), this.routes, date);
      await page.close();
    } catch (error) {
      console.warn(`  ${this.country}: service-day artifact refresh skipped:`, error instanceof Error ? error.message : error);
      await recordError({
        severity: "error",
        module: "scraper",
        operation: "service-day.artifact",
        errorCode: "BEM_ARTIFACT_REFRESH_FAILED",
        error,
        country: "thailand",
        provider: "BEM MRT official HTML",
        context: { date, routeCount: this.routes.length, sourceUrl: THAILAND_BEM_URL },
      });
    } finally {
      await browser?.close().catch(() => {});
    }
    return results;
  }
}

export class HongKongScraper extends ProviderBackedScraper {
  constructor() {
    super("MTR", "hong_kong", hongKongRoutes, searchHongKongMtr);
  }
}

export class UnitedKingdomScraper extends ProviderBackedScraper {
  constructor() {
    super("TfL", "united_kingdom", unitedKingdomRoutes, searchTflJourney);
  }
}

export class UnitedStatesScraper extends ProviderBackedScraper {
  constructor() {
    super("MBTA", "united_states", unitedStatesRoutes, searchMbtaJourney);
  }
}

export class SwitzerlandScraper extends ProviderBackedScraper {
  constructor() {
    super("OpenTransportData Swiss GTFS", "switzerland", switzerlandRoutes, searchSwissGtfs);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}) {
    // The Swiss stop_times.txt is hundreds of MB uncompressed. Prepare every
    // configured route/date once, then let ProviderBackedScraper persist the
    // results and retain snapshot fallback semantics if the feed is unavailable.
    try {
      await prepareSwissGtfsBatch(this.routes, options.keepDates?.length ? options.keepDates : [date]);
    } catch (error) {
      console.warn(`  ${this.country}: GTFS batch preparation failed; using route fallbacks:`, error instanceof Error ? error.message : error);
    }
    return super.runAll(date, options);
  }
}

export class GermanyScraper extends ProviderBackedScraper {
  constructor() {
    super("gtfs.de", "germany", germanyRoutes, searchGermanyGtfs);
  }
}

export class FranceScraper extends ProviderBackedScraper {
  constructor() {
    super("SNCF", "france", franceRoutes, searchFranceGtfs);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    try {
      await collectFranceServiceDayArtifact(this.routes, date);
    } catch (error) {
      // Keep the previous artifact and let the shared error log carry the
      // diagnostic; route snapshots remain available for this scrape run.
      console.warn(`  ${this.country}: service-day artifact refresh skipped:`, error instanceof Error ? error.message : error);
      await recordError({
        severity: "error",
        module: "scraper",
        operation: "service-day.artifact",
        errorCode: "SNCF_GTFS_ARTIFACT_REFRESH_FAILED",
        error,
        country: "france",
        provider: "SNCF Open Data GTFS",
        context: { date, routeCount: this.routes.length },
      });
    }
    return results;
  }
}

export class BelgiumScraper extends ProviderBackedScraper {
  constructor() {
    super("iRail", "belgium", belgiumRoutes, searchBelgiumJourney);
  }
}

export class NorwayScraper extends ProviderBackedScraper {
  constructor() {
    super("Entur Journey Planner", "norway", norwayRoutes, searchNorwayJourney);
  }
}

export class ChinaScraper extends SnapshotScraper {
  constructor() {
    super("12306", "china", chinaRoutes);
  }
}
