import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fareSources } from "../src/data/fareSources";
import { parseKorailWorkbook } from "./lib/korailTimetable";

// Pinned editions are deliberate: a new board layout/effective date needs review.
// --input replays unchanged operator downloads; online runs use bounded fetches.
const inputIndex = process.argv.indexOf("--input");
const input = inputIndex < 0 ? undefined : process.argv[inputIndex + 1];
const countryIndex = process.argv.indexOf("--country");
const onlyCountry = countryIndex < 0 ? undefined : process.argv[countryIndex + 1];
const observedOn = process.env.FARE_OBSERVED_ON || new Date().toISOString().slice(0, 10);
const work = await mkdtemp(join(tmpdir(), "transitrail-fares-"));
const output = "public/fares";
await mkdir(output, { recursive: true });
const python = process.env.FARE_PYTHON || "python3";
const reviewed = JSON.parse(await readFile("scripts/lib/fixtures/fare-reviewed-references.json", "utf8"));
type Evidence = { id: string; url: string; sha256: string; bytes: number; observedOn: string; effectiveFrom?: string };

async function download(id: string, url: string, format?: string, effectiveFrom?: string) {
  const bytes = input ? await readFile(join(input, `${id}.bin`))
    : Buffer.from(await (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
      return response.arrayBuffer();
    })());
  const evidence: Evidence = { id, url, observedOn, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, ...(effectiveFrom ? { effectiveFrom } : {}) };
  if (!format) return { evidence, data: undefined };
  const file = join(work, `${id}.bin`), json = join(work, `${id}.json`);
  await writeFile(file, bytes);
  execFileSync(python, ["scripts/lib/extract-fares.py", format, file, json], { stdio: "pipe", timeout: 120_000 });
  return { evidence, data: JSON.parse(await readFile(json, "utf8")) };
}

async function save(country: string, data: object) {
  const file = join(output, `${country}.json`);
  await writeFile(`${file}.tmp`, JSON.stringify({ schemaVersion: 1, country, observedOn, ...data }) + "\n");
  await rename(`${file}.tmp`, file);
  console.log(`Saved official fares: ${country}`);
}

const references: Record<string, { id?: string; url?: string; format?: string; reason: string }> = {
  japan: { format: "html-tables", reason: "Tokyo Metro distance bands require official tariff distance and special-section rules; no journey distance is inferred." },
  singapore: { format: "html-tables", reason: "PTC distance tables require an official chargeable journey distance, including transfer rules." },
  switzerland: { id: "switzerland-tariff", url: "https://www.allianceswisspass.ch/de/asp/Downloads?download=2700", format: "pdf-tables", reason: "T603 requires official tariff distance, route and fare conditions; no geographic distance substitution." },
  malaysia: { url: "https://www.ktmb.com.my/assets/pdf/2025/APPENDIX%201_TERMS%20AND%20CONDITIONS_%20ETS%2C%20INTERCITY%20%26%20SHUTTLE%20TICKET%20SEP%202025.pdf", reason: "ETS Flexi fares require the official journey quote; this document is terms, not an OD fare matrix." },
  france: { reason: "SNCF fares require service/date/product quote; no fixed journey price extracted." },
  belgium: { id: "belgium-terms", reason: "Tariff kilometres and product eligibility are required; no verified journey distance available." },
  germany: { reason: "Service/date/product quote required; advertised starting fares are excluded." },
  norway: { reason: "Ruter zone and passenger rules require verified journey zones; no zone inference." },
  thailand: { reason: "Official fare calculator requires an OD quote; page timetable tables are not fare tables." },
  united_kingdom: { reason: "TfL single fares depend on OD, route, payment and peak/off-peak; use official journey quotes." },
  china: { reason: "12306 published fare page is an OD/train query, not a downloadable country fare matrix." },
};

let failed = false;
try {
  for (const [country, source] of Object.entries(fareSources)) {
    if (onlyCountry && country !== onlyCountry) continue;
    try {
      if (country === "hong_kong") {
        const fares = await download("mtr-fares", source.url, "csv");
        const stations = await download("mtr-stations", "https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv", "csv");
        if (fares.data.length < 9000 || !fares.data.every((r: any) => r.SRC_STATION_ID && r.DEST_STATION_ID && Number.isFinite(Number(r.SINGLE_ADT_FARE)) && r.SINGLE_ADT_FARE.trim())) throw new Error("MTR fare matrix incomplete");
        await save(country, { status: "journey-match", sources: [fares.evidence, stations.evidence], stations: stations.data,
          columns: ["originId", "destinationId", "adultOctopus", "adultSingle"],
          rows: fares.data.map((r: any) => [r.SRC_STATION_ID, r.DEST_STATION_ID, Number(r.OCT_ADT_FARE), Number(r.SINGLE_ADT_FARE)]) });
      } else if (country === "korea") {
        const board = await download("korea", "https://www.korail.com/com/userBoard.do?mode=list&schBcid=ticketTable", "json");
        if (board.data.strResult !== "SUCC" || Number(board.data.totcnt) !== board.data.boardList?.length) throw new Error("Incomplete Korail fare board");
        const entries = [
          ["korail-1", "https://www.korail.com/file/cubedata/COMMON/jfile/202608/03/2026080319fc5eac2ff280.xls", "ktx", "2026-09-01"],
          ["korail-0", "https://www.korail.com/file/cubedata/COMMON/jfile/202608/19/202608191a018b939e5970.xlsx", "saemaeul", "2026-09-01"],
          ["korail-5", "https://www.korail.com/file/cubedata/COMMON/jfile/202608/19/202608191a018b9f3fe230.xls", "mugunghwa", "2025-09-27"],
        ];
        const documents = [];
        for (const [id, url, family, from] of entries) {
          const candidates = board.data.boardList.filter((row: any) => row.bdCode === "_ticketTable03" && !row.bdTitle.includes("까지")
            && (family === "ktx" ? /^KTX\s*운임표/.test(row.bdTitle) : family === "saemaeul" ? row.bdTitle.includes("ITX-새마을") : row.bdTitle.includes("무궁화")));
          const current = candidates.map((row: any) => {
            const date = row.bdTitle.match(/(20\d{2})[. ]+\s*(\d{1,2})[. ]+\s*(\d{1,2})/);
            if (!date) throw new Error("Unrecognized Korail fare effective date");
            return { row, date: `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}` };
          }).filter((entry: any) => entry.date <= observedOn).sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
          if (!current || current.date !== from || !current.row.fileId?.some((file: string) => url.endsWith(file))) throw new Error(`Korail ${family} edition changed; review before updating pins`);
          documents.push(await download(id, url, family, from));
        }
        // Official bilingual workbooks supply identity only. Do not export runs.
        const names = new Map<string, string>();
        for (const family of ["ktx", "regular"] as const) parseKorailWorkbook(await readFile(`scripts/lib/fixtures/korail-${family}-2026-09-01.xlsx`), family, names, () => {});
        await save(country, { status: "journey-match", sources: [board.evidence, ...documents.map(d => d.evidence)],
          stationNames: Object.fromEntries(names), columns: ["stationA", "stationB", "adultStandard", "adultFirstTotal"],
          tables: documents.flatMap(d => d.data.map((table: any) => ({ sourceId: d.evidence.id, ...table }))) });
      } else if (country === "united_states") {
        const doc = await download(country, source.url, "mbta");
        if (!doc.data.fare_products.length || !doc.data.fare_leg_rules.length || !doc.data.feed_info[0]?.feed_end_date) throw new Error("Incomplete MBTA fares");
        await save(country, { status: "journey-match", sources: [doc.evidence], gtfs: doc.data });
      } else {
        const ref = references[country];
        const doc = await download(ref.id || country, ref.url || source.url, ref.format);
        await save(country, { status: ref.format ? "reference-only" : "query-required", reason: ref.reason, sources: [doc.evidence], ...(doc.data ? { referenceTables: doc.data } : {}) });
      }
    } catch (error) {
      failed = true;
      console.error(`${country}: ${error instanceof Error ? error.message : error}. Previous snapshot preserved.`);
      // Initial unavailable records carry no fares; never replace successful data on failure.
      let previous;
      try { previous = JSON.parse(await readFile(join(output, `${country}.json`), "utf8")); } catch { /* No snapshot yet. */ }
      if (!previous || previous.status === "unavailable") await save(country, reviewed[country] || { status: "unavailable", reason: references[country]?.reason || "Official download unavailable", sources: [{ url: source.url, observedOn }], downloadStatus: "unavailable" });
    }
  }
} finally { await rm(work, { recursive: true, force: true }); }
if (failed) process.exitCode = 1;
