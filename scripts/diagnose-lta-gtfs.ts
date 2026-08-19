/**
 * Ask LTA DataMall two questions and print exactly what it says back.
 *
 * A failing Singapore scrape is ambiguous in the ways that matter, because
 * DataMall authenticates at the gateway before it routes: an **unauthenticated**
 * request answers `404 The requested API was not found` for every path,
 * including ones that certainly exist, so an anonymous probe can never tell you
 * whether an address is real. With a key, an invalid credential and a resource
 * the account cannot reach both come back as the same status.
 *
 * Two requests separate them. `BusStops` is in every DataMall account's
 * catalogue, so it answers "is this key good?" on its own. The GTFS resolver
 * then answers "does this account reach that resource?" — if the first is 200
 * while the second is not, the key was never the problem.
 *
 * Then it walks the rest of the chain, because a good key still leaves two
 * links that fail differently: the signed archive URL, and the parsed feed
 * answering for one station pair.
 *
 *   LTA_ACCOUNT_KEY=... npx tsx scripts/diagnose-lta-gtfs.ts [YYYY-MM-DD]
 */

import { LTA_GTFS_SCHEDULE_URL, searchSingaporeLtaGtfs } from "../src/server/singaporeLtaGtfs";

const DATAMALL_BASE = "https://datamall2.mytransport.sg/ltaodataservice";
/** A resource every DataMall account can read, used purely to validate the key. */
const CONTROL_URL = `${DATAMALL_BASE}/BusStops`;
const ORIGIN = "Jurong East";
const DESTINATION = "Raffles Place";

function describeKey(key: string | undefined) {
  if (!key) return "not set — export LTA_ACCOUNT_KEY before running this";
  const trimmed = key.trim();
  const notes: string[] = [`length ${key.length}`];
  if (trimmed !== key) notes.push("HAS SURROUNDING WHITESPACE — likely a stray newline or space");
  if (/^["'].*["']$/.test(trimmed)) notes.push('IS WRAPPED IN QUOTES — the quotes are part of the value and LTA will reject it');
  return `${key.slice(0, 4)}…${key.slice(-2)} (${notes.join("; ")})`;
}

async function probe(label: string, url: string, key: string): Promise<number> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { AccountKey: key, Accept: "application/json", "User-Agent": "TransitRail/1.0" },
    });
    const body = (await response.text()).replace(/\s+/g, " ").trim();
    console.log(`\n${label}`);
    console.log(`  ${url}`);
    console.log(`  HTTP ${response.status} in ${Date.now() - started}ms`);
    console.log(`  body: ${body.slice(0, 300) || "<empty>"}`);
    return response.status;
  } catch (error) {
    console.log(`\n${label}\n  ${url}\n  request failed: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

function singaporeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Walk the archive download and feed parse, which only run once a key works. */
async function probeChain(serviceDate: string) {
  const started = Date.now();
  const result = await searchSingaporeLtaGtfs(ORIGIN, DESTINATION, serviceDate);
  console.log(`\nThe full chain — ${ORIGIN} → ${DESTINATION} on ${serviceDate}`);
  console.log(`  status ${result.status} in ${Date.now() - started}ms`);
  console.log(`  parsed departures: ${result.body.results.length}`);

  // Only 200 substantiates a departure. A 404 means the feed downloaded and
  // parsed but published nothing for this pair, which is a station-matching
  // question rather than a healthy source.
  if (result.status === 200) {
    console.log("  Reading: resolver, signed archive and feed all answered. The chain is healthy.");
    return;
  }
  process.exitCode = 1;
  console.log(`  Reading: ${result.body.message || "the official schedule is unavailable."}`);
  if (result.status === 404) {
    console.log(`  Download and parse worked, so check that "${ORIGIN}" and "${DESTINATION}"`);
    console.log("  match the feed's stops.txt names under LTA_STATION_MATCH's filler words.");
  } else if (result.body.message?.includes("archive download returned")) {
    console.log("  The resolver answered but its signed link was refused. A 403 here on a");
    console.log("  link minted seconds ago is an LTA-side problem; a 403 on a link from the");
    console.log("  static content/dam ZIP just means that frozen copy expired long ago.");
  }
  console.log("  The previously committed snapshot stays in service either way.");
}

async function main() {
  const key = process.env.LTA_ACCOUNT_KEY?.trim();
  console.log(`LTA_ACCOUNT_KEY: ${describeKey(process.env.LTA_ACCOUNT_KEY)}`);
  if (!key) {
    console.log("\nWithout a key nothing can be concluded: DataMall answers 404 for every");
    console.log("anonymous request, so an absent key looks exactly like a wrong address.");
    process.exitCode = 1;
    return;
  }

  const controlStatus = await probe("Control — a resource every account has", CONTROL_URL, key);
  const resolverStatus = await probe("The resolver the Singapore scraper uses", LTA_GTFS_SCHEDULE_URL, key);

  console.log("\nReading:");
  if (controlStatus === 200 && resolverStatus === 200) {
    console.log("  The key and the address are both fine.");
    await probeChain(process.argv[2] || singaporeToday());
    return;
  }

  process.exitCode = 1;
  if (controlStatus === 200) {
    console.log(`  The key is valid (control returned 200) but the resolver returned ${resolverStatus}.`);
    console.log("  The address or this account's provisioning is the problem, not the");
    console.log("  credential. Confirm against LTA's own API catalogue that a train GTFS");
    console.log("  resource exists and what it is called. If LTA publishes no train");
    console.log("  timetable at all, `sg-lta-gtfs` cannot be substantiated and the register");
    console.log("  entry should go rather than the scrape keep retrying it.");
    return;
  }
  console.log(`  The control request returned ${controlStatus}, so nothing can be concluded`);
  console.log("  about the resolver until that is fixed. Read the control body above first:");
  console.log("  if it does not look like something LTA wrote, the request never reached");
  console.log("  DataMall and a proxy or egress allowlist is answering for it. If it is LTA");
  console.log("  refusing the key, compare the value above against the portal — quotes and");
  console.log("  trailing newlines are the usual cause.");
}

void main();
