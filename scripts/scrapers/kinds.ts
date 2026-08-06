/**
 * The five ways TransitRail is allowed to obtain a timetable, as classes.
 *
 * Each kind fixes the artifact family it may claim in the source register, so
 * "how we got this" and "what we say we got" are one decision made in one
 * place. A scraper that downloads a GTFS archive cannot describe its output as
 * an official HTML page, and a scraper that only ever learns a headway cannot
 * describe its output as a full timetable — {@link BaseScraper} checks both
 * against the register before the run starts.
 *
 * There is deliberately no kind for "an aggregator", "a wiki", or "a
 * reasonable estimate". A route with no official source is left with no
 * departures, and search says so.
 */
import { BaseScraper } from "./base";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { Country } from "../../src/types";
import {
  findOfficialSource,
  type OfficialSourceId,
  type SourceCompleteness,
  type SourceType,
} from "../../src/data/sourceRegistry";

/**
 * **Tier A.** An official machine-readable feed: GTFS, GTFS-RT, CSV, XML, JSON,
 * or a published download. The highest-confidence kind, because the operator
 * publishes the artifact specifically to be consumed by software.
 */
export abstract class DownloadScraper extends BaseScraper {
  protected readonly permittedSourceTypes = [
    "official-gtfs",
    "official-gtfs-rt",
    "official-csv",
    "official-xml",
    "official-json",
    "official-download",
  ] as const satisfies readonly SourceType[];

  protected readonly usesBrowser = false;
}

/**
 * **Tier B.** An official public query page driven with Playwright — a journey
 * planner, train search, or timetable search. The data is the operator's own;
 * only the retrieval is indirect.
 */
export abstract class BrowserScraper extends BaseScraper {
  protected readonly permittedSourceTypes = ["official-browser"] as const satisfies readonly SourceType[];

  protected readonly usesBrowser = true;
}

/** **Tier C.** An official HTML page fetched and parsed without a browser. */
export abstract class HtmlScraper extends BaseScraper {
  protected readonly permittedSourceTypes = ["official-html"] as const satisfies readonly SourceType[];

  protected readonly usesBrowser = false;

  /** Fetch the page as text. Overridable so parsing can be tested offline. */
  protected async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { "user-agent": "TransitRail/1.0 (+https://github.com/tommy771004/TransitRail)" },
    });
    if (!response.ok) throw new Error(`${url} responded HTTP ${response.status}`);
    return response.text();
  }
}

/** **Tier C.** An official PDF timetable fetched and parsed. */
export abstract class PdfScraper extends BaseScraper {
  protected readonly permittedSourceTypes = ["official-pdf"] as const satisfies readonly SourceType[];

  protected readonly usesBrowser = false;

  protected async fetchPdf(url: string): Promise<Uint8Array> {
    const response = await fetch(url, {
      headers: { "user-agent": "TransitRail/1.0 (+https://github.com/tommy771004/TransitRail)" },
    });
    if (!response.ok) throw new Error(`${url} responded HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

/**
 * **Tier D.** An operator that publishes first train, last train and headway,
 * and nothing else — most metro networks outside the open-data world.
 *
 * The class exists to make the corresponding restraint structural rather than
 * remembered: it writes a route file with **no departure rows at all**, and its
 * registered source may not claim `full-timetable`. Expanding "every 4 minutes
 * from 05:30" into a list of departures is precisely the synthetic timetable
 * this refactor removed, and it is not available from here.
 *
 * What the operator does publish goes to the service-day artifact via
 * {@link collectServiceDay}, which is what a passenger actually gets: when
 * service starts, when it ends, and how often trains run.
 */
export abstract class FrequencyScraper extends BaseScraper {
  protected readonly permittedSourceTypes = [
    "official-json",
    "official-html",
    "official-pdf",
    "official-csv",
  ] as const satisfies readonly SourceType[];

  protected readonly usesBrowser = false;

  /**
   * Read first/last/frequency from the official source and persist it as this
   * country's service-day artifact. Throwing leaves the previous artifact in
   * place, which is the same "keep the last good version" rule route files use.
   */
  protected abstract collectServiceDay(routes: readonly ScrapedRoute[], date: string): Promise<void>;

  protected completenessFor(route: ScrapedRoute): SourceCompleteness {
    const declared = findOfficialSource(this.sourceIdFor(route))?.maxCompleteness;
    return declared === "full-timetable" ? "frequency-only" : declared ?? "service-hours";
  }

  /** A frequency source knows of the route, and knows no departure times. */
  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "",
      results: [],
    };
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    const results = await super.runAll(date, options);
    await this.collectServiceDay(this.routes, date);
    return results;
  }
}

/**
 * A source that answers "now" and nothing else — a next-train feed.
 *
 * Mixed into a {@link DownloadScraper} rather than being its own kind, because
 * the artifact is the same official JSON; what differs is the span it can speak
 * for. Asked about any other date it returns an empty day rather than repeating
 * today's arrivals under tomorrow's heading.
 */
function isLiveOnlySource(sourceId: OfficialSourceId): boolean {
  return findOfficialSource(sourceId)?.liveOnly === true;
}

/**
 * A route/day this source cannot speak for.
 *
 * Carries the route identity and no departures, so the day reads as "we do not
 * know" rather than as a timetable somebody could act on. The service-day
 * artifact is what carries the operator's real answer for such a date.
 */
function unknownServiceDay(route: ScrapedRoute, date: string): ScrapedRouteData {
  return {
    origin: route.origin,
    destination: route.destination,
    date,
    scrapedAt: new Date().toISOString(),
    source: "",
    results: [],
  };
}

/** Shape a country adapter hands back from a live query. */
interface ProviderQueryResponse {
  status: number;
  body: { results?: unknown[]; error?: string; message?: string; source?: string };
}

type ProviderQuery = (
  origin: string,
  destination: string,
  date: string,
) => Promise<ProviderQueryResponse>;

/**
 * A {@link DownloadScraper} backed by one official query function.
 *
 * The failure branch is the point: a non-2xx response, an empty result set, or
 * a thrown error all become a thrown error here. {@link BaseScraper} then
 * leaves the route's previous file exactly as it was. The predecessor of this
 * class answered the same three cases by writing a curated snapshot over the
 * top, which is how a provider outage came to look like a successful scrape.
 */
export abstract class OfficialFeedScraper extends DownloadScraper {
  constructor(
    readonly name: string,
    readonly country: Country,
    readonly routes: ScrapedRoute[],
    readonly sourceId: OfficialSourceId,
    private readonly query: ProviderQuery,
  ) {
    super();
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    if (isLiveOnlySource(this.sourceIdFor(route)) && !this.isProviderToday(date)) {
      return unknownServiceDay(route, date);
    }

    const response = await this.query(route.origin, route.destination, date);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        response.body?.message || response.body?.error || `${this.name} responded HTTP ${response.status}`,
      );
    }
    const results = Array.isArray(response.body?.results) ? response.body.results : [];
    if (results.length === 0) {
      throw new Error(`${this.name} returned no departures for ${route.origin} → ${route.destination} on ${date}`);
    }
    return {
      origin: route.origin,
      destination: route.destination,
      date,
      scrapedAt: new Date().toISOString(),
      source: "",
      results: results as ScrapedRouteData["results"],
    };
  }

  /** Overridden by live-only markets that need their own local calendar day. */
  protected isProviderToday(_date: string): boolean {
    return true;
  }
}
