import "dotenv/config";
import { JapanScraper } from "./scrapers/japan";
import { KoreaScraper } from "./scrapers/korea";
import { syncScrapedMetadata } from "./scrapers/metadata";
import {
  ChinaScraper,
  FranceScraper,
  GermanyScraper,
  HongKongScraper,
  SingaporeScraper,
  SwitzerlandScraper,
  ThailandScraper,
  UnitedKingdomScraper,
  UnitedStatesScraper,
} from "./scrapers/metro";

const scraperByCountry = {
  japan: new JapanScraper(),
  korea: new KoreaScraper(),
  china: new ChinaScraper(),
  singapore: new SingaporeScraper(),
  thailand: new ThailandScraper(),
  hong_kong: new HongKongScraper(),
  united_kingdom: new UnitedKingdomScraper(),
  united_states: new UnitedStatesScraper(),
  germany: new GermanyScraper(),
  france: new FranceScraper(),
  switzerland: new SwitzerlandScraper(),
};

async function main() {
  const country = process.argv[2] as keyof typeof scraperByCountry | undefined;
  const date = process.argv[3] || new Date().toISOString().split("T")[0];

  if (!country || !scraperByCountry[country]) {
    throw new Error(`Country must be one of: ${Object.keys(scraperByCountry).join(", ")}`);
  }

  const scraper = scraperByCountry[country];
  const results = await scraper.runAll(date);
  syncScrapedMetadata({ [scraper.country]: scraper.name });

  const total = results.reduce((acc, route) => acc + route.results.length, 0);
  console.log(`${results.length} routes done, ${total} results saved`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
