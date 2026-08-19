/**
 * Print what a GTFS feed publishes, in the feed's own spelling.
 *
 * Usage:
 *   npm run inspect:gtfs -- https://example.jp/feed.zip
 *   npm run inspect:gtfs -- ./feed.zip --rail-only
 *
 * Wiring a GTFS-backed market needs the operator's exact `stop_name` strings:
 * search matches stops by name, so a route list transcribed from anywhere but
 * the feed silently matches nothing. Run this against the feed, paste the
 * printed pairs into `scripts/scrapers/routes.ts`, and the printed stop lists
 * into the market's line catalogue.
 */
import { readFile } from "node:fs/promises";
import { parseGtfsFeed } from "../src/server/gtfs/feed";
import {
  gtfsRouteTypeLabel,
  isGtfsRailRouteType,
  scrapeRoutePairs,
  summarizeGtfsRoutes,
} from "./lib/gtfsFeedSummary";

async function feedBytes(source: string): Promise<Uint8Array> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, {
      headers: {
        accept: "*/*",
        "user-agent": "TransitRail scheduled timetable scraper",
      },
    });
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}.`);
    return new Uint8Array(await response.arrayBuffer());
  }
  return new Uint8Array(await readFile(source));
}

async function main() {
  const args = process.argv.slice(2);
  const railOnly = args.includes("--rail-only");
  const source = args.find((arg) => !arg.startsWith("--"));
  if (!source) {
    console.error("Usage: npm run inspect:gtfs -- <feed.zip url or path> [--rail-only]");
    process.exit(1);
  }

  const feed = parseGtfsFeed(await feedBytes(source), { label: source });
  const summaries = summarizeGtfsRoutes(feed).filter((summary) => (
    !railOnly || isGtfsRailRouteType(summary.routeType)
  ));

  console.log(`Feed: ${source}`);
  console.log(`Stops: ${feed.stops.length}   Trips: ${feed.trips.size}   Routes: ${feed.routes.size}`);
  console.log("");

  for (const summary of summaries) {
    const terminals = summary.terminals ? `${summary.terminals[0]} ⇄ ${summary.terminals[1]}` : "no terminals";
    console.log(`[${gtfsRouteTypeLabel(summary.routeType)}] ${summary.name} (${summary.routeId})`);
    console.log(`  ${terminals} — ${summary.tripCount} trip(s), ${summary.stops.length} stop(s)`);
    if (summary.stops.length > 0) console.log(`  ${summary.stops.join(" · ")}`);
    console.log("");
  }

  const pairs = scrapeRoutePairs(summaries);
  if (pairs.length > 0) {
    console.log("Scrape list entries (paste into scripts/scrapers/routes.ts):");
    for (const pair of pairs) {
      console.log(`  { origin: ${JSON.stringify(pair.origin)}, destination: ${JSON.stringify(pair.destination)} },`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
