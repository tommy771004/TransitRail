/**
 * Gate between a scrape and its commit.
 *
 * Run: `npx tsx scripts/validate-timetables.ts`
 * Exit 0 = safe to commit. Exit 1 = something in the working tree states
 * something false, so the run must be discarded and the previous committed
 * version kept.
 *
 * The daily workflow runs this between the scrape and the commit step for
 * exactly that reason: the useful property of a data pipeline is not that it
 * always produces something, it is that it never publishes something wrong.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getStationsForCountry } from "../src/server/catalog";
import { configuredCountryOptions } from "../src/data/countries";
import { resolveStationAlias } from "../src/data/stationAliases";
import type { Country } from "../src/types";
import {
  countRowsByCountry,
  detectRowLossRegressions,
  hasBlockingFindings,
  summarizeFindings,
  validateCommittedTimetables,
  type CountryRowCounts,
} from "./lib/timetableValidation";

async function knownStationsByCountry(): Promise<Record<string, Set<string>>> {
  const catalogs: Record<string, Set<string>> = {};
  for (const country of configuredCountryOptions) {
    try {
      const { stations } = await getStationsForCountry(country);
      if (stations.length > 0) {
        catalogs[country] = new Set(
          stations.flatMap((name) => [
            name.trim().toLowerCase(),
            resolveStationAlias(country as Country, name).trim().toLowerCase(),
          ]),
        );
      }
    } catch {
      // A catalog built live from a provider may be unreachable. Skipping it
      // drops one check for that country rather than failing the whole run on
      // a network condition that says nothing about the data on disk.
    }
  }
  return catalogs;
}

/**
 * Row counts from the last commit, by materialising HEAD's route files into a
 * scratch directory.
 *
 * Reading from git rather than from a stashed copy means the baseline is the
 * version actually published, not whatever an earlier step in the same job
 * happened to leave behind.
 */
function baselineRowCounts(): CountryRowCounts | undefined {
  let directory: string | undefined;
  try {
    const listed = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "src/data/scraped/"], {
      encoding: "utf-8",
    })
      .split("\n")
      .filter((path) => path.endsWith(".json") && !path.endsWith("metadata.json"));
    if (listed.length === 0) return undefined;

    directory = mkdtempSync(join(tmpdir(), "transitrail-baseline-"));
    for (const path of listed) {
      const relative = path.replace(/^src\/data\/scraped\//, "");
      const target = join(directory, relative);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf-8", maxBuffer: 1 << 30 }));
    }
    return countRowsByCountry({ dataDir: directory });
  } catch (error) {
    console.warn(`Could not read the committed baseline, skipping the data-loss guard: ${error instanceof Error ? error.message : error}`);
    return undefined;
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}

async function main() {
  const report = validateCommittedTimetables({ knownStations: await knownStationsByCountry() });

  if (process.argv.includes("--against-head")) {
    const baseline = baselineRowCounts();
    if (baseline) {
      report.findings.push(...detectRowLossRegressions(baseline, countRowsByCountry()));
    }
  }

  const grouped = summarizeFindings(report.findings);

  console.log(`Validated ${report.routesChecked} route files across ${report.countriesChecked} countries.\n`);

  for (const [check, findings] of grouped) {
    const blocking = findings.filter((finding) => finding.severity === "blocking").length;
    console.log(`${blocking > 0 ? "✗" : "!"} ${check} — ${findings.length} finding(s), ${blocking} blocking`);
    for (const finding of findings.slice(0, 10)) {
      console.log(`    [${finding.severity}] ${finding.country}/${finding.route}: ${finding.message}`);
    }
    if (findings.length > 10) console.log(`    … and ${findings.length - 10} more`);
  }

  if (grouped.size === 0) {
    console.log("✓ No findings.");
    return;
  }

  if (hasBlockingFindings(report)) {
    console.error("\nBlocking findings present — this run must not be committed.");
    process.exitCode = 1;
    return;
  }
  console.log("\nWarnings only — safe to commit.");
}

main().catch((error) => {
  console.error("Validation failed to run:", error);
  process.exitCode = 1;
});
