/**
 * Audit: do the station names used by the daily scrapers / scraped data match
 * the station names offered in the app's station menu (dropdown)?
 *
 * A mismatch means a user can pick a station in the menu but the search will
 * never find the scraped route (findScrapedResults matches by name), or a
 * scraped route can never be reached from the menu at all.
 *
 * Both directions are checked, because they fail differently:
 *   scraped -> menu  a route exists that nobody can select (hard failure)
 *   menu -> scraped  a station is selectable that no timetable covers, so the
 *                    search 404s on a trip the line map says is trivial. Korea
 *                    ships 305 menu stations against 8 covered ones, which is
 *                    what made `Cheongnyangni -> Seoul Station` a dead end.
 * Only the first is an error — the second is inherent to a curated corridor
 * set, so it is reported as coverage, not failed.
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
import {
  coverageModeFor,
  coveredMenuStations,
  type CoverageMode,
} from "../src/data/stationCoverage";
import type { ScrapedRouteData } from "../src/data/scraped/timetableDay";
import type { Country } from "../src/types";

const DATA_DIR = resolve("src/data/scraped");

interface ScrapedFile extends ScrapedRouteData {
  file: string;
}

function scrapedRoutes(country: string): ScrapedFile[] {
  const dir = resolve(DATA_DIR, country);
  if (!existsSync(dir)) return [];
  const out: ScrapedFile[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file === "metadata.json") continue;
    const data = JSON.parse(readFileSync(resolve(dir, file), "utf-8"));
    out.push({ ...data, results: data.results || [], file });
  }
  return out;
}

const COUNTRIES = [
  "japan", "korea", "singapore", "thailand", "hong_kong",
  "united_kingdom", "united_states", "germany", "france", "belgium", "norway", "china", "switzerland",
];

let totalMismatch = 0;
let totalEmpty = 0;
const coverageRows: Array<{ country: string; menu: number; covered: number; mode: CoverageMode }> = [];

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

  // Reverse direction: how much of the menu can search actually answer for?
  const mode = coverageModeFor(country as Country);
  if (menu && mode === "scraped") {
    const covered = coveredMenuStations(menu, routes, country as Country);
    coverageRows.push({ country, menu: menu.length, covered: covered.length, mode });
    const pct = menu.length === 0 ? 0 : (covered.length / menu.length) * 100;
    console.log(
      `  → timetable coverage: ${covered.length}/${menu.length} menu stations (${pct.toFixed(1)}%)`,
    );
    if (covered.length < menu.length) {
      console.log(`    searchable: ${covered.join(", ")}`);
    }
  } else if (mode !== "scraped") {
    console.log(`  → timetable coverage: unbounded (${mode} search answers arbitrary pairs)`);
  }
}

console.log(`\n---\nTotal menu/data name mismatches: ${totalMismatch}`);
console.log(`Total scraped files with 0 results: ${totalEmpty}`);

if (coverageRows.length > 0) {
  console.log("\nMenu stations a snapshot search can answer for:");
  for (const row of [...coverageRows].sort((a, b) => a.covered / a.menu - b.covered / b.menu)) {
    const pct = row.menu === 0 ? 0 : (row.covered / row.menu) * 100;
    console.log(
      `  ${row.country.padEnd(12)} ${String(row.covered).padStart(4)}/${String(row.menu).padEnd(5)} ` +
      `${pct.toFixed(1).padStart(5)}%   ${row.menu - row.covered} station(s) marked "no timetable" in the picker`,
    );
  }
}

process.exitCode = totalMismatch > 0 ? 1 : 0;
