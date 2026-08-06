import { searchHongKongMtr } from "../../src/server/hongKongMtr";
import { searchMbtaJourney } from "../../src/server/mbta";
import { searchTflServiceDay } from "../../src/server/tfl";
import { prepareSwissGtfsBatch, searchSwissGtfs } from "../../src/server/swissGtfs";
import { searchBelgiumJourney } from "../../src/server/belgium";
import { searchNorwayJourney } from "../../src/server/norway";
import {
  belgiumRoutes,
  norwayRoutes,
  franceRoutes,
  germanyRoutes,
  hongKongRoutes,
  singaporeRoutes,
  switzerlandRoutes,
  thailandRoutes,
  unitedKingdomRoutes,
  unitedStatesRoutes,
} from "./routes";
import { FrequencyScraper, OfficialFeedScraper } from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { collectFranceServiceDayArtifact, searchFranceGtfs } from "../../src/server/franceGtfs";
import { searchGermanyGtfs } from "../../src/server/germanyGtfs";
import { recordError } from "../../src/server/errorLog";
import { collectThailandServiceDayArtifact, THAILAND_BEM_URL } from "../../src/server/thailandBem";
import { collectSingaporeServiceDayArtifact } from "../../src/server/singaporeSmrt";
import { collectHongKongServiceDayArtifact } from "../../src/server/hongKongServiceHours";
import { providerDateValue } from "../../src/data/countries";

/**
 * Singapore's operators publish first train, last train, and peak/off-peak
 * frequency — not a departure list. That is what gets stored: the route files
 * carry no departures at all and the numbers go to the service-day artifact.
 *
 * The previous build expanded the published headway into 763 invented
 * departures per route and served them as a timetable.
 */
export class SingaporeScraper extends FrequencyScraper {
  readonly name = "SMRT";
  readonly country = "singapore";
  readonly routes = singaporeRoutes;
  readonly sourceId = "sg-smrt-service-hours";

  protected async collectServiceDay(routes: readonly ScrapedRoute[], date: string): Promise<void> {
    try {
      await collectSingaporeServiceDayArtifact([...routes], date);
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
        context: { date, routeCount: routes.length },
      });
    }
  }
}

/** BEM publishes MRT service hours and headways as official HTML; same shape as Singapore. */
export class ThailandScraper extends FrequencyScraper {
  readonly name = "BEM";
  readonly country = "thailand";
  readonly routes = thailandRoutes;
  readonly sourceId = "th-bem-service-hours";

  protected async collectServiceDay(routes: readonly ScrapedRoute[], date: string): Promise<void> {
    if (date !== providerDateValue("thailand")) return;
    try {
      const response = await fetch(THAILAND_BEM_URL, {
        headers: { "user-agent": "TransitRail/1.0 (+https://github.com/tommy771004/TransitRail)" },
      });
      if (!response.ok) throw new Error(`${THAILAND_BEM_URL} responded HTTP ${response.status}`);
      await collectThailandServiceDayArtifact(await response.text(), [...routes], date);
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
        context: { date, routeCount: routes.length, sourceUrl: THAILAND_BEM_URL },
      });
    }
  }
}

/**
 * MTR's feed answers "the next four trains" and nothing about any other date,
 * so future service days get no departure rows at all. The official first/last
 * train per direction does cover future dates, and that is collected instead —
 * it is what a future service day can honestly say.
 */
export class HongKongScraper extends OfficialFeedScraper {
  constructor() {
    super("MTR", "hong_kong", hongKongRoutes, "hk-mtr-next-train", searchHongKongMtr);
  }

  protected override isProviderToday(date: string): boolean {
    return date === providerDateValue("hong_kong");
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    try {
      await collectHongKongServiceDayArtifact(this.routes, date);
    } catch (error) {
      console.warn(`  ${this.country}: MTR service-day artifact refresh skipped:`, error instanceof Error ? error.message : error);
      await recordError({
        severity: "error",
        module: "scraper",
        operation: "service-day.artifact",
        errorCode: "MTR_ARTIFACT_REFRESH_FAILED",
        error,
        country: "hong_kong",
        provider: "MTR official service hours",
        context: { date, routeCount: this.routes.length },
      });
    }
    return results;
  }
}

export class UnitedKingdomScraper extends OfficialFeedScraper {
  constructor() {
    super("TfL", "united_kingdom", unitedKingdomRoutes, "uk-tfl-journey-planner", searchTflServiceDay);
  }
}

export class UnitedStatesScraper extends OfficialFeedScraper {
  constructor() {
    super("MBTA", "united_states", unitedStatesRoutes, "us-mbta-v3", searchMbtaJourney);
  }
}

export class SwitzerlandScraper extends OfficialFeedScraper {
  constructor() {
    super("OpenTransportData Swiss GTFS", "switzerland", switzerlandRoutes, "ch-opentransportdata-gtfs", searchSwissGtfs);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}) {
    // The Swiss stop_times.txt is hundreds of MB uncompressed. Prepare every
    // configured route/date once; a failure here leaves each route to fail
    // individually, which keeps its previously committed file.
    try {
      await prepareSwissGtfsBatch(this.routes, options.keepDates?.length ? options.keepDates : [date]);
    } catch (error) {
      console.warn(`  ${this.country}: GTFS batch preparation failed:`, error instanceof Error ? error.message : error);
    }
    return super.runAll(date, options);
  }
}

export class GermanyScraper extends OfficialFeedScraper {
  constructor() {
    super("gtfs.de", "germany", germanyRoutes, "de-gtfs", searchGermanyGtfs);
  }
}

export class FranceScraper extends OfficialFeedScraper {
  constructor() {
    super("SNCF", "france", franceRoutes, "fr-sncf-gtfs", searchFranceGtfs);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    try {
      await collectFranceServiceDayArtifact(this.routes, date);
    } catch (error) {
      // Keep the previous artifact and let the shared error log carry the
      // diagnostic; route files remain available for this scrape run.
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

export class BelgiumScraper extends OfficialFeedScraper {
  constructor() {
    super("iRail", "belgium", belgiumRoutes, "be-irail", searchBelgiumJourney);
  }
}

export class NorwayScraper extends OfficialFeedScraper {
  constructor() {
    super("Entur Journey Planner", "norway", norwayRoutes, "no-entur", searchNorwayJourney);
  }
}
