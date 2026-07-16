/**
 * Audit: do the station names used by the daily scrapers / scraped data match
 * the station names offered in the app's station menu (dropdown)?
 *
 * A mismatch means a user can pick a station in the menu but the search will
 * never find the scraped route (findScrapedResults matches by name), or a
 * scraped route can never be reached from the menu at all.
 *
 * Menu membership comes from {@link getStaticMenuStations} — the same pure
 * registry used by /api/transit/stations for static countries — so this audit
 * cannot drift from production menus.
 *
 * Run: npx tsx scripts/audit-station-mapping.ts
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

import {
  getStaticMenuStations,
  missingRouteEndpoints,
} from "../src/data/stationIdentity";

const DATA_DIR = resolve("src/data/scraped");

interface ScrapedFile {
  origin: string;
  destination: string;
  results: unknown[];
  file: string;
}

function scrapedRoutes(country: string): ScrapedFile[] {
  const dir = resolve(DATA_DIR, country);
  if (!existsSync(dir)) return [];
  const out: ScrapedFile[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file === "metadata.json") continue;
    const data = JSON.parse(readFileSync(resolve(dir, file), "utf-8"));
    out.push({ origin: data.origin, destination: data.destination, results: data.results || [], file });
  }
  return out;
}

const COUNTRIES = [
  "japan", "korea", "singapore", "thailand", "hong_kong",
  "united_kingdom", "united_states", "germany", "france", "belgium", "norway", "china", "switzerland",
];

let totalMismatch = 0;
let totalEmpty = 0;

for (const country of COUNTRIES) {
  const menu = getStaticMenuStations(country);
  const routes = scrapedRoutes(country);
  const problems: string[] = [];

  for (const r of routes) {
    const missing = missingRouteEndpoints(menu, r.origin, r.destination);
    if (missing.length > 0) {
      problems.push(`  ✗ ${r.file}: ${missing.join(", ")} NOT in menu`);
      totalMismatch += missing.length;
    }
    if (r.results.length === 0) {
      totalEmpty += 1;
    }
  }

  const header = menu
    ? `${country} (menu: ${menu.length} stations, ${routes.length} scraped routes)`
    : `${country} (LIVE provider menu — name match not verifiable offline, ${routes.length} scraped routes)`;
  console.log(`\n=== ${header} ===`);
  if (problems.length === 0) {
    console.log(menu ? "  ✓ all scraped route endpoints present in menu" : "  (skipped name check — live menu)");
  } else {
    problems.forEach((p) => console.log(p));
  }
  const empties = routes.filter((r) => r.results.length === 0);
  if (empties.length > 0) {
    console.log(`  ⚠ ${empties.length} scraped file(s) have 0 results: ${empties.map((r) => r.file).join(", ")}`);
  }
}

console.log(`\n---\nTotal menu/data name mismatches: ${totalMismatch}`);
console.log(`Total scraped files with 0 results: ${totalEmpty}`);
process.exitCode = totalMismatch > 0 ? 1 : 0;
