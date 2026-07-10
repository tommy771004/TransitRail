import { JapanScraper } from "./japan";
import { KoreaScraper } from "./korea";
import { countryOptions } from "../../src/data/countries";
import { syncScrapedMetadata } from "./metadata";
import { syncMalaysiaStationCatalog } from "./malaysia";
import {
  BelgiumScraper,
  NorwayScraper,
  ChinaScraper,
  FranceScraper,
  GermanyScraper,
  HongKongScraper,
  SingaporeScraper,
  SwitzerlandScraper,
  ThailandScraper,
  UnitedKingdomScraper,
  UnitedStatesScraper,
} from "./metro";

export async function runAllScrapers(dates: string | string[]): Promise<void> {
  const dateList = Array.isArray(dates) ? dates : [dates];
  console.log(`\n=== Starting scrapers for ${dateList.join(", ")} ===\n`);

  const scrapers = [
    new JapanScraper(),
    new KoreaScraper(),
    new ChinaScraper(),
    new SingaporeScraper(),
    new ThailandScraper(),
    new HongKongScraper(),
    new UnitedKingdomScraper(),
    new UnitedStatesScraper(),
    new GermanyScraper(),
    new FranceScraper(),
    new BelgiumScraper(),
    new NorwayScraper(),
    new SwitzerlandScraper(),
  ];
  try {
    const malaysia = await syncMalaysiaStationCatalog();
    console.log(`  Malaysia station catalog: ${malaysia.stationCount} stations from ${malaysia.sourceCount} official daily source(s)`);
  } catch (error) {
    // Keep the last committed catalog when data.gov.my is temporarily unavailable;
    // this must not block timetable refreshes for countries with schedule feeds.
    console.warn(`  Malaysia station catalog refresh failed: ${error instanceof Error ? error.message : error}`);
  }
  const scraperNames = Object.fromEntries([
    ...scrapers.map((scraper) => [scraper.country, scraper.name]),
    ["malaysia", "data.gov.my historical-ridership station catalog"],
  ]);
  const automatedCountries = new Set<string>([...scrapers.map((scraper) => scraper.country), "malaysia"]);
  const dataOnlyCountries = countryOptions.filter((country) => !automatedCountries.has(country));

  if (dataOnlyCountries.length > 0) {
    console.warn(`  Countries without scheduled scraper: ${dataOnlyCountries.join(", ")}`);
  }

  for (const date of dateList) {
    console.log(`\n=== Scrape date ${date} ===`);

    for (const scraper of scrapers) {
      console.log(`\n--- ${scraper.name} (${scraper.country}) ---`);
      console.log(`  Routes to scrape: ${scraper.routes.length}`);

      const results = await scraper.runAll(date, { keepDates: dateList });
      scraper.saveMetadata(results);

      const total = results.reduce((acc, r) => acc + r.results.length, 0);
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
