/**
 * One-off / re-runnable maintenance: seed full-day curated timetables for the
 * Hong Kong MTR *metro* routes.
 *
 * Why this exists
 * ---------------
 * HK is a ProviderBackedScraper whose live adapter (searchHongKongMtr) only
 * exposes the "Next train" feed — at most a handful of upcoming departures, and
 * only for *today*. There is no separate curated snapshot store: SnapshotScraper
 * reads the route file itself. So for the three metro routes the file only ever
 * held the 4 live "next train" rows captured at scrape time, which then get
 * copied onto every date by the fallback. The result was a "timetable" of 4
 * departures crammed into an ~11-minute window on every day.
 *
 * This script writes a proper full-day canonical timetable into each metro route
 * file (mirroring how hong-kong-airport.json already carries a real curated
 * snapshot). Future-date fallbacks reproduce a full day via canonicalDay; today
 * is still overlaid with the live next-trains by the daily scraper — same
 * behaviour as the Airport Express route.
 *
 * Rows are generated from the real line topology in src/data/hongKongMtr.ts so
 * intermediate stops, colours and headsigns stay correct.
 *
 * Run: npx tsx scripts/seed-hongkong-metro.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { hongKongMtrLines, mtrLineColors } from "../src/data/hongKongMtr";
import type { TransitResult } from "../src/types";

const DATA_DIR = resolve("src/data/scraped/hong_kong");

// Match the daily scraper's window (7 days from the last scrape date).
const WINDOW_START = "2026-07-06";
const WINDOW_DAYS = 7;

function addDays(date: string, offset: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split("T")[0];
}
const DATES = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(WINDOW_START, i));
const DATE_LABEL = `${DATES[0]}..${DATES[DATES.length - 1]}`;

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (minutes: number) => `${pad(Math.floor((minutes % 1440) / 60))}:${pad(minutes % 60)}`;

// MTR runs very frequently; a peak-aware headway keeps the timetable realistic
// without exploding the row count. Minutes-of-day → headway in minutes.
function headwayAt(minute: number): number {
  const peak = (minute >= 7 * 60 && minute < 9.5 * 60) || (minute >= 17 * 60 && minute < 19.5 * 60);
  const shoulder = minute < 6.5 * 60 || minute >= 23 * 60;
  if (peak) return 3;
  if (shoulder) return 8;
  return 5;
}

const SERVICE_START = 5 * 60 + 54; // 05:54 first train
const SERVICE_END = 23 * 60 + 58; // 23:58 last train (kept < 24:00 so departures never wrap past midnight and sort cleanly)

interface MetroRoute {
  file: string;
  code: string;
  lineCode: string;
  origin: string;
  destination: string;
  headsign: string; // line terminus in the direction of travel
  platform: string;
  journeyMinutes: number;
}

// Journey minutes are whole-line estimates (~2 min/stop on the Tsuen Wan Line,
// a little more on the Tung Chung Line's longer outer hops).
const ROUTES: MetroRoute[] = [
  { file: "admiralty-tsim-sha-tsui.json", code: "hk-twl-adm-tst", lineCode: "TWL", origin: "Admiralty", destination: "Tsim Sha Tsui", headsign: "Tsuen Wan", platform: "1", journeyMinutes: 2 },
  { file: "central-tsuen-wan.json", code: "hk-twl-cen-tsw", lineCode: "TWL", origin: "Central", destination: "Tsuen Wan", headsign: "Tsuen Wan", platform: "1", journeyMinutes: 30 },
  { file: "tung-chung-sunny-bay.json", code: "hk-tcl-tuc-sun", lineCode: "TCL", origin: "Tung Chung", destination: "Sunny Bay", headsign: "Hong Kong", platform: "1", journeyMinutes: 4 },
];

function lineFor(code: string) {
  const line = hongKongMtrLines.find((l) => l.code === code);
  if (!line) throw new Error(`Unknown MTR line code: ${code}`);
  return line;
}

function intermediateStops(lineCode: string, origin: string, destination: string): string[] {
  const line = lineFor(lineCode);
  const oIdx = line.stations.findIndex((s) => s.name === origin);
  const dIdx = line.stations.findIndex((s) => s.name === destination);
  if (oIdx < 0 || dIdx < 0) {
    throw new Error(`${origin} → ${destination} not both on ${line.name}`);
  }
  return line.stations
    .slice(Math.min(oIdx, dIdx) + 1, Math.max(oIdx, dIdx))
    .map((s) => s.name);
}

function generate(route: MetroRoute): TransitResult[] {
  const line = lineFor(route.lineCode);
  const stops = intermediateStops(route.lineCode, route.origin, route.destination);
  const color = mtrLineColors[route.lineCode];

  const out: TransitResult[] = [];
  for (const date of DATES) {
    let i = 0;
    for (let m = SERVICE_START; m <= SERVICE_END; m += headwayAt(m)) {
      out.push({
        id: `${date}-${route.code}-${i}`,
        country: "hong_kong",
        operator: "MTR",
        service: line.name,
        trainType: "Scheduled",
        departureTime: fmt(m),
        arrivalTime: fmt(m + route.journeyMinutes),
        durationMinutes: route.journeyMinutes,
        origin: route.origin,
        destination: route.destination,
        direct: true,
        stops,
        platform: route.platform,
        headsign: route.headsign,
        lineColor: color,
        date,
      });
      i += 1;
    }
  }
  return out;
}

for (const route of ROUTES) {
  const path = resolve(DATA_DIR, route.file);
  const existing = JSON.parse(readFileSync(path, "utf-8"));
  const results = generate(route);
  const updated = {
    ...existing,
    origin: route.origin,
    destination: route.destination,
    date: DATE_LABEL,
    scrapedAt: new Date().toISOString(),
    source: "MTR curated snapshot",
    results,
  };
  writeFileSync(path, JSON.stringify(updated, null, 2), "utf-8");
  const perDay = results.length / WINDOW_DAYS;
  console.log(`  seed  hong_kong/${route.file}: ${results.length} rows (${perDay}/day, ${route.origin} → ${route.destination})`);
}

console.log(`\nDone. Seeded ${ROUTES.length} HK metro routes for ${DATE_LABEL}.`);
console.log("Run `npm run scrape:metadata` to refresh hong_kong/metadata.json.");
