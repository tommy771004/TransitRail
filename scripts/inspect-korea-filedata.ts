/**
 * Inspect a Korean open-data timetable file before writing any adapter.
 *
 * This is the no-registration path. data.go.kr splits its catalogue into
 * 오픈API (needs a serviceKey, which needs an account that a foreign applicant
 * may not be able to open) and 파일데이터, which downloads without logging in.
 * For this project the file is arguably the better fit: search needs departures
 * for a given date, not realtime arrivals, so a timetable refreshed on the
 * daily job has no key, no quota and no runtime dependency on a provider.
 *
 * The file cannot be fetched from this repo's CI sandbox (egress policy denies
 * *.data.go.kr), so download it in a browser and point this script at it:
 *
 *   npx tsx scripts/inspect-korea-filedata.ts <path-to.csv>
 *
 * It reports the encoding, the columns, and — the thing that actually decides
 * whether the dataset is worth adopting — whether the stations the app
 * currently 404s on are present with real departure times.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

/** Stations the app cannot answer for today; see docs/korea-api-registration.md. */
const TARGET_STATIONS = ["시청", "충정로", "청량리", "을지로입구", "서울역"];

/** Column names these datasets are known to use, by role. */
const COLUMN_HINTS: Record<string, string[]> = {
  station: ["역사명", "역명", "전철역명", "STATION_NM", "역사코드", "전철역코드"],
  arrival: ["도착시간", "도착시각", "ARRIVETIME", "ARRIVE_TIME"],
  departure: ["출발시간", "출발시각", "DEPARTTIME", "DEPART_TIME", "LEFTTIME"],
  direction: ["방향", "상하행", "상하행구분", "INOUT_TAG", "UPDOWN"],
  line: ["호선", "노선", "LINE_NUM", "선명"],
  dayType: ["요일구분", "평일구분", "WEEK_TAG", "운행요일"],
  terminus: ["도착역", "출발역", "종착역", "행선지"],
};

/**
 * Korean government CSVs are still commonly CP949/EUC-KR rather than UTF-8.
 * Decoding one as UTF-8 yields mojibake that silently fails every station
 * comparison, so detect rather than assume.
 */
function decode(buffer: Buffer): { text: string; encoding: string } {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(buffer.subarray(3)), encoding: "utf-8 (BOM)" };
  }

  const asUtf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  // U+FFFD only appears when a byte sequence was not valid UTF-8.
  if (!asUtf8.includes("�")) {
    return { text: asUtf8, encoding: "utf-8" };
  }

  // Node ships euc-kr, which covers the CP949 range these files use in practice.
  const asEucKr = new TextDecoder("euc-kr", { fatal: false }).decode(buffer);
  const eucKrBad = (asEucKr.match(/�/g) || []).length;
  const utf8Bad = (asUtf8.match(/�/g) || []).length;
  return eucKrBad < utf8Bad
    ? { text: asEucKr, encoding: "euc-kr / cp949" }
    : { text: asUtf8, encoding: "utf-8 (with replacement chars — check the source)" };
}

/** Minimal RFC4180-ish split: handles quoted fields containing commas. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function classify(headers: string[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const [role, hints] of Object.entries(COLUMN_HINTS)) {
    const matches = headers.filter((h) =>
      hints.some((hint) => h.replace(/\s/g, "").toUpperCase().includes(hint.toUpperCase())),
    );
    if (matches.length > 0) found[role] = matches;
  }
  return found;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.log(`Usage: npx tsx scripts/inspect-korea-filedata.ts <file.csv>

Download one of these first (파일데이터 needs no login):

  15098251  서울교통공사_서울 도시철도 열차운행시각표   ← subway 1–9호선, the one to get
            https://www.data.go.kr/data/15098251/fileData.do
  15153740  한국철도공사_열차정보
            https://www.data.go.kr/data/15153740/fileData.do

Do NOT use 15042241 (한국철도공사_화물열차운행 시간표) — that is freight, not passenger.`);
    process.exitCode = 1;
    return;
  }

  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`No such file: ${full}`);
    process.exitCode = 1;
    return;
  }

  const buffer = readFileSync(full);
  const { text, encoding } = decode(buffer);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  console.log(`\n=== ${basename(full)} ===`);
  console.log(`  size      ${(buffer.length / 1024).toFixed(1)} KiB`);
  console.log(`  encoding  ${encoding}`);
  console.log(`  rows      ${lines.length - 1} (excluding header)`);

  if (lines.length < 2) {
    console.error("  ✗ No data rows.");
    process.exitCode = 1;
    return;
  }

  const headers = splitRow(lines[0]);
  console.log(`\n  columns (${headers.length}):`);
  console.log(`    ${headers.join(" | ")}`);

  const roles = classify(headers);
  console.log("\n  column roles detected:");
  for (const role of Object.keys(COLUMN_HINTS)) {
    const hit = roles[role];
    console.log(`    ${role.padEnd(10)} ${hit ? `✓ ${hit.join(", ")}` : "✗ none matched"}`);
  }

  const missing = ["station", "departure"].filter((r) => !roles[r]);
  if (missing.length > 0) {
    console.log(`\n  ⚠ Missing ${missing.join(" and ")} — this file cannot answer a`);
    console.log("    departure search on its own. Check whether it is a station list");
    console.log("    or a statistics extract rather than a timetable.");
  }

  console.log("\n  sample row:");
  const sample = splitRow(lines[1]);
  headers.forEach((h, i) => console.log(`    ${h.padEnd(16)} = ${sample[i] ?? ""}`));

  // The decisive question: are the stations we currently fail on actually here?
  console.log("\n  coverage of stations the app currently 404s on:");
  const body = lines.slice(1).join("\n");
  for (const station of TARGET_STATIONS) {
    const count = body.split(station).length - 1;
    console.log(`    ${station.padEnd(8)} ${count > 0 ? `✓ ${count} row(s)` : "✗ absent"}`);
  }

  console.log(`
  Next: if station + departure columns are present and the target stations
  appear, record the column names in docs/korea-api-registration.md §D and
  write the adapter against this file. Do not hand-author snapshot rows to
  fill any station this file does not cover.
`);
}

main();
