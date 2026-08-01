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
 * whether the dataset is worth adopting — how many rows name a station the
 * app's menu can actually reach. Exits non-zero when the file cannot answer a
 * departure search, so it can gate a script.
 *
 * The parsing lives in src/data/koreaFileData.ts because the timetable adapter
 * needs it too; this file is the CLI around it.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { pathToFileURL } from "url";
import { COLUMN_HINTS, inspectFileData } from "../src/data/koreaFileData";

export { classify, decode, inspectFileData, splitRow } from "../src/data/koreaFileData";
export type { FileDataReport } from "../src/data/koreaFileData";

function usage() {
  console.log(`Usage: npx tsx scripts/inspect-korea-filedata.ts <file.csv>

Download one of these first (파일데이터 needs no login):

  15098251  서울교통공사_서울 도시철도 열차운행시각표   ← subway 1–9호선, the one to get
            https://www.data.go.kr/data/15098251/fileData.do
  15153740  한국철도공사_열차정보
            https://www.data.go.kr/data/15153740/fileData.do

Do NOT use 15042241 (한국철도공사_화물열차운행 시간표) — that is freight, not passenger.`);
}

function main() {
  const path = process.argv[2];
  if (!path) {
    usage();
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
  const report = inspectFileData(buffer);

  console.log(`\n=== ${basename(full)} ===`);
  console.log(`  size      ${(buffer.length / 1024).toFixed(1)} KiB`);
  console.log(`  encoding  ${report.encoding}`);
  console.log(`  rows      ${report.rowCount} (excluding header)`);

  if (report.rowCount === 0) {
    console.error("\n  ✗ No data rows.");
    process.exitCode = 1;
    return;
  }

  console.log(`\n  columns (${report.headers.length}):`);
  console.log(`    ${report.headers.join(" | ")}`);

  console.log("\n  column roles detected:");
  for (const role of Object.keys(COLUMN_HINTS)) {
    const hit = report.roles[role];
    console.log(`    ${role.padEnd(12)} ${hit ? `✓ ${hit.join(", ")}` : "✗ none matched"}`);
  }

  console.log("\n  sample row:");
  report.headers.forEach((h, i) => console.log(`    ${h.padEnd(16)} = ${report.sample[i] ?? ""}`));

  if (!report.usable) {
    console.log(`\n  ⚠ Missing ${report.missing.join(" and ")} — this file cannot answer a`);
    console.log("    departure search on its own. Check whether it is a station list");
    console.log("    or a statistics extract rather than a timetable.");
    console.log("\n  Do not write an adapter against this file. Go back to");
    console.log("  https://www.data.go.kr/data/15098251/fileData.do and take the");
    console.log("  열차운행시각표 file, not a 수송/수입 statistics extract.\n");
    process.exitCode = 1;
    return;
  }

  // The decisive question: are the stations we currently fail on actually here?
  console.log(`\n  coverage of stations the app currently 404s on (by ${report.countedBy}):`);
  for (const { station, rows } of report.coverage) {
    console.log(`    ${station.padEnd(8)} ${rows > 0 ? `✓ ${rows} row(s)` : "✗ absent"}`);
  }

  if (report.resolvable) {
    const { rows, unmatched } = report.resolvable;
    const pct = report.rowCount > 0 ? ((rows / report.rowCount) * 100).toFixed(1) : "0.0";
    console.log(`\n  rows resolving to a menu station: ${rows}/${report.rowCount} (${pct}%)`);
    if (unmatched.length > 0) {
      console.log(`  ${unmatched.length} name(s) outside the 1~9호선 menu, e.g.:`);
      console.log(`    ${unmatched.slice(0, 12).join(", ")}`);
      console.log("  Those rows must be dropped, not renamed — search matches menu names.");
    }
  }

  console.log(`
  Next: record the column names in docs/korea-api-registration.md §D, then feed
  the file to parseSeoulSubwayTimetable in src/server/seoulSubwayTimetable.ts.
  Do not hand-author snapshot rows to fill any station this file does not cover.
`);
}

// Importable for tests; only runs the CLI when invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
