import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { buildCountryMetadata } from "./scrapers/artifactBuilder";
import { syncMalaysiaStationCatalog } from "./scrapers/malaysia";

async function main() {
  const requestedCountry = process.argv[2];
  if (requestedCountry === "malaysia") {
    const malaysia = await syncMalaysiaStationCatalog();
    const directory = resolve("src/data/scraped/malaysia");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "metadata.json"), `${JSON.stringify({
      country: "malaysia",
      provider: "Ministry of Transport Malaysia (data.gov.my)",
      source: "data.gov.my rail ridership station catalog",
      builtAt: new Date().toISOString(),
      routeCount: 0,
      recordCount: 0,
      routes: [],
    }, null, 2)}\n`, "utf8");
    console.log(`Malaysia catalog updated: ${malaysia.stationCount} stations from ${malaysia.sourceCount} source(s); no timetable results created.`);
    return;
  }

  const { createTimetableScrapers, scraperDisplayNames } = await import("./scrapers/registry");
  const scrapers = createTimetableScrapers();
  // A country may have several scrapers (Japan reads ODPT and JR Central), so
  // group rather than index — indexing silently ran only the last one.
  const scraperByCountry = scrapers.reduce<Record<string, typeof scrapers>>((groups, scraper) => {
    groups[scraper.country] = [...(groups[scraper.country] || []), scraper];
    return groups;
  }, {});
  const country = requestedCountry as string | undefined;
  const date = process.argv[3] || new Date().toISOString().split("T")[0];

  if (!country || !scraperByCountry[country]) {
    throw new Error(`Country must be one of: ${[...Object.keys(scraperByCountry), "malaysia"].join(", ")}`);
  }

  const countryScrapers = scraperByCountry[country];
  const results = [];
  const outcomes = [];
  for (const scraper of countryScrapers) {
    results.push(...await scraper.runAll(date));
    outcomes.push(...(scraper.report()?.outcomes || []));
  }
  buildCountryMetadata({
    reports: {
      [country]: { country: countryScrapers[0].country, scraper: country, date, outcomes },
    },
    scraperNames: scraperDisplayNames(countryScrapers),
  });

  const total = results.reduce((acc: number, route: { results: unknown[] }) => acc + route.results.length, 0);
  console.log(`${results.length} routes done, ${total} results saved`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
