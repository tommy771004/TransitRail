import { SnapshotScraper } from "./snapshot";
import { koreaRoutes } from "./routes";

/**
 * Korail (korail.com global + the legacy letskorail.com) actively blocks
 * automated browsers as "macro activity" (CODE : -8003), so a live scrape never
 * succeeds in the daily GitHub Actions job — every route fell back to synthetic
 * data. Korea is therefore served from a curated snapshot, like SG/TH/CN/DE/FR:
 * the timetable is authored in scripts/seed-curated-snapshots.ts and this
 * scraper just re-stamps that curated file across the scrape window.
 */
export class KoreaScraper extends SnapshotScraper {
  constructor() {
    super("Korail", "korea", koreaRoutes);
  }
}
