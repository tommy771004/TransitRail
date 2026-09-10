import { DownloadScraper } from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { addDateValueDays } from "../../src/data/countries";
import { createKorailTimetableSource, korailResults, type KorailDocument } from "../lib/korailTimetable";

/** Public operator downloads; no journey-search automation or API key. */
export class KorailTimetableScraper extends DownloadScraper {
  readonly name = "Korail official timetable XLSX";
  readonly country = "korea";
  readonly sourceId = "kr-korail-timetable-xlsx";
  readonly routes: ScrapedRoute[] = [];
  private slices = new Map<string, ScrapedRouteData>();
  private documents = new Map<string, NonNullable<ScrapedRouteData["sourceDocuments"]>[number]>();

  constructor(private readonly source: { load(date: string): Promise<KorailDocument[]> } = createKorailTimetableSource()) {
    super();
  }

  override async runAll(date: string, options: { keepDates?: string[] } = {}): Promise<ScrapedRouteData[]> {
    // Finish validating both documents before BaseScraper writes any route.
    const current = await this.source.load(date);
    const previousDate = addDateValueDays(date, -1);
    const previous = await this.source.load(previousDate);
    for (const { runs: _runs, family: _family, ...document } of [...previous, ...current]) {
      this.documents.set(document.url, document);
    }
    const results = [
      ...current.flatMap((document) => korailResults(document, date)),
      ...previous.flatMap((document) => korailResults(document, previousDate, date)),
    ];
    this.slices.clear();
    for (const result of results) {
      const key = JSON.stringify([result.origin, result.destination]);
      let slice = this.slices.get(key);
      if (!slice) {
        slice = { origin: result.origin, destination: result.destination, date,
          scrapedAt: new Date().toISOString(), source: this.name,
          sourceDocuments: [...this.documents.values()], results: [] };
        this.slices.set(key, slice);
      }
      slice.results.push(result);
    }
    this.routes.splice(0, this.routes.length, ...[...this.slices.values()].map(({ origin, destination }) => ({ origin, destination })));
    return super.runAll(date, options);
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const slice = this.slices.get(JSON.stringify([route.origin, route.destination]));
    if (!slice || slice.date !== date) throw new Error(`Korail date was not loaded: ${date}`);
    return slice;
  }
}
