/**
 * Pre-render each country's station + line catalog into static
 * public/catalog/<country>.json, served by the CDN so the station menu never
 * depends on the /api serverless function being healthy.
 *
 * Every artifact carries the exact market-local service date used to build it.
 * A failed generation fails the command rather than leaving a prior-date file
 * available to bypass the catalog's exact-date contract.
 *
 * Run: npx tsx scripts/generate-station-catalog.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { configuredCountryOptions, providerDateValue } from "../src/data/countries";
import { buildServiceRegionCatalog, type BuildServiceRegionCatalogOptions, type ServiceRegionCatalog } from "../src/server/catalog";
import type { Country } from "../src/types";

const OUT_DIR = resolve("public/catalog");

type CatalogBuilder = (options: BuildServiceRegionCatalogOptions) => Promise<ServiceRegionCatalog>;

/**
 * Provider directories are useful enrichment, not a publication gate for
 * already-validated timetables. A full scrape can consume a provider's request
 * allowance and make the immediately-following catalog refresh fail. Retry
 * from the committed, date-qualified snapshots so one exhausted directory API
 * cannot prevent every market's verified timetable from being published.
 */
export async function buildCatalogWithProviderFallback(
  country: Country,
  build: CatalogBuilder = buildServiceRegionCatalog,
): Promise<ServiceRegionCatalog> {
  const date = providerDateValue(country);
  try {
    return await build({ country, date, includeProvider: true });
  } catch (error) {
    console.warn(
      `  ! ${country}: live station directory unavailable; rebuilding from committed data (${error instanceof Error ? error.message : String(error)})`,
    );
    return build({ country, date, includeProvider: false });
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  // Configured, not public: a market withheld from the picker still needs a
  // catalog so its directory and coverage can be reviewed while its timetable
  // source is repaired. The public API gates on `countryOptions` separately.
  for (const country of configuredCountryOptions) {
    const catalog = await buildCatalogWithProviderFallback(country);
    const serviceDate = catalog.serviceDate;
    writeFileSync(resolve(OUT_DIR, `${country}.json`), JSON.stringify(catalog, null, 2) + "\n", "utf-8");
    const covered = catalog.coverage?.covered;
    const coverageNote = covered
      ? `, ${covered.length} with timetable data`
      : "";
    console.log(
      `  ✓ ${country} (${serviceDate}): ${catalog.stations.length} stations, ${catalog.lines.length} lines${coverageNote}`,
    );
    ok += 1;
  }
  console.log(`\nGenerated ${ok}/${configuredCountryOptions.length} catalogs into public/catalog/`);
}

if (process.argv[1]?.endsWith("generate-station-catalog.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
