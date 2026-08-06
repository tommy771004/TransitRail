import { DownloadScraper } from "./kinds";
import type { ScrapedRoute, ScrapedRouteData } from "./types";
import { collectSeoulSubwayArtifact } from "../../src/server/seoulSubwayCsv";
import { collectIncheonSubwayArtifact } from "../../src/server/incheonSubwayCsv";
import { recordError } from "../../src/server/errorLog";
import type { OfficialSourceId } from "../../src/data/sourceRegistry";

/**
 * Korea is served entirely from the operators' own published timetable CSVs.
 *
 * Seoul Metro and Incheon Transit Corporation both publish full timetables on
 * data.go.kr, and those become compressed artifacts that search reads directly.
 * There are no per-route files: this scraper's job is to refresh the artifacts,
 * so {@link routes} is deliberately empty.
 *
 * Korail is absent. It blocks automated access to its journey search
 * ("CODE : -8003"), and the previous build answered that by serving nine
 * curated KTX timetables — 231 invented departures per route — under a Korail
 * label. Those files are gone. Until an official Korail feed or a permitted
 * scrape exists, KTX routes have no data and search says so.
 */
export class KoreaScraper extends DownloadScraper {
  readonly name = "Seoul Metro + Incheon Transit CSV";
  readonly country = "korea";
  readonly routes: ScrapedRoute[] = [];
  readonly sourceId: OfficialSourceId = "kr-seoul-metro-csv";
  private refreshPromise: Promise<void> | undefined;

  constructor(
    private readonly collectSeoul: () => Promise<unknown> = collectSeoulSubwayArtifact,
    private readonly collectIncheon: () => Promise<unknown> = collectIncheonSubwayArtifact,
  ) {
    super();
  }

  async scrape(route: ScrapedRoute): Promise<ScrapedRouteData> {
    throw new Error(`Korea has no per-route scrape: ${route.origin} → ${route.destination}`);
  }

  override async runAll(
    date: string,
    options: { keepDates?: string[] } = {},
  ): Promise<ScrapedRouteData[]> {
    // One instance is reused across the seven target dates. The Seoul file is
    // 32 MB, so download and compile it once. A failure keeps the previously
    // committed artifact; search never touches the network.
    this.refreshPromise ??= this.refreshArtifacts(date);
    await this.refreshPromise;
    return super.runAll(date, options);
  }

  private async refreshArtifacts(date: string): Promise<void> {
    await this.refreshOne("Seoul Metro", "data.go.kr 15098251", "SEOUL_SUBWAY_ARTIFACT_REFRESH_FAILED", date, this.collectSeoul);
    await this.refreshOne("Incheon Transit", "data.go.kr 15083751", "INCHEON_SUBWAY_ARTIFACT_REFRESH_FAILED", date, this.collectIncheon);
  }

  private async refreshOne(
    label: string,
    provider: string,
    errorCode: string,
    date: string,
    collect: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await collect();
    } catch (error) {
      console.warn(
        `  korea: ${label} timetable artifact refresh skipped: ${error instanceof Error ? error.message : error}`,
      );
      await recordError({
        severity: "warning",
        module: "scraper",
        operation: "korea-subway.artifact",
        errorCode,
        error,
        country: "korea",
        provider,
        context: { date },
      });
    }
  }
}
