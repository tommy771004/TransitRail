import dotenv from "dotenv";
import { transitAppClient } from "../src/server/transitApp";
import { countryOptions } from "../src/data/countries";
import type { Country } from "../src/types";

dotenv.config();

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const globalRouteId = argument("--route");
const country = argument("--country");
const station = argument("--station");
const date = argument("--date");
if (!globalRouteId || !country || !station || !date || !countryOptions.includes(country as Country)) {
  throw new Error("Usage: npx tsx scripts/compare-transitapp-schedule.ts --country <market> --station <station> --route <runtime-route-id> --date YYYY-MM-DD");
}

const coverage = await transitAppClient.resolveCoverage({ country: country as Country, station });
const comparison = coverage.status === "available"
  ? await transitAppClient.compareSchedule({ globalRouteId, globalStopId: coverage.stopIds[0], date, allowedNetworkIds: coverage.networkIds })
  : { status: "unavailable", provider: "Transit" as const, requestedDate: date, retrievedAt: new Date().toISOString(), reason: coverage.reason ?? "coverage_unavailable" };
// This preview-only output is an operator QA signal, never a timetable source.
process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
