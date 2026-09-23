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
 * A route added to a scrape list is the other reason. The window test alone
 * cannot see it — the market's other files still cover every date — so the
 * return directions added on 2026-09-23 waited out a live-only night with no
 * file at all. A configured route with neither a committed file nor a recorded
 * failure has never been collected, and only a full pass will collect it.
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
import { createTimetableScrapers } from "./scrapers/registry";
import type { Country } from "../src/types";

const DATA_DIR = resolve("src/data/scraped");

/** A fresh source must not hide another source's stale service window. */
export function coveredThroughBySource(routes: readonly {
  sourceMeta?: { sourceId?: string };
  results?: { date?: string }[];
}[]): string | undefined {
  const newestBySource = new Map<string, string>();
  for (const route of routes) {
    // Only a registered source may produce searchable departures, so a file
    // without a sourceId says nothing about what the picker can answer. Pooling
    // those under one "unknown" bucket let an unregistered leftover become the
    // least recent frontier and pin the whole market to a nightly full scrape.
    const source = route.sourceMeta?.sourceId;
    if (!source) continue;
    for (const result of route.results || []) {
      if (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)
        && result.date > (newestBySource.get(source) || "")) {
        newestBySource.set(source, result.date);
      }
    }
  }
  // Empty/unwired sources retain the existing no-data policy. Among sources
  // with rows, use the least recent frontier, not the freshest one's date.
  return [...newestBySource.values()].sort()[0];
}

interface RoutePair {
  origin?: string;
  destination?: string;
}

/**
 * Configured routes nothing has collected yet: no committed file, and no failure
 * recorded against them. A route that was tried and failed is not counted — a
 * full pass cannot fix a pair the provider does not serve, and letting it vote
 * would pin the job to a nightly full scrape.
 */
export function uncollectedRoutes(
  configured: readonly RoutePair[],
  committed: readonly RoutePair[],
  failed: readonly RoutePair[],
): string[] {
  const key = (route: RoutePair) => `${route.origin} → ${route.destination}`;
  const known = new Set([...committed, ...failed].map(key));
  return [...new Set(configured.map(key))].filter((route) => !known.has(route));
}

type CommittedRoute = Parameters<typeof coveredThroughBySource>[0][number] & RoutePair;

function committedRoutes(country: Country): CommittedRoute[] {
  const dir = join(DATA_DIR, country);
  if (!existsSync(dir)) return [];
  const routes: CommittedRoute[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "metadata.json") continue;
    try {
      routes.push(JSON.parse(readFileSync(join(dir, name), "utf8")));
    } catch {
      // An unreadable file says nothing about coverage; the validator reports it.
    }
  }
  return routes;
}

function recordedFailures(country: Country): RoutePair[] {
  try {
    const metadata = JSON.parse(readFileSync(join(DATA_DIR, country, "metadata.json"), "utf8"));
    return Array.isArray(metadata.failedRoutes) ? metadata.failedRoutes : [];
  } catch {
    return [];
  }
}

export interface MarketCoverage {
  country: string;
  /** Newest committed service day, or undefined when the market has no rows. */
  newest?: string;
  /** Last date the picker offers for this market today. */
  required: string;
  /** Configured routes with no committed file and no recorded failure. */
  uncollected?: readonly string[];
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
  const shortfalls = [
    ...withData
      .filter((market) => market.newest! < market.required)
      .map((market) => `${market.country} covers to ${market.newest}, picker offers to ${market.required}`),
    ...markets
      .filter((market) => market.uncollected?.length)
      .map((market) => `${market.country} has never collected ${market.uncollected!.join(", ")}`),
  ];

  if (withData.length === 0) {
    return { pass: "full", shortfalls, reason: "no committed rows to judge coverage by" };
  }
  if (shortfalls.length > 0) {
    return { pass: "full", shortfalls, reason: `${shortfalls.length} shortfall(s) in committed coverage` };
  }
  return {
    pass: "live-only",
    shortfalls,
    reason: "every snapshot market still covers the window the picker offers",
  };
}

function main() {
  // stdout carries the one-word verdict the workflow reads; keep anything a
  // scraper module prints while it is constructed off it.
  const log = console.log;
  console.log = console.error;
  const configured = new Map<string, RoutePair[]>();
  try {
    for (const scraper of createTimetableScrapers()) {
      configured.set(scraper.country, [...(configured.get(scraper.country) ?? []), ...scraper.routes]);
    }
  } finally {
    console.log = log;
  }

  const markets = configuredCountryOptions
    .filter((country) => !getCountryCapability(country).liveOnly)
    .map((country) => {
      const routes = committedRoutes(country);
      return {
        country,
        newest: coveredThroughBySource(routes),
        required: addDateValueDays(providerDateValue(country), SEARCH_WINDOW_DAYS - 1),
        uncollected: uncollectedRoutes(configured.get(country) ?? [], routes, recordedFailures(country)),
      };
    });

  const decision = decideScrapePass(markets);
  for (const line of decision.shortfalls) console.error(`  ${line}`);
  console.error(`${decision.pass === "full" ? "Full scrape" : "Live-only pass"}: ${decision.reason}.`);
  console.log(decision.pass);
}

if (process.argv[1]?.endsWith("scrape-plan.ts")) main();
