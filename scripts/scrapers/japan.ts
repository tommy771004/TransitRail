import { DownloadScraper, HtmlScraper } from "./kinds";
import { japanJrCentralRoutes } from "./routes";
import { scrapeRoutePairs, summarizeGtfsRoutes } from "../lib/gtfsFeedSummary";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { odptRoutes } from "../../src/data/odptRoutes";
import { searchOdptTimetable } from "../../src/server/odptTimetable";
import { searchJrCentralTimetable } from "../../src/server/jrCentralTimetable";
import {
  japanGtfsFeedUrl,
  loadJapanGtfsFeed,
  searchJapanGtfsRail,
  KOTODEN_GTFS_RAIL,
  type JapanGtfsRailSource,
} from "../../src/server/japanGtfsJp";
import type { OfficialSourceId } from "../../src/data/sourceRegistry";
import type { SearchResponse } from "../../src/types";

type ProviderResponse = { status: number; body: SearchResponse & { error?: string } };
type ProviderSearch = (origin: string, destination: string, date: string) => Promise<ProviderResponse>;

function rowsOrThrow(response: ProviderResponse, label: string, route: ScrapedRoute, date: string) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.body.error || response.body.message || `${label} responded HTTP ${response.status}`);
  }
  if (response.body.results.length === 0) {
    throw new Error(`${label} returned no departures for ${route.origin} → ${route.destination} on ${date}`);
  }
  return response.body.results;
}

/**
 * Tokyo's two metro operators publish their train timetables through ODPT as
 * official JSON, per operator and per calendar.
 *
 * Tokyo Metro's dataset needs a key; Toei's public endpoint does not. Without
 * the key the Tokyo Metro routes are dropped from the run rather than filled
 * from somewhere else, so the ones that remain are all genuinely from ODPT.
 */
export class JapanOdptScraper extends DownloadScraper {
  readonly name = "ODPT";
  readonly country = "japan";
  readonly routes: ScrapedRoute[];
  readonly sourceId: OfficialSourceId = "jp-odpt-toei";
  private readonly skippedTokyoMetroRouteCount: number;
  private readonly sourceByRoute = new Map<string, OfficialSourceId>();

  constructor(private readonly odptSearch: ProviderSearch = searchOdptTimetable) {
    super();
    const hasTokyoMetroKey = Boolean(process.env.ODPT_API_KEY?.trim());
    const enabled = odptRoutes.filter((route) => route.operator !== "TokyoMetro" || hasTokyoMetroKey);
    this.routes = enabled;
    this.skippedTokyoMetroRouteCount = odptRoutes.length - enabled.length;
    for (const route of enabled) {
      this.sourceByRoute.set(
        `${route.origin}${route.destination}`,
        route.operator === "TokyoMetro" ? "jp-odpt-tokyo-metro" : "jp-odpt-toei",
      );
    }
  }

  override sourceIdFor(route: ScrapedRoute): OfficialSourceId {
    return this.sourceByRoute.get(`${route.origin}${route.destination}`) ?? this.sourceId;
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    if (this.skippedTokyoMetroRouteCount > 0) {
      console.log(
        `  japan: ODPT_API_KEY not set; skipping ${this.skippedTokyoMetroRouteCount} Tokyo Metro routes (Toei public routes remain enabled).`,
      );
    }
    return super.runAll(date, options);
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const response = await this.odptSearch(route.origin, route.destination, date);
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "",
      results: rowsOrThrow(response, "ODPT", route, date),
    };
  }
}

/**
 * JR Central's own Tokaido Shinkansen timetable search, queried for a specific
 * date and parsed from the HTML it returns.
 *
 * Graded C rather than B even though it is a journey search: we parse the
 * page's markup rather than a published data file, so a layout change is a
 * silent parsing risk in a way a GTFS schema change is not. Grading down is the
 * safe direction to be wrong in.
 */
export class JapanJrCentralScraper extends HtmlScraper {
  readonly name = "JR Central";
  readonly country = "japan";
  readonly routes = japanJrCentralRoutes;
  readonly sourceId: OfficialSourceId = "jp-jr-central";

  constructor(private readonly jrCentralSearch: ProviderSearch = searchJrCentralTimetable) {
    super();
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const response = await this.jrCentralSearch(route.origin, route.destination, date);
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "",
      results: rowsOrThrow(response, "JR Central", route, date),
    };
  }
}

/**
 * A Japanese local railway that publishes GTFS-JP.
 *
 * The scrape list is read out of the feed rather than written next to it: each
 * rail route's two busiest terminals become a pair in both directions, spelled
 * the way the operator spells them. Station names are the join key between the
 * timetable and the search index, and transcribing them by hand from anywhere
 * but the feed is how a route ends up matching nothing every night while
 * looking correctly configured.
 *
 * With no feed URL configured the scraper runs nothing at all, the same way the
 * ODPT scraper drops its Tokyo Metro routes without a key.
 */
export class JapanLocalGtfsScraper extends DownloadScraper {
  readonly name: string;
  readonly country = "japan";
  readonly routes: ScrapedRoute[] = [];
  readonly sourceId: OfficialSourceId;

  constructor(private readonly feedSource: JapanGtfsRailSource = KOTODEN_GTFS_RAIL) {
    super();
    this.name = feedSource.label;
    this.sourceId = feedSource.sourceId;
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    if (!japanGtfsFeedUrl(this.feedSource)) {
      console.log(
        `  japan: ${this.feedSource.urlEnvVar} not set; skipping ${this.feedSource.label}.`,
      );
      return [];
    }
    // runAll is called once per service day, so derive the pairs on the first
    // pass only and let the cached feed answer the rest.
    if (this.routes.length === 0) {
      const feed = await loadJapanGtfsFeed(this.feedSource);
      this.routes.push(...scrapeRoutePairs(summarizeGtfsRoutes(feed)));
      console.log(
        `  japan: ${this.feedSource.label} published ${this.routes.length} route(s): `
        + this.routes.map((route) => `${route.origin} → ${route.destination}`).join(", "),
      );
    }
    return super.runAll(date, options);
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const response = await searchJapanGtfsRail(this.feedSource, route.origin, route.destination, date);
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "",
      results: rowsOrThrow(response, this.feedSource.label, route, date),
    };
  }
}
