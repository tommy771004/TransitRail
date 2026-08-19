import { configuredCountryOptions, providerDateValue } from "../../src/data/countries";
import { automatedScrapeCountries, getCountryCapability } from "../../src/data/countryCapability";
import { buildCountryMetadata } from "./artifactBuilder";
import { syncMalaysiaStationCatalog } from "./malaysia";
import { createTimetableScrapers, scraperDisplayNames } from "./registry";
import { recordError } from "../../src/server/errorLog";
import type { ScrapeRunReport } from "./base";

export interface RunAllScrapersOptions {
  /**
   * Run only the markets whose source can answer for today and no other date.
   * They must refresh every night; everything else is collected on the slower
   * full-scrape cadence.
   */
  onlyLiveOnly?: boolean;
}

export async function runAllScrapers(
  dates: string | string[],
  options: RunAllScrapersOptions = {},
): Promise<void> {
  const dateList = Array.isArray(dates) ? dates : [dates];
  console.log(`\n=== Starting scrapers for ${dateList.join(", ")} ===\n`);

  const scrapers = createTimetableScrapers()
    .filter((scraper) => !options.onlyLiveOnly || getCountryCapability(scraper.country).liveOnly);
  if (options.onlyLiveOnly) {
    console.log(`  Live-only pass: ${scrapers.map((scraper) => scraper.country).join(", ") || "no markets"}`);
  }
  try {
    const malaysia = await syncMalaysiaStationCatalog();
    console.log(`  Malaysia station catalog: ${malaysia.stationCount} stations from ${malaysia.sourceCount} official daily source(s)`);
  } catch (error) {
    // Keep the last committed catalog when data.gov.my is temporarily unavailable;
    // this must not block timetable refreshes for countries with schedule feeds.
    console.warn(`  Malaysia station catalog refresh failed: ${error instanceof Error ? error.message : error}`);
    await recordError({
      severity: "warning",
      module: "scraper",
      operation: "malaysia.catalog-sync",
      errorCode: "MALAYSIA_CATALOG_FALLBACK",
      error,
      country: "malaysia",
      provider: "data.gov.my",
    });
  }

  const scraperNames = scraperDisplayNames(scrapers);
  const automated = new Set(automatedScrapeCountries());
  const dataOnlyCountries = configuredCountryOptions.filter((country) => !automated.has(country));

  if (dataOnlyCountries.length > 0) {
    console.warn(`  Countries with no registered official source: ${dataOnlyCountries.join(", ")}`);
  }

  // One report per country, merged across its scrapers and dates, so the
  // metadata can say what a run achieved rather than only what survived on disk.
  const reports: Record<string, ScrapeRunReport | undefined> = {};

  for (const date of dateList) {
    console.log(`\n=== Scrape date ${date} ===`);

    for (const scraper of scrapers) {
      const capability = getCountryCapability(scraper.country);
      const today = providerDateValue(scraper.country);
      if (capability.liveOnly && date !== today) {
        console.log(`  ${scraper.country}: skip ${date}; live source is limited to ${today}.`);
        continue;
      }
      console.log(`\n--- ${scraper.name} (${scraper.country}) ---`);
      console.log(`  Routes to scrape: ${scraper.routes.length}`);

      let results;
      const startedAt = performance.now();
      try {
        const keepDates = capability.liveOnly ? [today] : dateList;
        results = await scraper.runAll(date, { keepDates });
      } catch (error) {
        await recordError({
          severity: "critical",
          module: "scraper",
          operation: "country.run",
          errorCode: "SCRAPER_COUNTRY_RUN_FAILED",
          error,
          country: scraper.country,
          provider: scraper.name,
          context: { date, routeCount: scraper.routes.length },
        });
        console.error(`  ${scraper.country} scraper aborted:`, error instanceof Error ? error.message : error);
        continue;
      }

      const report = scraper.report();
      if (report) {
        const previous = reports[scraper.country];
        reports[scraper.country] = previous
          ? { ...previous, outcomes: [...previous.outcomes, ...report.outcomes] }
          : report;
      }

      const total = results.reduce((acc: number, r: { results: unknown[] }) => acc + r.results.length, 0);
      const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      console.log(`  Done: ${results.length}/${scraper.routes.length} routes, ${total} results saved in ${elapsedSeconds}s`);
    }
  }

  const metadata = buildCountryMetadata({ reports, scraperNames });
  console.log("\n--- Metadata ---");
  for (const summary of metadata) {
    const failed = summary.failedRoutes.length;
    const success = summary.successRate === null
      ? "not measured"
      : `${(summary.successRate * 100).toFixed(0)}%`;
    console.log(
      `  ${summary.country}: ${summary.routeCount} routes, ${summary.recordCount} rows`
      + `, success ${success}${failed ? ` (${failed} failed)` : ""}`,
    );
  }

  console.log(`\n=== All scrapers finished at ${new Date().toISOString()} ===\n`);
}
