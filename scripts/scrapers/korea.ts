import { SnapshotScraper } from "./snapshot";
import { koreaRoutes } from "./routes";
import type { ScrapedRouteData } from "./types";
import { collectSeoulSubwayArtifact } from "../../src/server/seoulSubwayCsv";
import { recordError } from "../../src/server/errorLog";

/**
 * Korail (korail.com global + the legacy letskorail.com) actively blocks
 * automated browsers as "macro activity" (CODE : -8003), so a live scrape never
 * succeeds in the daily GitHub Actions job — every route fell back to synthetic
 * data. Korea is therefore served from a curated snapshot, like SG/TH/CN/DE/FR:
 * the timetable is authored in scripts/seed-curated-snapshots.ts and this
 * scraper just re-stamps that curated file across the scrape window.
 */
export class KoreaScraper extends SnapshotScraper {
  private refreshPromise: Promise<void> | undefined;

  constructor(
    private readonly collectSeoulArtifact: () => Promise<unknown> = collectSeoulSubwayArtifact,
  ) {
    super("Korail", "korea", koreaRoutes);
  }

  override async runAll(
    date: string,
    options: { keepDates?: string[] } = {},
  ): Promise<ScrapedRouteData[]> {
    // One KoreaScraper instance is reused for all seven target dates. Download
    // and compile the 32 MB official Seoul file once, while KTX snapshots keep
    // their existing per-date behavior. Search never reaches this network path.
    this.refreshPromise ??= this.collectSeoulArtifact()
      .then(() => undefined)
      .catch(async (error) => {
        console.warn(
          `  korea: Seoul timetable artifact refresh skipped: ${error instanceof Error ? error.message : error}`,
        );
        await recordError({
          severity: "warning",
          module: "scraper",
          operation: "seoul-subway.artifact",
          errorCode: "SEOUL_SUBWAY_ARTIFACT_REFRESH_FAILED",
          error,
          country: "korea",
          provider: "data.go.kr 15098251",
          context: { date },
        });
      });
    await this.refreshPromise;
    return super.runAll(date, options);
  }
}
