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
  /**
   * How many countries may collect at the same time. See
   * {@link DEFAULT_COUNTRY_CONCURRENCY}.
   */
  countryConcurrency?: number;
}

/**
 * How many countries collect at once.
 *
 * Nearly all of a full pass is spent waiting, not computing: London sleeps
 * against its own rate limiter, Boston waits on browser navigation, JR Central
 * waits on a remote query. Collecting one country at a time made the run cost
 * the sum of those waits when each market is a different provider with its own
 * limit, so the waits can overlap for free. What must NOT overlap is two
 * scrapers of one country — Japan alone has three — because they share the
 * country's report and its data directory, so a country stays a single serial
 * unit and only whole countries run against each other.
 *
 * The cap exists for memory, not politeness. A parsed GTFS feed is the large
 * object here — Switzerland's measures 2.7 GB resident while it collects — and a
 * browser market additionally holds a Chromium. Raising the cap past the point
 * where the slowest single country decides the wall clock buys nothing and only
 * stacks more of those peaks on one runner: with the current markets a full pass
 * is bounded by London at ~10 minutes either way, so three is chosen over four
 * for the headroom rather than for any measured gain.
 */
export const DEFAULT_COUNTRY_CONCURRENCY = 3;

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
  // Only that country's own task ever writes its entry, which is what keeps the
  // merge below safe once countries overlap.
  const reports: Record<string, ScrapeRunReport | undefined> = {};

  // Group by country in registry order. The country, not the scraper, is the
  // unit of work: Japan's three scrapers stay serial with each other.
  const byCountry = new Map<string, typeof scrapers>();
  for (const scraper of scrapers) {
    byCountry.set(scraper.country, [...(byCountry.get(scraper.country) || []), scraper]);
  }
  const countries = [...byCountry.entries()];

  // Every scraper collects the whole window before the next one starts, so a
  // browser market launches one Chromium rather than one per service day, and a
  // scraper that parses a large feed can hold it across all of its dates.
  const collectCountry = async (countryScrapers: typeof scrapers) => {
    for (const scraper of countryScrapers) {
      const capability = getCountryCapability(scraper.country);
      const today = providerDateValue(scraper.country);
      const label = `${scraper.country}/${scraper.name}`;
      console.log(`\n--- ${scraper.name} (${scraper.country}) ---`);
      console.log(`  ${label}: ${scraper.routes.length} route(s) over ${dateList.length} date(s)`);

      for (const date of dateList) {
        if (capability.liveOnly && date !== today) {
          console.log(`  ${scraper.country}: skip ${date}; live source is limited to ${today}.`);
          continue;
        }

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

        // `report()` returns only the most recent `runAll`, so read it here
        // rather than after the date loop.
        const report = scraper.report();
        if (report) {
          const previous = reports[scraper.country];
          reports[scraper.country] = previous
            ? { ...previous, outcomes: [...previous.outcomes, ...report.outcomes] }
            : report;
        }

        const total = results.reduce((acc: number, r: { results: unknown[] }) => acc + r.results.length, 0);
        const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        // The label is part of the line because concurrent countries interleave
        // their output, so a `Done:` line has to say whose it is on its own.
        console.log(`  Done: [${label}] ${date}: ${results.length}/${scraper.routes.length} routes, ${total} results saved in ${elapsedSeconds}s`);
      }
    }
  };

  const concurrency = Math.max(1, Math.min(
    countries.length,
    Math.floor(options.countryConcurrency ?? DEFAULT_COUNTRY_CONCURRENCY),
  ));
  console.log(`  Collecting ${countries.length} country/countries, ${concurrency} at a time.`);

  let nextCountry = 0;
  const worker = async () => {
    while (nextCountry < countries.length) {
      const index = nextCountry;
      nextCountry += 1;
      await collectCountry(countries[index][1]);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

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
