/**
 * Reading data.go.kr 파일데이터 CSVs.
 *
 * Kept out of scripts/ because both the CLI inspector and the timetable parser
 * need it, and the parser is runtime code. scripts/inspect-korea-filedata.ts
 * re-exports everything here so it stays the one entry point a human runs.
 */
import { seoulStationNameFromKorean } from "./seoulStationNames";

/** Stations the app cannot answer for today; see docs/korea-api-registration.md. */
export const TARGET_STATIONS = ["시청", "충정로", "청량리", "을지로입구", "서울역"];

/**
 * Column names these datasets are known to use, by role. Names and codes are
 * separate roles: they resolve through different halves of seoulStationNames,
 * and a file carrying only codes still needs the ambiguity check.
 */
export const COLUMN_HINTS: Record<string, string[]> = {
  station: ["역사명", "역명", "전철역명", "STATION_NM"],
  stationCode: ["역사코드", "전철역코드", "STATION_CD"],
  arrival: ["도착시간", "도착시각", "ARRIVETIME", "ARRIVE_TIME"],
  departure: ["출발시간", "출발시각", "DEPARTTIME", "DEPART_TIME", "LEFTTIME"],
  direction: ["방향", "상하행", "상하행구분", "INOUT_TAG", "UPDOWN"],
  line: ["호선", "노선", "LINE_NUM", "선명"],
  dayType: ["요일구분", "평일구분", "WEEK_TAG", "운행요일"],
  terminus: ["도착역", "출발역", "종착역", "행선지"],
  trainNo: ["열차번호", "TRAIN_NO", "열차No"],
};

/**
 * Korean government CSVs are still commonly CP949/EUC-KR rather than UTF-8.
 * Decoding one as UTF-8 yields mojibake that silently fails every station
 * comparison, so detect rather than assume.
 */
export function decode(buffer: Buffer): { text: string; encoding: string } {
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
export function splitRow(line: string): string[] {
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

export function classify(headers: string[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const [role, hints] of Object.entries(COLUMN_HINTS)) {
    const matches = headers.filter((h) =>
      hints.some((hint) => h.replace(/\s/g, "").toUpperCase().includes(hint.toUpperCase())),
    );
    if (matches.length > 0) found[role] = matches;
  }
  return found;
}

/** Header row + parsed rows, with the column index of each detected role. */
export interface ParsedTable {
  encoding: string;
  headers: string[];
  rows: string[][];
  roles: Record<string, string[]>;
  /** First column index per role, or -1. */
  columnOf: (role: string) => number;
}

export function parseTable(buffer: Buffer): ParsedTable {
  const { text, encoding } = decode(buffer);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines.length > 0 ? splitRow(lines[0]) : [];
  const rows = lines.slice(1).map(splitRow);
  const roles = classify(headers);
  return {
    encoding,
    headers,
    rows,
    roles,
    columnOf: (role) => (roles[role] ? headers.indexOf(roles[role][0]) : -1),
  };
}

export interface FileDataReport {
  encoding: string;
  headers: string[];
  rowCount: number;
  roles: Record<string, string[]>;
  /** Empty when the file can answer a departure search. */
  missing: string[];
  usable: boolean;
  sample: string[];
  /** Rows naming each target station — by station column when there is one. */
  coverage: { station: string; rows: number }[];
  countedBy: "station column" | "whole row";
  /** Rows whose station name resolves to a name in the app's menu. */
  resolvable?: { rows: number; unmatched: string[] };
}

export function inspectFileData(buffer: Buffer): FileDataReport {
  const { encoding, headers, rows, roles, columnOf } = parseTable(buffer);

  // A file needs some way to name a station (역사명 or 역사코드, which
  // seoulStationNames can resolve) plus a departure time.
  const missing: string[] = [];
  if (!roles.station && !roles.stationCode) missing.push("station name or code");
  if (!roles.departure) missing.push("departure");

  const stationColumn = columnOf("station");
  const countedBy = stationColumn >= 0 ? "station column" : "whole row";
  const cellFor = (row: string[]) =>
    stationColumn >= 0 ? (row[stationColumn] ?? "") : row.join(",");

  const coverage = TARGET_STATIONS.map((station) => ({
    station,
    rows: rows.filter((row) =>
      stationColumn >= 0
        ? cellFor(row).replace(/\s+/g, "") === station
        : cellFor(row).includes(station),
    ).length,
  }));

  let resolvable: FileDataReport["resolvable"];
  if (stationColumn >= 0) {
    const unmatched = new Set<string>();
    let matched = 0;
    for (const row of rows) {
      const name = cellFor(row);
      if (!name) continue;
      if (seoulStationNameFromKorean(name)) matched++;
      else unmatched.add(name);
    }
    resolvable = { rows: matched, unmatched: [...unmatched].sort() };
  }

  return {
    encoding,
    headers,
    rowCount: rows.length,
    roles,
    missing,
    usable: missing.length === 0,
    sample: rows[0] ?? [],
    coverage,
    countedBy,
    resolvable,
  };
}
