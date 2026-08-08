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
import { providerDateValue } from "../src/data/countries";
import { buildServiceRegionCatalog, CATALOG_COUNTRIES } from "../src/server/catalog";

const OUT_DIR = resolve("public/catalog");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const country of CATALOG_COUNTRIES) {
    const serviceDate = providerDateValue(country);
    const catalog = await buildServiceRegionCatalog({ country, date: serviceDate });
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
  console.log(`\nGenerated ${ok}/${CATALOG_COUNTRIES.length} catalogs into public/catalog/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
