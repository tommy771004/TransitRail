/**
 * Pre-render each country's station + line catalog into static
 * public/catalog/<country>.json, served by the CDN so the station menu never
 * depends on the /api serverless function being healthy.
 *
 * Every artifact carries the exact market-local service date used to build it.
 * HTTP 429 skips that market and preserves its existing file, including its
 * original service date. Other unrecoverable errors still fail the command.
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

function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown }; message?: unknown };
  if ([failure.status, failure.statusCode, failure.response?.status].some((status) => Number(status) === 429)) return true;
  // Current TfL/MBTA/iRail adapters throw Errors with the HTTP status in text.
  return typeof failure.message === "string"
    && /\b(?:HTTP\s+429|status(?:\s+code)?[\s:=]+429|429\s+Too Many Requests)\b/i.test(failure.message);
}

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
): Promise<ServiceRegionCatalog | null> {
  const date = providerDateValue(country);
  try {
    return await build({ country, date, includeProvider: true });
  } catch (error) {
    if (isRateLimited(error)) return null;
    console.warn(
      `  ! ${country}: live station directory unavailable; rebuilding from committed data (${error instanceof Error ? error.message : String(error)})`,
    );
    try {
      return await build({ country, date, includeProvider: false });
    } catch (fallbackError) {
      if (isRateLimited(fallbackError)) return null;
      throw fallbackError;
    }
  }
}

export async function generateStaticStationCatalogs({
  countries = configuredCountryOptions,
  outDir = OUT_DIR,
  build = buildServiceRegionCatalog,
}: { countries?: readonly Country[]; outDir?: string; build?: CatalogBuilder } = {}) {
  mkdirSync(outDir, { recursive: true });
  let ok = 0;
  let skipped = 0;
  // Configured, not public: a market withheld from the picker still needs a
  // catalog so its directory and coverage can be reviewed while its timetable
  // source is repaired. The public API gates on `countryOptions` separately.
  for (const country of countries) {
    const catalog = await buildCatalogWithProviderFallback(country, build);
    if (!catalog) {
      console.warn(`  ! ${country}: HTTP 429; skipping catalog refresh and keeping any existing file unchanged.`);
      skipped += 1;
      continue;
    }
    const serviceDate = catalog.serviceDate;
    writeFileSync(resolve(outDir, `${country}.json`), JSON.stringify(catalog, null, 2) + "\n", "utf-8");
    const covered = catalog.coverage?.covered;
    const coverageNote = covered
      ? `, ${covered.length} with timetable data`
      : "";
    console.log(
      `  ✓ ${country} (${serviceDate}): ${catalog.stations.length} stations, ${catalog.lines.length} lines${coverageNote}`,
    );
    ok += 1;
  }
  console.log(`\nGenerated ${ok}/${countries.length} catalogs; skipped ${skipped} rate-limited market(s).`);
  return { generated: ok, skipped };
}

if (process.argv[1]?.endsWith("generate-station-catalog.ts")) {
  generateStaticStationCatalogs().catch((e) => { console.error(e); process.exit(1); });
}
