import { searchHongKongMtr } from "../../src/server/hongKongMtr";
import { searchMbtaJourney } from "../../src/server/mbta";
import { searchTflJourney } from "../../src/server/tfl";
import { searchSwissJourney } from "../../src/server/swiss";
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
import { collectFranceServiceDayArtifact } from "../../src/server/franceGtfs";
import { recordError } from "../../src/server/errorLog";
import { collectThailandServiceDayArtifact, THAILAND_BEM_URL } from "../../src/server/thailandBem";

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
    super("OpenTransportData Swiss", "switzerland", switzerlandRoutes, searchSwissJourney);
  }
}

export class GermanyScraper extends SnapshotScraper {
  constructor() {
    super("DB", "germany", germanyRoutes);
  }
}

export class FranceScraper extends SnapshotScraper {
  constructor() {
    super("SNCF", "france", franceRoutes);
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
