/**
 * One-off maintenance:
 *   1. De-duplicate every scraped route file (per date, keep one row per
 *      base departure id) — repairs the historical duplication caused by the
 *      old loadSnapshot behaviour.
 *   2. Seed curated timetables into any route file that has 0 results, so the
 *      snapshot-backed countries (SG/TH/CN/US/UK/FR/DE) show departures instead
 *      of an empty list.
 *   3. Recompute each country's metadata.json from its files (preserving the
 *      existing scraper name and lastScraped timestamp).
 *
 * Idempotent: re-running dedupes nothing new and re-seeds nothing already full.
 * Run: npx tsx scripts/seed-curated-snapshots.ts
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Country, TransitResult } from "../src/types";

const DATA_DIR = resolve("src/data/scraped");

// Window mirrors the daily scraper (7 days from the last scrape date).
const WINDOW_START = "2026-07-06";
const WINDOW_DAYS = 7;

function addDays(date: string, offset: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split("T")[0];
}
const DATES = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(WINDOW_START, i));
const DATE_LABEL = `${DATES[0]}..${DATES[DATES.length - 1]}`;

const baseId = (id: string) => id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const fmt = (minutes: number) => {
  const n = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

// --- de-dupe: keep first row per (date, base id) -----------------------------
function dedupe(results: TransitResult[]): TransitResult[] {
  const seen = new Set<string>();
  const out: TransitResult[] = [];
  for (const r of results) {
    const k = `${r.date ?? ""}|${baseId(r.id)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

// --- seed table for the empty curated snapshots ------------------------------
interface Seed {
  country: Country;
  origin: string;
  destination: string;
  code: string;
  operator: string;
  service: string;
  currency: string;
  price: number;
  durationMin: number;
  kind: "metro" | "hsr";
}

const SEEDS: Seed[] = [
  // Singapore MRT (LTA) — SGD, high-frequency metro
  { country: "singapore", origin: "Changi Airport", destination: "Jurong East", code: "sg-cha-jur", operator: "SMRT", service: "East West Line", currency: "SGD", price: 2.30, durationMin: 55, kind: "metro" },
  { country: "singapore", origin: "HarbourFront", destination: "Punggol", code: "sg-hbf-pun", operator: "SBS Transit", service: "North East Line", currency: "SGD", price: 1.99, durationMin: 33, kind: "metro" },
  { country: "singapore", origin: "Jurong East", destination: "Raffles Place", code: "sg-jur-raf", operator: "SMRT", service: "East West Line", currency: "SGD", price: 1.79, durationMin: 32, kind: "metro" },
  { country: "singapore", origin: "Woodlands", destination: "Orchard", code: "sg-wdl-orc", operator: "SMRT", service: "North South Line", currency: "SGD", price: 2.09, durationMin: 38, kind: "metro" },
  // Bangkok BTS/MRT — THB, high-frequency metro
  { country: "thailand", origin: "Mo Chit", destination: "Hua Lamphong", code: "th-moc-hua", operator: "BTS/MRT", service: "Sukhumvit + Blue Line", currency: "THB", price: 42, durationMin: 28, kind: "metro" },
  { country: "thailand", origin: "Siam", destination: "Mo Chit", code: "th-sia-moc", operator: "BTS", service: "Sukhumvit Line", currency: "THB", price: 33, durationMin: 14, kind: "metro" },
  { country: "thailand", origin: "Siam", destination: "Saphan Taksin", code: "th-sia-sap", operator: "BTS", service: "Silom Line", currency: "THB", price: 30, durationMin: 12, kind: "metro" },
  { country: "thailand", origin: "Sukhumvit", destination: "Hua Lamphong", code: "th-suk-hua", operator: "MRT", service: "Blue Line", currency: "THB", price: 33, durationMin: 16, kind: "metro" },
  // China HSR (12306) — CNY, intercity
  { country: "china", origin: "Beijing South", destination: "Nanjing South", code: "cn-bjs-njs", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 445, durationMin: 220, kind: "hsr" },
  { country: "china", origin: "Beijing South", destination: "Shanghai Hongqiao", code: "cn-bjs-shq", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 553, durationMin: 270, kind: "hsr" },
  { country: "china", origin: "Guangzhou South", destination: "Shenzhen North", code: "cn-gzs-szn", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 75, durationMin: 32, kind: "hsr" },
  { country: "china", origin: "Shanghai Hongqiao", destination: "Hangzhou East", code: "cn-shq-hze", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 73, durationMin: 60, kind: "hsr" },
  // Boston MBTA — USD, flat-fare metro/light rail
  { country: "united_states", origin: "Harvard", destination: "Logan International Airport", code: "us-har-log", operator: "MBTA", service: "Red Line + Silver Line", currency: "USD", price: 2.40, durationMin: 42, kind: "metro" },
  { country: "united_states", origin: "Park Street", destination: "Andrew", code: "us-prk-and", operator: "MBTA", service: "Red Line", currency: "USD", price: 2.40, durationMin: 11, kind: "metro" },
  { country: "united_states", origin: "Park Street", destination: "Boston College", code: "us-prk-bos", operator: "MBTA", service: "Green Line B", currency: "USD", price: 2.40, durationMin: 38, kind: "metro" },
  { country: "united_states", origin: "South Station", destination: "Harvard", code: "us-sth-har", operator: "MBTA", service: "Red Line", currency: "USD", price: 2.40, durationMin: 14, kind: "metro" },
  // London TfL — GBP, flat-fare tube
  { country: "united_kingdom", origin: "King's Cross St. Pancras Underground Station", destination: "Oxford Circus Underground Station", code: "uk-kgx-oxc", operator: "TfL", service: "Victoria line", currency: "GBP", price: 2.80, durationMin: 6, kind: "metro" },
  { country: "united_kingdom", origin: "Leicester Square", destination: "Camden Town", code: "uk-lei-cam", operator: "TfL", service: "Northern line", currency: "GBP", price: 2.80, durationMin: 11, kind: "metro" },
  // France TGV (SNCF) — EUR, intercity
  { country: "france", origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu", code: "fr-pgl-lpd", operator: "SNCF", service: "TGV inOui", currency: "EUR", price: 65, durationMin: 116, kind: "hsr" },
  { country: "france", origin: "Paris Gare de Lyon", destination: "Marseille St-Charles", code: "fr-pgl-mrs", operator: "SNCF", service: "TGV inOui", currency: "EUR", price: 89, durationMin: 190, kind: "hsr" },
  { country: "france", origin: "Paris Gare du Nord", destination: "Lille Europe", code: "fr-pgn-lle", operator: "SNCF", service: "TGV inOui", currency: "EUR", price: 45, durationMin: 62, kind: "hsr" },
  // Germany ICE (DB) — EUR, intercity
  { country: "germany", origin: "Berlin Hbf", destination: "Munich Hbf", code: "de-ber-mun", operator: "DB", service: "ICE", currency: "EUR", price: 69.9, durationMin: 235, kind: "hsr" },
];

function generate(seed: Seed): TransitResult[] {
  const step = seed.kind === "metro" ? 10 : 30;
  const startMin = seed.kind === "metro" ? 5 * 60 + 30 : 6 * 60;
  const endMin = seed.kind === "metro" ? 23 * 60 + 30 : 22 * 60;
  const out: TransitResult[] = [];
  for (const date of DATES) {
    let i = 0;
    for (let m = startMin; m <= endMin; m += step) {
      out.push({
        id: `${date}-${seed.code}-${i}`,
        country: seed.country,
        operator: seed.operator,
        service: seed.service,
        departureTime: fmt(m),
        arrivalTime: fmt(m + seed.durationMin),
        durationMinutes: seed.durationMin,
        price: seed.price,
        currency: seed.currency,
        origin: seed.origin,
        destination: seed.destination,
        direct: true,
        stops: [seed.origin, seed.destination],
        date,
      });
      i += 1;
    }
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().trim();
function findSeed(country: string, origin: string, destination: string): Seed | undefined {
  return SEEDS.find(
    (s) => s.country === country && norm(s.origin) === norm(origin) && norm(s.destination) === norm(destination),
  );
}

interface RouteFile {
  origin: string;
  destination: string;
  date: string;
  scrapedAt: string;
  source: string;
  results: TransitResult[];
}

const COUNTRIES = readdirSync(DATA_DIR).filter((entry) =>
  statSync(resolve(DATA_DIR, entry)).isDirectory(),
);

const seededSlugs: string[] = [];
let dedupedRows = 0;
let seededRows = 0;

for (const country of COUNTRIES) {
  const dir = resolve(DATA_DIR, country);
  if (!existsSync(dir)) continue;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file === "metadata.json") continue;
    const path = resolve(dir, file);
    const data = JSON.parse(readFileSync(path, "utf-8")) as RouteFile;

    // 1) de-dupe
    const before = data.results.length;
    let results = dedupe(data.results);
    const removed = before - results.length;
    if (removed > 0) dedupedRows += removed;

    // 2) seed if empty and we have a curated timetable for it
    let seeded = false;
    if (results.length === 0) {
      const seed = findSeed(country, data.origin, data.destination);
      if (seed) {
        results = generate(seed);
        seeded = true;
        seededRows += results.length;
        seededSlugs.push(`${country}/${file}`);
      }
    }

    if (removed > 0 || seeded) {
      const updated: RouteFile = {
        ...data,
        date: seeded ? DATE_LABEL : data.date,
        scrapedAt: seeded ? new Date().toISOString() : data.scrapedAt,
        results,
      };
      writeFileSync(path, JSON.stringify(updated, null, 2) + "\n", "utf-8");
      if (removed > 0) console.log(`  dedupe  ${country}/${file}: ${before} -> ${results.length}`);
      if (seeded) console.log(`  seed    ${country}/${file}: ${results.length} departures (${DATE_LABEL})`);
    }
  }
}

// 3) recompute metadata.json per country (preserve scraper + lastScraped)
for (const country of COUNTRIES) {
  const dir = resolve(DATA_DIR, country);
  const metaPath = resolve(dir, "metadata.json");
  if (!existsSync(metaPath)) continue;
  const existing = JSON.parse(readFileSync(metaPath, "utf-8"));

  const routes = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "metadata.json")
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf-8")) as RouteFile)
    .sort((a, b) => `${a.origin}-${a.destination}`.localeCompare(`${b.origin}-${b.destination}`))
    .map((r) => ({ origin: r.origin, destination: r.destination, resultCount: r.results.length, date: r.date }));

  writeFileSync(
    metaPath,
    JSON.stringify({
      country,
      scraper: existing.scraper,
      lastScraped: existing.lastScraped,
      routeCount: routes.length,
      routes,
    }, null, 2) + "\n",
    "utf-8",
  );
}

console.log(`\nDone. Deduped ${dedupedRows} duplicate rows; seeded ${seededSlugs.length} empty files (${seededRows} rows).`);
if (seededSlugs.length !== SEEDS.length) {
  console.warn(`⚠ Expected to seed ${SEEDS.length} files but seeded ${seededSlugs.length} — some empty files did not match a seed entry (check origin/destination spelling).`);
}
