import "dotenv/config";
import { buildCountryMetadata } from "./scrapers/artifactBuilder";
import { syncMalaysiaStationCatalog } from "./scrapers/malaysia";
import { getCountryCapability } from "../src/data/countryCapability";
import { addDateValueDays, providerDateValue, SCRAPE_WINDOW_DAYS } from "../src/data/countries";
import type { Country } from "../src/types";

async function main() {
  const requestedCountry = process.argv[2];
  if (requestedCountry === "malaysia") {
    const malaysia = await syncMalaysiaStationCatalog();
    console.log(`Malaysia station catalog updated: ${malaysia.stationCount} stations from ${malaysia.sourceCount} source(s).`);
  }

  const { createTimetableScrapers, scraperDisplayNames } = await import("./scrapers/registry");
  const scrapers = createTimetableScrapers();
  // A country may have several scrapers (Japan reads ODPT and JR Central), so
  // group rather than index — indexing silently ran only the last one.
  const scraperByCountry = scrapers.reduce<Record<string, typeof scrapers>>((groups, scraper) => {
    groups[scraper.country] = [...(groups[scraper.country] || []), scraper];
    return groups;
  }, {});
  const country = requestedCountry as Country | undefined;

  if (!country || !scraperByCountry[country]) {
    throw new Error(`Country must be one of: ${Object.keys(scraperByCountry).join(", ")}`);
  }

  // The same window the nightly job uses, for the same reason: `keepDates` is
  // what prunes date slices outside it, so a run that passes a single date
  // leaves every older slice on disk forever. London accumulated a fortnight
  // that way, and the stale half kept a `sourceMeta` stamp naming a source
  // that had not produced it.
  const startDate = process.argv[3] || providerDateValue(country);
  const capability = getCountryCapability(country);
  const today = providerDateValue(country);
  const dates = capability.liveOnly
    ? [today]
    : Array.from({ length: SCRAPE_WINDOW_DAYS }, (_, index) => addDateValueDays(startDate, index));

  console.log(`Scrape dates: ${dates.join(", ")}`);

  const countryScrapers = scraperByCountry[country];
  const results = [];
  const outcomes = [];
  for (const date of dates) {
    if (dates.length > 1) console.log(`\n=== Scrape date ${date} ===`);
    for (const scraper of countryScrapers) {
      results.push(...await scraper.runAll(date, { keepDates: dates }));
      outcomes.push(...(scraper.report()?.outcomes || []));
    }
  }
  buildCountryMetadata({
    reports: {
      [country]: { country: countryScrapers[0].country, scraper: country, date: dates.at(-1)!, outcomes },
    },
    scraperNames: scraperDisplayNames(countryScrapers),
    countries: [country],
  });

  const total = results.reduce((acc: number, route: { results: unknown[] }) => acc + route.results.length, 0);
  console.log(`${results.length} routes done, ${total} results saved`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
