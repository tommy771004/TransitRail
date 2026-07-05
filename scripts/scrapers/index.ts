import { JapanScraper } from "./japan";
import { KoreaScraper } from "./korea";

export async function runAllScrapers(date: string): Promise<void> {
  console.log(`\n=== Starting scrapers for ${date} ===\n`);

  const scrapers = [
    new JapanScraper(),
    new KoreaScraper(),
  ];

  for (const scraper of scrapers) {
    console.log(`\n--- ${scraper.name} (${scraper.country}) ---`);
    console.log(`  Routes to scrape: ${scraper.routes.length}`);

    const results = await scraper.runAll(date);
    scraper.saveMetadata(results);

    const total = results.reduce((acc, r) => acc + r.results.length, 0);
    console.log(`  Done: ${results.length}/${scraper.routes.length} routes, ${total} results saved`);
  }

  console.log(`\n=== All scrapers finished at ${new Date().toISOString()} ===\n`);
}
