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
import "dotenv/config"; // load OPENROUTER_API_KEY (+ ALLOW_PAID_FALLBACK) from .env for the LLM cross-check
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Country, TransitLine, TransitResult } from "../src/types";
import { planJourney, type PlannerLine } from "./lib/transferPlanner";
import { llmResolveTransfer } from "./lib/llmTransfer";
import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
} from "../src/data/metroLines";
import { newCountryStationLists } from "../src/data/scraped/stations";

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
  /**
   * Present only for journeys that require changing lines. leg1Min + transferMin
   * + leg2Min must equal durationMin. Direct journeys omit this and get a single
   * [origin, destination] hop.
   */
  transfer?: {
    interchange: string;
    leg1Line: string;
    leg2Line: string;
    leg1Min: number;
    transferMin: number;
    leg2Min: number;
  };
}

const SEEDS: Seed[] = [
  // Singapore MRT (LTA) — SGD, high-frequency metro
  { country: "singapore", origin: "Changi Airport", destination: "Jurong East", code: "sg-cha-jur", operator: "SMRT", service: "East West Line", currency: "SGD", price: 2.30, durationMin: 55, kind: "metro",
    transfer: { interchange: "Tanah Merah", leg1Line: "East West Line (Changi Branch)", leg2Line: "East West Line", leg1Min: 8, transferMin: 4, leg2Min: 43 } },
  { country: "singapore", origin: "HarbourFront", destination: "Punggol", code: "sg-hbf-pun", operator: "SBS Transit", service: "North East Line", currency: "SGD", price: 1.99, durationMin: 33, kind: "metro" },
  { country: "singapore", origin: "Jurong East", destination: "Raffles Place", code: "sg-jur-raf", operator: "SMRT", service: "East West Line", currency: "SGD", price: 1.79, durationMin: 32, kind: "metro" },
  { country: "singapore", origin: "Woodlands", destination: "Orchard", code: "sg-wdl-orc", operator: "SMRT", service: "North South Line", currency: "SGD", price: 2.09, durationMin: 38, kind: "metro" },
  // Bangkok BTS/MRT — THB, high-frequency metro
  { country: "thailand", origin: "Mo Chit", destination: "Hua Lamphong", code: "th-moc-hua", operator: "BTS/MRT", service: "BTS Sukhumvit → MRT Blue", currency: "THB", price: 42, durationMin: 28, kind: "metro",
    // Interchange at the origin: Mo Chit (BTS) ⇄ Chatuchak Park (MRT Blue) are the
    // adjacent connected stations, so the journey is a short interchange + one MRT ride.
    transfer: { interchange: "Chatuchak Park", leg1Line: "BTS Sukhumvit Line", leg2Line: "MRT Blue Line", leg1Min: 4, transferMin: 4, leg2Min: 20 } },
  { country: "thailand", origin: "Siam", destination: "Mo Chit", code: "th-sia-moc", operator: "BTS", service: "Sukhumvit Line", currency: "THB", price: 33, durationMin: 14, kind: "metro" },
  { country: "thailand", origin: "Siam", destination: "Saphan Taksin", code: "th-sia-sap", operator: "BTS", service: "Silom Line", currency: "THB", price: 30, durationMin: 12, kind: "metro" },
  { country: "thailand", origin: "Sukhumvit", destination: "Hua Lamphong", code: "th-suk-hua", operator: "MRT", service: "Blue Line", currency: "THB", price: 33, durationMin: 16, kind: "metro" },
  // China HSR (12306) — CNY, intercity
  { country: "china", origin: "Beijing South", destination: "Nanjing South", code: "cn-bjs-njs", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 445, durationMin: 220, kind: "hsr" },
  { country: "china", origin: "Beijing South", destination: "Shanghai Hongqiao", code: "cn-bjs-shq", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 553, durationMin: 270, kind: "hsr" },
  { country: "china", origin: "Guangzhou South", destination: "Shenzhen North", code: "cn-gzs-szn", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 75, durationMin: 32, kind: "hsr" },
  { country: "china", origin: "Shanghai Hongqiao", destination: "Hangzhou East", code: "cn-shq-hze", operator: "China Railway", service: "High-Speed Rail (G)", currency: "CNY", price: 73, durationMin: 60, kind: "hsr" },
  // Boston MBTA — USD, flat-fare metro/light rail
  { country: "united_states", origin: "Harvard", destination: "Logan International Airport", code: "us-har-log", operator: "MBTA", service: "Red Line → Silver Line", currency: "USD", price: 2.40, durationMin: 42, kind: "metro",
    transfer: { interchange: "South Station", leg1Line: "Red Line", leg2Line: "Silver Line SL1", leg1Min: 18, transferMin: 6, leg2Min: 18 } },
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

// --- topology: real line data for deterministic interchange resolution -------
const adaptLines = (lines: TransitLine[]): PlannerLine[] =>
  lines.map((l) => ({ name: l.name, stations: l.stations.map((s) => s.name) }));

const PLANNER_LINES: Partial<Record<Country, PlannerLine[]>> = {
  singapore: adaptLines(singaporeMrtLines),
  thailand: adaptLines(thailandTransitLines),
  china: adaptLines(chinaRailLines),
  germany: adaptLines(germanyRailLines),
  france: adaptLines(franceRailLines),
};

// Station names per country, used to validate an LLM-proposed interchange.
function stationList(country: Country): string[] {
  const fromLines = (PLANNER_LINES[country] || []).flatMap((l) => l.stations);
  const fromCurated = newCountryStationLists[country] || [];
  return Array.from(new Set([...fromCurated, ...fromLines]));
}

interface Resolution {
  direct: boolean;
  stops: string[];
  transfer?: {
    interchange: string;
    leg1: { line: string; stops: string[]; min: number };
    leg2: { line: string; stops: string[]; min: number };
    transferMin: number;
  };
  source: "topology-direct" | "topology-transfer" | "curated-transfer" | "llm-confirmed" | "assumed-direct";
  note?: string;
}

/**
 * Decide a route's real shape: prefer deterministic topology; fall back to the
 * curated transfer (optionally refined by the LLM gap-filler when a key is set)
 * where the static line data can't resolve the interchange.
 */
async function resolveRouting(seed: Seed): Promise<Resolution> {
  const lines = PLANNER_LINES[seed.country];
  const topo = lines ? planJourney(lines, seed.origin, seed.destination) : null;

  if (seed.transfer) {
    // Curated as a transfer — topology can't resolve these (branch stations,
    // cross-network interchanges under different names, no static topology).
    // The free-model LLM is an ADVISORY cross-check only: it confirms or flags
    // the curated interchange but never overwrites it. A probe (2026-07-06)
    // showed free models return plausible-but-wrong interchanges for 2 of these
    // 3 routes (e.g. Mo Chit→Hua Lamphong "via Makkasan"), which pass the
    // membership+duration validator yet are geographically wrong.
    const c = seed.transfer;
    const same = (a: string, b: string) => a.toLowerCase().trim() === b.toLowerCase().trim();
    let source: Resolution["source"] = "curated-transfer";
    let note: string | undefined;
    const llm = await llmResolveTransfer(seed.country, seed.origin, seed.destination, stationList(seed.country), seed.durationMin);
    if (llm && same(llm.interchange, c.interchange)) {
      source = "llm-confirmed";
      note = `LLM confirmed interchange ${c.interchange}`;
    } else if (llm) {
      note = `LLM proposed ${llm.interchange} via ${llm.leg1Line}→${llm.leg2Line} (differs from curated ${c.interchange}) — kept curated; free-model routing is unreliable here, review before trusting`;
    } else if (topo && topo.direct) {
      note = `topology said direct (${topo.hops} hops) but the branch/cross-network data is unreliable here — kept curated transfer`;
    }
    return {
      direct: false,
      stops: [seed.origin, c.interchange, seed.destination],
      transfer: {
        interchange: c.interchange,
        leg1: { line: c.leg1Line, stops: [seed.origin, c.interchange], min: c.leg1Min },
        leg2: { line: c.leg2Line, stops: [c.interchange, seed.destination], min: c.leg2Min },
        transferMin: c.transferMin,
      },
      source,
      note,
    };
  }

  // Curated as direct.
  if (topo && topo.direct) {
    return { direct: true, stops: topo.legs[0].stops, source: "topology-direct" };
  }
  if (topo && !topo.direct) {
    // Topology found a transfer we hadn't curated — trust it; split minutes by hops.
    const h1 = topo.legs[0].stops.length - 1;
    const h2 = topo.legs[1].stops.length - 1;
    const transferMin = 5;
    const ride = Math.max(seed.durationMin - transferMin, h1 + h2);
    const leg1Min = Math.max(1, Math.round((ride * h1) / (h1 + h2)));
    return {
      direct: false,
      stops: [...topo.legs[0].stops, ...topo.legs[1].stops.slice(1)],
      transfer: {
        interchange: topo.interchange!,
        leg1: { line: topo.legs[0].line, stops: topo.legs[0].stops, min: leg1Min },
        leg2: { line: topo.legs[1].line, stops: topo.legs[1].stops, min: ride - leg1Min },
        transferMin,
      },
      source: "topology-transfer",
    };
  }
  // No static topology (UK/US) — trust the curated direct classification.
  return { direct: true, stops: [seed.origin, seed.destination], source: "assumed-direct" };
}

function generate(seed: Seed, res: Resolution): TransitResult[] {
  const step = seed.kind === "metro" ? 10 : 30;
  const startMin = seed.kind === "metro" ? 5 * 60 + 30 : 6 * 60;
  const endMin = seed.kind === "metro" ? 23 * 60 + 30 : 22 * 60;
  const tr = res.transfer;
  const total = tr ? tr.leg1.min + tr.transferMin + tr.leg2.min : seed.durationMin;

  const out: TransitResult[] = [];
  for (const date of DATES) {
    let i = 0;
    for (let m = startMin; m <= endMin; m += step) {
      const result: TransitResult = {
        id: `${date}-${seed.code}-${i}`,
        country: seed.country,
        operator: seed.operator,
        service: seed.service,
        departureTime: fmt(m),
        arrivalTime: fmt(m + total),
        durationMinutes: total,
        price: seed.price,
        currency: seed.currency,
        origin: seed.origin,
        destination: seed.destination,
        direct: res.direct,
        stops: res.stops,
        date,
      };
      if (tr) {
        const leg1Arr = m + tr.leg1.min;
        const leg2Dep = leg1Arr + tr.transferMin;
        result.transferStations = [tr.interchange];
        result.legs = [
          { lineName: tr.leg1.line, origin: seed.origin, destination: tr.interchange, departureTime: fmt(m), arrivalTime: fmt(leg1Arr), durationMinutes: tr.leg1.min, stopCount: tr.leg1.stops.length - 1 },
          { lineName: tr.leg2.line, origin: tr.interchange, destination: seed.destination, departureTime: fmt(leg2Dep), arrivalTime: fmt(leg2Dep + tr.leg2.min), durationMinutes: tr.leg2.min, stopCount: tr.leg2.stops.length - 1 },
        ];
      }
      out.push(result);
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

// Resolve each seed's real routing shape up-front (topology + optional LLM
// gap-fill). Done once here, not per departure.
const resolutions = new Map<string, Resolution>();
for (const seed of SEEDS) resolutions.set(seed.code, await resolveRouting(seed));

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

    // 2) (re)seed curated routes: fill empty files, and refresh files that
    //    already hold seed-generated data so format changes (e.g. transfer
    //    legs) propagate. Never overwrites real scraped data (different ids).
    let seeded = false;
    const seed = findSeed(country, data.origin, data.destination);
    if (seed) {
      const isSeedData = results.length === 0 || results.every((r) => baseId(r.id).startsWith(`${seed.code}-`));
      if (isSeedData) {
        results = generate(seed, resolutions.get(seed.code)!);
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

console.log("\nRouting reconciliation (how each route's shape was decided):");
const gaps: string[] = [];
for (const seed of SEEDS) {
  const r = resolutions.get(seed.code)!;
  const shape = r.direct ? "direct" : `transfer@${r.transfer!.interchange}`;
  console.log(`  [${r.source}] ${seed.country} ${seed.origin}→${seed.destination}: ${shape}${r.note ? ` — ${r.note}` : ""}`);
  if (!r.direct && (r.source === "curated-transfer" || r.source === "llm-confirmed")) gaps.push(`${seed.country} ${seed.origin}→${seed.destination}`);
}
if (gaps.length > 0 && !process.env.OPENROUTER_API_KEY) {
  console.log(`\n${gaps.length} transfer route(s) fell back to curated interchanges (topology could not resolve them).`);
  console.log("Set OPENROUTER_API_KEY to let the LLM gap-filler (scripts/lib/llmTransfer.ts) refine them:");
  gaps.forEach((g) => console.log(`  - ${g}`));
}
