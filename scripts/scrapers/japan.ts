import { DownloadScraper, HtmlScraper } from "./kinds";
import { japanJrCentralRoutes } from "./routes";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { odptRoutes } from "../../src/data/odptRoutes";
import { searchOdptTimetable } from "../../src/server/odptTimetable";
import { searchJrCentralTimetable } from "../../src/server/jrCentralTimetable";
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
