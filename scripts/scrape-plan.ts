/**
 * Decide which pass the nightly job should run, and print it: `full` or
 * `live-only`.
 *
 * The rule is the invariant itself rather than a calendar: run the full scrape
 * when the committed data no longer covers every date the picker offers. In
 * steady state that fires every FULL_SCRAPE_INTERVAL_DAYS, because one full run
 * collects the search window plus that many days of headroom. Unlike a
 * day-of-month schedule it also recovers on its own — a failed or skipped run
 * leaves the window short, so the next night runs full instead of waiting out
 * the cadence.
 *
 * Markets whose source only answers for today are not consulted: they are
 * refreshed by every pass, so they can never be the reason to run a full one.
 *
 * Run: npx tsx scripts/scrape-plan.ts   (prints one word on stdout)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  addDateValueDays,
  configuredCountryOptions,
  providerDateValue,
  SEARCH_WINDOW_DAYS,
} from "../src/data/countries";
import { getCountryCapability } from "../src/data/countryCapability";
import type { Country } from "../src/types";

const DATA_DIR = resolve("src/data/scraped");

/** The newest service day this market has committed rows for. */
function newestCommittedDate(country: Country): string | undefined {
  const dir = join(DATA_DIR, country);
  if (!existsSync(dir)) return undefined;
  let newest: string | undefined;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "metadata.json") continue;
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), "utf8")) as { results?: { date?: string }[] };
      for (const result of parsed.results || []) {
        if (result.date && (!newest || result.date > newest)) newest = result.date;
      }
    } catch {
      // An unreadable file says nothing about coverage; the validator reports it.
    }
  }
  return newest;
}

export interface MarketCoverage {
  country: string;
  /** Newest committed service day, or undefined when the market has no rows. */
  newest?: string;
  /** Last date the picker offers for this market today. */
  required: string;
}

export interface ScrapePassDecision {
  pass: "full" | "live-only";
  shortfalls: string[];
  reason: string;
}

/**
 * Pure decision, so the rule that governs whether the site has data for a date
 * a passenger can pick is covered by tests rather than by a nightly surprise.
 */
export function decideScrapePass(markets: readonly MarketCoverage[]): ScrapePassDecision {
  // A market with no rows at all cannot show the window is stale — it is broken
  // or unwired, and a nightly full scrape would not fix that.
  const withData = markets.filter((market) => market.newest);
  const shortfalls = withData
    .filter((market) => market.newest! < market.required)
    .map((market) => `${market.country} covers to ${market.newest}, picker offers to ${market.required}`);

  if (withData.length === 0) {
    return { pass: "full", shortfalls, reason: "no committed rows to judge coverage by" };
  }
  if (shortfalls.length > 0) {
    return { pass: "full", shortfalls, reason: `${shortfalls.length} market(s) short of the search window` };
  }
  return {
    pass: "live-only",
    shortfalls,
    reason: "every snapshot market still covers the window the picker offers",
  };
}

function main() {
  const markets = configuredCountryOptions
    .filter((country) => !getCountryCapability(country).liveOnly)
    .map((country) => ({
      country,
      newest: newestCommittedDate(country),
      required: addDateValueDays(providerDateValue(country), SEARCH_WINDOW_DAYS - 1),
    }));

  const decision = decideScrapePass(markets);
  for (const line of decision.shortfalls) console.error(`  ${line}`);
  console.error(`${decision.pass === "full" ? "Full scrape" : "Live-only pass"}: ${decision.reason}.`);
  console.log(decision.pass);
}

if (process.argv[1]?.endsWith("scrape-plan.ts")) main();
