/**
 * Keep one market's last published data when only that market failed the gate.
 *
 * The gate used to be all-or-nothing: one blocking finding discarded the whole
 * run. From 2026-10-02 Korail's 10/1 workbook aborted the Korea scrape, the
 * kept Korea snapshot covered a single day that `prune:past` then removed, and
 * the resulting row loss held back every other market's verified timetable for
 * four nights. Validation is per country — every check reads one market's
 * files, and the row-loss guard compares one market against its own baseline —
 * so a market that passed is judged on its own data and may publish.
 *
 * A quarantined market is restored byte-for-byte to HEAD, which is the data
 * already public. Publishing the rest therefore states nothing new about it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ValidationFinding } from "./timetableValidation";

/** Markets with at least one blocking finding, sorted. */
export function blockedCountries(findings: readonly ValidationFinding[]): string[] {
  return [...new Set(findings.filter((finding) => finding.severity === "blocking").map((finding) => finding.country))].sort();
}

/**
 * Every path the nightly commit publishes on a market's behalf: its route
 * directory, its service-day artifact, and its scrape-written catalog files
 * (`malaysia.json`, `singapore.json`, `singapore-menu.json`).
 */
export function countryDataPaths(country: string, root = process.cwd()): string[] {
  if (!/^[a-z_]+$/.test(country)) throw new Error(`Not a market id: ${country}`);
  const paths = [`src/data/scraped/${country}`, `src/data/service-day/${country}.json`];
  const catalogDir = join(root, "src/data/catalog");
  if (existsSync(catalogDir)) {
    for (const name of readdirSync(catalogDir).sort()) {
      if (name === `${country}.json` || (name.startsWith(`${country}-`) && name.endsWith(".json"))) {
        paths.push(`src/data/catalog/${name}`);
      }
    }
  }
  return paths;
}

/**
 * Put each market's publishable files back to HEAD: tracked files are checked
 * out, files this run created are removed. Throws unless the paths then match
 * HEAD exactly, so a market can never be half-restored and still published.
 */
export function restoreCountriesFromHead(countries: readonly string[], root = process.cwd()): void {
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf-8" });
  for (const country of countries) {
    const paths = countryDataPaths(country, root);
    const tracked = paths.filter((path) => git(["ls-tree", "-r", "--name-only", "HEAD", "--", path]).trim() !== "");
    if (tracked.length > 0) git(["checkout", "HEAD", "--", ...tracked]);
    git(["clean", "-fdq", "--", ...paths]);
    const left = git(["status", "--porcelain", "--", ...paths]).trim();
    if (left) throw new Error(`Could not restore ${country} to the published data:\n${left}`);
  }
}
