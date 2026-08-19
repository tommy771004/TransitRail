/**
 * Drop committed timetable rows for service days that have already passed.
 *
 * A scrape prunes through `keepDates`, but only for the markets it touches on
 * the run — so between full scrapes the file-backed markets keep yesterday's
 * slice, and a market whose scrape fails keeps its old ones indefinitely. Those
 * rows can never answer a search: the picker offers today forward. They only
 * inflate the repository and make a stale market look better stocked than it
 * is.
 *
 * Run: npm run prune:past  (the nightly job runs it before validation)
 */
import "dotenv/config";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configuredCountryOptions, providerDateValue } from "../src/data/countries";
import type { Country } from "../src/types";

const DATA_DIR = resolve("src/data/scraped");

interface DatedResult { date?: string }
interface RouteFile { results?: DatedResult[] }

/** Today in the market's own time zone — a service day is local, not UTC. */
function todayFor(country: Country): string {
  return providerDateValue(country);
}

function pruneCountry(country: Country, apply: boolean) {
  const dir = join(DATA_DIR, country);
  if (!existsSync(dir)) return { files: 0, removed: 0 };
  const cutoff = todayFor(country);
  let files = 0;
  let removed = 0;

  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "metadata.json") continue;
    const path = join(dir, name);
    let parsed: RouteFile;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as RouteFile;
    } catch {
      console.warn(`  skipped unreadable ${country}/${name}`);
      continue;
    }
    const results = parsed.results;
    if (!Array.isArray(results)) continue;

    // A row with no date cannot be shown to belong to a past service day, and
    // dateless rows are rejected elsewhere as a separate concern — leave them.
    const kept = results.filter((result) => !result.date || result.date >= cutoff);
    if (kept.length === results.length) continue;

    removed += results.length - kept.length;
    files += 1;
    if (apply) writeFileSync(path, `${JSON.stringify({ ...parsed, results: kept }, null, 2)}\n`, "utf8");
  }

  return { files, removed };
}

function main() {
  const apply = !process.argv.includes("--dry-run");
  let totalFiles = 0;
  let totalRemoved = 0;

  for (const country of configuredCountryOptions) {
    const { files, removed } = pruneCountry(country, apply);
    if (removed === 0) continue;
    totalFiles += files;
    totalRemoved += removed;
    console.log(`  ${country}: removed ${removed} row(s) before ${todayFor(country)} from ${files} file(s)`);
  }

  console.log(totalRemoved === 0
    ? "No timetable rows predate today."
    : `${apply ? "Removed" : "Would remove"} ${totalRemoved} row(s) across ${totalFiles} file(s).`);
}

main();
