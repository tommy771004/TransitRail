import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { BaseScraper } from "./base";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import type { SearchResponse } from "../../src/types";
import type { Country } from "../../src/types";
import { getCountryCapability } from "../../src/data/countryCapability";
import { providerDateValue } from "../../src/data/countries";
import { isCompleteTimetableSnapshot, normalizeTimetableSource } from "../../src/data/timetableAuthenticity";
// Implementation lives in the pure timetable-day module under test.
import { canonicalDay } from "../../src/data/scraped/timetableDay";
import { stationSearchKey } from "../../src/data/stationKey";
import { recordError } from "../../src/server/errorLog";
export { canonicalDay };

const DATA_DIR = resolve("src/data/scraped");

type ProviderSearchResponse = {
  status: number;
  body: SearchResponse & { error?: string };
};

export class SnapshotScraper extends BaseScraper {
  // Reads curated JSON (and ProviderBackedScraper calls a JSON API via fetch);
  // neither drives a browser, so no Chromium launch.
  protected readonly usesBrowser = false;

  constructor(
    readonly name: string,
    readonly country: Country,
    readonly routes: ScrapedRoute[],
  ) {
    super();
  }

  async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const snapshot = this.loadSnapshot(route);
    return {
      ...snapshot,
      date,
      scrapedAt: new Date().toISOString(),
      source: `${this.name} curated snapshot`,
      provenance: snapshot.provenance === "llm-advisory" ? "llm-advisory" : "curated",
      authenticity: "indicative",
      truthMode: "indicative",
      sourceServiceDay: undefined,
      sourceIssue: undefined,
    };
  }

  protected loadSnapshot(route: ScrapedRoute): ScrapedRouteData {
    const dir = resolve(DATA_DIR, this.country);
    if (!existsSync(dir)) {
      throw new Error(`No scraped data directory found for ${this.country}`);
    }

    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      try {
        const fact = normalizeTimetableSource(
          JSON.parse(readFileSync(resolve(dir, file), "utf-8")) as unknown,
          undefined,
          { expectedCountry: this.country },
        );
        if (!fact.snapshot || fact.truthMode === "unusable" || !isCompleteTimetableSnapshot(fact.snapshot)) continue;
        const data = {
          ...fact.snapshot,
          provenance: fact.provenance === "unknown" ? undefined : fact.provenance,
          authenticity: fact.authenticity,
          truthMode: fact.truthMode,
          sourceServiceDay: fact.sourceServiceDay,
          sourceIssue: fact.issue,
        };
        if (stationSearchKey(data.origin) === stationSearchKey(route.origin) && stationSearchKey(data.destination) === stationSearchKey(route.destination)) {
          return { ...data, results: canonicalDay(data.results) };
        }
      } catch (error) {
        console.warn(`[snapshot] Failed to parse ${this.country}/${file}:`, error);
        continue;
      }
    }

    throw new Error(`No snapshot found for ${this.country}: ${route.origin} → ${route.destination}`);
  }
}

export class ProviderBackedScraper extends SnapshotScraper {
  constructor(
    name: string,
    country: Country,
    routes: ScrapedRoute[],
    private readonly providerSearch: (
      origin: string,
      destination: string,
      date: string,
    ) => Promise<ProviderSearchResponse>,
  ) {
    super(name, country, routes);
  }

  override async scrape(route: ScrapedRoute, date: string): Promise<ScrapedRouteData> {
    const capability = getCountryCapability(this.country);
    if (capability.liveOnly && date !== providerDateValue(this.country)) {
      return this.snapshotFallback(route, date);
    }

    let response: ProviderSearchResponse | undefined;
    let providerError: unknown;
    try {
      response = await this.providerSearch(route.origin, route.destination, date);
    } catch (error) {
      providerError = error;
    }
    const responseBody = response?.body;
    const providerResults = Array.isArray(responseBody?.results) ? responseBody.results : [];
    if (response?.status >= 200 && response.status < 300 && providerResults.length > 0) {
      const rawProviderFact = normalizeTimetableSource({
        origin: route.origin,
        destination: route.destination,
        source: typeof responseBody.source === "string" ? responseBody.source : "",
        results: providerResults,
      }, undefined, { expectedCountry: this.country });
      if (rawProviderFact.issue === "malformed") {
        await recordError({
          severity: "warning",
          module: "scraper",
          operation: "provider.fallback",
          errorCode: "PROVIDER_MALFORMED_RESPONSE",
          message: "Provider returned malformed timetable rows.",
          country: this.country,
          provider: this.name,
          httpStatus: response.status,
          context: { origin: route.origin, destination: route.destination, date },
        });
        return this.snapshotFallback(route, date);
      }
      const providerRoute = this.withResultDates({
        origin: route.origin,
        destination: route.destination,
        date,
        scrapedAt: new Date().toISOString(),
        source: typeof responseBody.source === "string" ? responseBody.source : "",
        results: providerResults,
      });
      const fact = normalizeTimetableSource(providerRoute, date, {
        realtimeTodayOnly: true,
        today: providerDateValue(this.country),
        expectedCountry: this.country,
      });
      if (fact.snapshot && fact.truthMode !== "unusable" && fact.truthMode !== "stale") {
        return {
          ...providerRoute,
          results: fact.snapshot.results,
          provenance: fact.provenance === "unknown" ? undefined : fact.provenance,
          authenticity: fact.authenticity,
          truthMode: fact.truthMode,
          sourceServiceDay: fact.sourceServiceDay,
          sourceIssue: fact.issue,
        };
      }
    }

    await recordError({
      severity: "warning",
      module: "scraper",
      operation: "provider.fallback",
      errorCode: typeof responseBody?.error === "string" ? responseBody.error : "PROVIDER_FALLBACK",
      error: providerError,
      message: typeof responseBody?.message === "string"
        ? responseBody.message
        : typeof responseBody?.error === "string" ? responseBody.error : `Provider returned HTTP ${response?.status}.`,
      country: this.country,
      provider: this.name,
      httpStatus: response?.status,
      context: { origin: route.origin, destination: route.destination, date },
    });

    return this.snapshotFallback(route, date);
  }

  private snapshotFallback(route: ScrapedRoute, date: string): ScrapedRouteData {
    const snapshot = this.loadSnapshot(route);
    return {
      ...snapshot,
      date,
      scrapedAt: new Date().toISOString(),
      // Provider diagnostics are stored server-side in error_log, not exposed
      // through timetable source metadata rendered by the app.
      source: `${this.name} curated snapshot fallback`,
      provenance: snapshot.provenance === "llm-advisory" ? "llm-advisory" : "curated",
      authenticity: "indicative",
      truthMode: "indicative",
      sourceServiceDay: undefined,
      sourceIssue: undefined,
      // A curated fallback is never a live arrival. Clear a legacy realtime
      // flag so the shared authenticity oracle cannot overstate it.
      results: snapshot.results.map((result) => ({
        ...result,
        realtime: false,
      })),
    };
  }
}
