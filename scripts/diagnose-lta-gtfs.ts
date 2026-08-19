/**
 * Walk the official LTA GTFS Schedule (Train) chain and report where it stops.
 *
 * The chain has three links and each fails differently: the DataMall catalogue
 * URL, the signed archive it names, and the parsed feed answering for one
 * station pair. A single "it didn't work" hides which link broke, so this
 * prints the reached link and exits non-zero unless departures came back.
 *
 * No AccountKey is involved — the catalogue ZIP is public. Authenticated
 * DataMall APIs (realtime trip updates, crowd density) are a separate concern.
 *
 *   npx tsx scripts/diagnose-lta-gtfs.ts [YYYY-MM-DD]
 */

import { LTA_GTFS_SCHEDULE_URL, searchSingaporeLtaGtfs } from "../src/server/singaporeLtaGtfs";

const ORIGIN = "Jurong East";
const DESTINATION = "Raffles Place";

function singaporeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const serviceDate = process.argv[2] || singaporeToday();
  const started = Date.now();

  console.log("LTA DataMall GTFS Schedule (Train)");
  console.log(`  ${LTA_GTFS_SCHEDULE_URL}`);
  console.log(`  probe: ${ORIGIN} → ${DESTINATION} on ${serviceDate}`);

  let result: Awaited<ReturnType<typeof searchSingaporeLtaGtfs>>;
  try {
    result = await searchSingaporeLtaGtfs(ORIGIN, DESTINATION, serviceDate);
  } catch (error) {
    console.error(`\n  The request threw before returning a status: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`  status ${result.status} in ${Date.now() - started}ms`);
  console.log(`  parsed departures: ${result.body.results.length}`);
  console.log("");

  // 200 is the only outcome that substantiates a departure. A 404 means the
  // feed downloaded and parsed but answered nothing for this pair, which is a
  // station-matching or coverage question, not a healthy feed — reporting it
  // as success is how "the source works" and "the source publishes this
  // journey" got confused in the first place.
  if (result.status === 200) {
    console.log("  Reading: the catalogue ZIP, the signed archive and the parsed feed all answered.");
    console.log("  The chain is healthy and needs no AccountKey.");
    return;
  }

  process.exitCode = 1;

  if (result.status === 404) {
    console.log(`  Reading: ${result.body.message || "the feed published no service for this pair."}`);
    console.log("  The download and parse worked, so this is about station names or");
    console.log(`  coverage, not the source. Check that "${ORIGIN}" and "${DESTINATION}"`);
    console.log("  match the feed's stops.txt names under LTA_STATION_MATCH's filler words.");
    return;
  }

  console.log(`  Reading: ${result.body.message || "the official schedule is unavailable."}`);
  if (result.body.message?.includes("archive download returned")) {
    console.log("  The catalogue ZIP downloaded and named an archive, but that archive");
    console.log("  refused the request — LTA's signed link has expired and only LTA can");
    console.log("  refresh it. `sg-lta-gtfs` cannot substantiate departures until it does.");
  } else if (result.body.message?.includes("download returned")) {
    console.log("  The catalogue URL itself failed, so nothing downstream was reached.");
    console.log("  Confirm the URL still appears in LTA's published dataset catalogue.");
  }
  console.log("  The previously committed snapshot stays in service either way.");
}

void main();
