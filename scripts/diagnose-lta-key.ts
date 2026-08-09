/**
 * Ask LTA DataMall two questions and print exactly what it says back.
 *
 * A 401 from the Singapore scrape is ambiguous in the one way that matters: an
 * invalid key and a valid key aimed at a resource the account cannot reach both
 * arrive as the same status. DataMall authenticates at the gateway before it
 * routes, so a request to a path that is not in the catalogue — or not
 * provisioned for this account — is refused as an auth failure rather than a
 * 404. "The key is bad" and "the address is wrong" therefore look identical
 * from the scrape's error message.
 *
 * Two requests separate them. `BusStops` is in every DataMall account's
 * catalogue, so it answers "is this key good?" on its own. The GTFS path then
 * answers "does this account reach that resource?" — and if the first is 200
 * while the second is not, the key was never the problem.
 *
 *   LTA_ACCOUNT_KEY=... npx tsx scripts/diagnose-lta-key.ts
 */

import { LTA_GTFS_SCHEDULE_URL } from "../src/server/singaporeLtaGtfs";

const DATAMALL_BASE = "https://datamall2.mytransport.sg/ltaodataservice";

/** A resource every DataMall account can read, used purely to validate the key. */
const CONTROL_URL = `${DATAMALL_BASE}/BusStops`;

function describeKey(key: string | undefined) {
  if (!key) return "not set — export LTA_ACCOUNT_KEY before running this";
  const trimmed = key.trim();
  const notes: string[] = [`length ${key.length}`];
  if (trimmed !== key) notes.push("HAS SURROUNDING WHITESPACE — likely a stray newline or space");
  if (/^["'].*["']$/.test(trimmed)) notes.push('IS WRAPPED IN QUOTES — the quotes are part of the value and LTA will reject it');
  return `${key.slice(0, 4)}…${key.slice(-2)} (${notes.join("; ")})`;
}

async function probe(label: string, url: string, key: string) {
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

async function main() {
  const key = process.env.LTA_ACCOUNT_KEY?.trim();
  console.log(`LTA_ACCOUNT_KEY: ${describeKey(process.env.LTA_ACCOUNT_KEY)}`);
  if (!key) process.exit(1);

  const controlStatus = await probe("Control — a resource every account has", CONTROL_URL, key);
  const gtfsStatus = await probe("The source the Singapore scraper uses", LTA_GTFS_SCHEDULE_URL, key);

  console.log("\nReading:");
  if (controlStatus === 200 && gtfsStatus === 200) {
    console.log("  Both work. The key and the address are fine, so a failing scrape is about");
    console.log("  the response shape — check that the body carries a `Link` to the archive.");
  } else if (controlStatus === 200 && gtfsStatus !== 200) {
    console.log(`  The key is valid (control returned 200) but the GTFS path returned ${gtfsStatus}.`);
    console.log("  The address is the problem, not the credential. Confirm against LTA's own");
    console.log("  API catalogue that a train-timetable GTFS resource exists and what it is");
    console.log("  called — DataMall's published catalogue is bus static data, train service");
    console.log("  alerts, platform crowd density and passenger volumes. If LTA publishes no");
    console.log("  train departure timetable at all, then `sg-lta-gtfs` cannot be substantiated");
    console.log("  and the register entry should go rather than the scrape keep retrying it.");
  } else if (controlStatus !== 200) {
    console.log(`  The control request returned ${controlStatus}, so nothing can be concluded`);
    console.log("  about the GTFS address until that is fixed. Read the control body above");
    console.log("  first: if it does not look like something LTA wrote, the request never");
    console.log("  reached DataMall and a proxy or egress allowlist is answering for it.");
    console.log("  If it is LTA refusing the key, compare the value above against the portal —");
    console.log("  quotes and trailing newlines are the usual cause.");
  }
}

void main();
