import { syncScrapedMetadata } from "./scrapers/metadata";

const summaries = syncScrapedMetadata();
console.log("Scraped metadata synced:");
for (const summary of summaries) {
  console.log(`  ${summary.country}: ${summary.routeCount} routes, ${summary.resultCount} results`);
}
