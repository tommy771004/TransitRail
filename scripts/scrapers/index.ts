import { countryOptions } from "../../src/data/countries";
import { automatedScrapeCountries } from "../../src/data/countryCapability";
import { syncScrapedMetadata } from "./metadata";
import { syncMalaysiaStationCatalog } from "./malaysia";
import { createTimetableScrapers, scraperDisplayNames } from "./registry";
import { recordError } from "../../src/server/errorLog";

export async function runAllScrapers(dates: string | string[]): Promise<void> {
  const dateList = Array.isArray(dates) ? dates : [dates];
  console.log(`\n=== Starting scrapers for ${dateList.join(", ")} ===\n`);

  const scrapers = createTimetableScrapers();
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
  const dataOnlyCountries = countryOptions.filter((country) => !automated.has(country));

  if (dataOnlyCountries.length > 0) {
    console.warn(`  Countries without scheduled scraper: ${dataOnlyCountries.join(", ")}`);
  }

  for (const date of dateList) {
    console.log(`\n=== Scrape date ${date} ===`);

    for (const scraper of scrapers) {
      console.log(`\n--- ${scraper.name} (${scraper.country}) ---`);
      console.log(`  Routes to scrape: ${scraper.routes.length}`);

      let results;
      try {
        results = await scraper.runAll(date, { keepDates: dateList });
        scraper.saveMetadata(results);
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

      const total = results.reduce((acc: number, r: { results: unknown[] }) => acc + r.results.length, 0);
      console.log(`  Done: ${results.length}/${scraper.routes.length} routes, ${total} results saved`);
    }
  }

  const metadata = syncScrapedMetadata(scraperNames);
  console.log("\n--- Metadata sync ---");
  for (const summary of metadata) {
    console.log(`  ${summary.country}: ${summary.routeCount} routes, ${summary.resultCount} results`);
  }

  console.log(`\n=== All scrapers finished at ${new Date().toISOString()} ===\n`);
}
