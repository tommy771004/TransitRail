/**
 * Pre-render each country's station + line catalog into static
 * public/catalog/<country>.json, served by the CDN so the station menu never
 * depends on the /api serverless function being healthy.
 *
 * 8 countries are deterministic (bundled data); UK/US fetch TfL/MBTA live, so
 * run this where there's network (the daily scrape workflow, and locally). On a
 * UK/US fetch failure the existing committed file is kept, never clobbered.
 *
 * Run: npx tsx scripts/generate-station-catalog.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { buildCatalog, CATALOG_COUNTRIES } from "../src/server/catalog";

const OUT_DIR = resolve("public/catalog");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const country of CATALOG_COUNTRIES) {
    const path = resolve(OUT_DIR, `${country}.json`);
    try {
      const catalog = await buildCatalog(country);
      if (catalog.stations.length === 0) {
        console.warn(`  ⚠ ${country}: 0 stations — ${existsSync(path) ? "keeping existing file" : "NO existing file!"}`);
        continue;
      }
      writeFileSync(path, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
      console.log(`  ✓ ${country}: ${catalog.stations.length} stations, ${catalog.lines.length} lines`);
      ok += 1;
    } catch (error) {
      console.warn(`  ✗ ${country}: ${error instanceof Error ? error.message : error} — ${existsSync(path) ? "keeping existing file" : "NO existing file!"}`);
    }
  }
  console.log(`\nGenerated ${ok}/${CATALOG_COUNTRIES.length} catalogs into public/catalog/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
