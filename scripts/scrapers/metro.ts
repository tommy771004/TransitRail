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
import { BrowserScraper, FrequencyScraper, OfficialFeedScraper } from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { collectFranceServiceDayArtifact, searchFranceGtfs } from "../../src/server/franceGtfs";
import { searchGermanyGtfs } from "../../src/server/germanyGtfs";
import { recordError } from "../../src/server/errorLog";
import { collectThailandServiceDayArtifact, THAILAND_BEM_URL } from "../../src/server/thailandBem";
import { collectSingaporeServiceDayArtifact } from "../../src/server/singaporeSmrt";
import { searchSingaporeLtaGtfs } from "../../src/server/singaporeLtaGtfs";
import { collectHongKongServiceDayArtifact } from "../../src/server/hongKongServiceHours";
import { providerDateValue } from "../../src/data/countries";
import { scrapeMbtaBrowserServiceDay } from "../../src/server/mbtaBrowser";

/**
 * LTA's official static GTFS supplies the verified departure rows. SMRT's
 * first/last and headway data still supplies the separate service-day advisory;
 * it is never expanded into invented timetable departures.
 */
export class SingaporeScraper extends OfficialFeedScraper {
  constructor() {
    super("LTA DataMall GTFS", "singapore", singaporeRoutes, "sg-lta-gtfs", searchSingaporeLtaGtfs);
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    try {
      await collectSingaporeServiceDayArtifact([...this.routes], date);
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

/**
 * London is scraped through TfL's Unified API, not its website.
 *
 * The website sweep ({@link ../../src/server/tflBrowser}) is kept and tested,
 * but it is not wired here: tfl.gov.uk sits behind a Cloudflare challenge that
 * answers an automated browser with "Just a moment… Verification required"
 * instead of journey results. That is TfL declining to be scraped, and this
 * project does not defeat a bot check to get at a page whose data the operator
 * already publishes through a documented, free API. The API is tier A against
 * the website's tier B, so the sanctioned route is also the better-graded one.
 */
export class UnitedKingdomScraper extends OfficialFeedScraper {
  constructor() {
    super("TfL", "united_kingdom", unitedKingdomRoutes, "uk-tfl-journey-planner", searchTflServiceDay);
  }
}

export class UnitedStatesScraper extends OfficialFeedScraper {
  constructor() {
    super(
      "MBTA",
      "united_states",
      unitedStatesRoutes.filter((route) => !(route.origin === "Park Street" && route.destination === "Boston College")),
      "us-mbta-v3",
      searchMbtaJourney,
    );
  }
}

/**
 * The MBTA V3 schedules endpoint omits Green Line B journeys during planned
 * diversions even though the official passenger planner publishes usable
 * alternatives. Drive that page for the affected station pair and keep only
 * itinerary groups that the page marks as available.
 */
export class UnitedStatesBrowserScraper extends BrowserScraper {
  readonly name = "MBTA Trip Planner browser";
  readonly country = "united_states";
  readonly routes = unitedStatesRoutes.filter(
    (route) => route.origin === "Park Street" && route.destination === "Boston College",
  );
  readonly sourceId = "us-mbta-journey-planner-web";
  protected override readonly browserTimezoneId = "America/New_York";

  async scrape(route: ScrapedRoute, date: string, page: Parameters<typeof scrapeMbtaBrowserServiceDay>[0]) {
    return scrapeMbtaBrowserServiceDay(page, route.origin, route.destination, date);
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
