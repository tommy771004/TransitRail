import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { syncScrapedMetadata } from "./scrapers/metadata";
import { syncMalaysiaStationCatalog } from "./scrapers/malaysia";

async function main() {
  const requestedCountry = process.argv[2];
  if (requestedCountry === "malaysia") {
    const malaysia = await syncMalaysiaStationCatalog();
    const directory = resolve("src/data/scraped/malaysia");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "metadata.json"), `${JSON.stringify({
      country: "malaysia",
      scraper: "data.gov.my historical-ridership station catalog",
      lastScraped: new Date().toISOString(),
      routeCount: 0,
      routes: [],
    }, null, 2)}\n`, "utf8");
    console.log(`Malaysia catalog updated: ${malaysia.stationCount} stations from ${malaysia.sourceCount} source(s); no timetable results created.`);
    return;
  }

  const { createTimetableScrapers, scraperDisplayNames } = await import("./scrapers/registry");
  const scrapers = createTimetableScrapers();
  const scraperByCountry = Object.fromEntries(scrapers.map((s) => [s.country, s]));
  const country = requestedCountry as string | undefined;
  const date = process.argv[3] || new Date().toISOString().split("T")[0];

  if (!country || !scraperByCountry[country]) {
    throw new Error(`Country must be one of: ${[...Object.keys(scraperByCountry), "malaysia"].join(", ")}`);
  }

  const scraper = scraperByCountry[country];
  const results = await scraper.runAll(date);
  syncScrapedMetadata(scraperDisplayNames([scraper]));

  const total = results.reduce((acc: number, route: { results: unknown[] }) => acc + route.results.length, 0);
  console.log(`${results.length} routes done, ${total} results saved`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
