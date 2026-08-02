/**
 * Incheon Transit Corporation subway timetables from data.go.kr.
 *
 * Same platform and licence as the Seoul feed (이용허락범위 제한 없음, no usage
 * restriction) and the CSVs download without a login — but the shape differs.
 * Seoul publishes long rows keyed by 열차번호; Incheon publishes a WIDE table
 * where each row is one train and every station is a column:
 *
 *   시발역,종착역,열차번호,검단호수공원,신검단중앙,아라,계양,…
 *   예술회관,송도달빛축제공원,1001,,,,,…,05:32:00,05:33:30,…
 *
 * Blank cells mean the train does not call there, so a run is the non-blank
 * cells in column order. The parser emits the same {@link SeoulTimetable} shape
 * the Seoul feed produces, so journey building, the artifact encoding and the
 * service-day rules are shared rather than reimplemented.
 *
 * Station names cross into the app in English. The timetable columns are Korean
 * only, so every name is resolved through the operator's own station dataset
 * (영문역사명) before it leaves this module — emitting 역사명 verbatim would add
 * stations the picker lists and search can never reach, which is exactly the
 * defect `seoulStationNames.ts` exists to prevent.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ServiceDayType } from "../types";
import {
  buildKoreanSubwayArtifact,
  decodeKoreanSubwayArtifact,
  encodeKoreanSubwayArtifact,
  type KoreanSubwayArtifact,
} from "../data/koreanSubwayArtifact";
import { parseClock, type SeoulTimetable, type SeoulTrainRun } from "./seoulSubwayTimetable";

export const INCHEON_SOURCE = "Incheon Transit Corporation official timetable CSV";
export const INCHEON_STATION_DATASET = "https://www.data.go.kr/data/15083751/fileData.do";

/** Dataset pages for one line/service-day/direction slice of the timetable. */
export interface IncheonTimetableDataset {
  datasetUrl: string;
  line: string;
  dayType: ServiceDayType;
  direction: string;
}

export const INCHEON_TIMETABLE_DATASETS: IncheonTimetableDataset[] = [
  { datasetUrl: "https://www.data.go.kr/data/15051203/fileData.do", line: "Incheon Line 1", dayType: "weekday", direction: "up" },
  { datasetUrl: "https://www.data.go.kr/data/15051204/fileData.do", line: "Incheon Line 1", dayType: "weekday", direction: "down" },
  { datasetUrl: "https://www.data.go.kr/data/15051205/fileData.do", line: "Incheon Line 1", dayType: "sunday_holiday", direction: "up" },
  { datasetUrl: "https://www.data.go.kr/data/15051206/fileData.do", line: "Incheon Line 1", dayType: "sunday_holiday", direction: "down" },
  { datasetUrl: "https://www.data.go.kr/data/15051210/fileData.do", line: "Incheon Line 2", dayType: "weekday", direction: "up" },
  { datasetUrl: "https://www.data.go.kr/data/15051208/fileData.do", line: "Incheon Line 2", dayType: "weekday", direction: "down" },
  { datasetUrl: "https://www.data.go.kr/data/15051209/fileData.do", line: "Incheon Line 2", dayType: "sunday_holiday", direction: "up" },
  { datasetUrl: "https://www.data.go.kr/data/15051207/fileData.do", line: "Incheon Line 2", dayType: "sunday_holiday", direction: "down" },
];

/**
 * Decode a data.go.kr CSV.
 *
 * These files are cp949, not UTF-8. Decoding them as UTF-8 does not throw — it
 * silently produces replacement characters, so every Korean station name would
 * miss the dictionary and the whole feed would look empty rather than broken.
 * Try UTF-8 with a BOM first (some newer files use it), then fall back.
 */
export function decodeKoreanCsv(buffer: Buffer): { text: string; encoding: string } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString("utf8"), encoding: "utf-8-bom" };
  }
  for (const encoding of ["utf8", "cp949", "euc-kr"]) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      return { text, encoding };
    } catch {
      continue;
    }
  }
  throw new Error("Incheon CSV is not valid UTF-8, cp949 or EUC-KR.");
}

/** Column names the operator uses to identify a train, by line. */
const TRAIN_COLUMNS = ["열차번호", "순번"] as const;

/** Split a CSV line, honouring quoted fields (station names contain commas). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Korean → English station names from the operator's own station dataset.
 *
 * Keyed on 역사명 exactly as the timetable columns spell it. A name the dataset
 * does not carry is left out rather than transliterated: a guessed English name
 * would not match the menu either, and would hide the gap.
 */
export function parseIncheonStationDictionary(buffer: Buffer): Map<string, string> {
  const { text } = decodeKoreanCsv(buffer);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("Incheon station dataset has no rows.");

  const header = splitCsvLine(lines[0]);
  const koreanIndex = header.indexOf("역사명");
  const englishIndex = header.indexOf("영문역사명");
  if (koreanIndex < 0 || englishIndex < 0) {
    throw new Error("Incheon station dataset is missing 역사명 or 영문역사명.");
  }

  const dictionary = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const korean = cells[koreanIndex];
    const english = cells[englishIndex];
    if (korean && english) dictionary.set(korean, english);
  }
  if (dictionary.size === 0) throw new Error("Incheon station dataset produced no names.");
  return dictionary;
}

/**
 * Parse one wide timetable CSV into runs.
 *
 * A station column whose Korean name is not in the dictionary is dropped and
 * counted, never emitted in Korean — the count is what makes a dictionary gap
 * visible instead of silently shrinking the network.
 */
export function parseIncheonTimetable(
  buffer: Buffer,
  stationNames: Map<string, string>,
  slice: Pick<IncheonTimetableDataset, "line" | "dayType" | "direction">,
): SeoulTimetable {
  const { text, encoding } = decodeKoreanCsv(buffer);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => { dropped[reason] = (dropped[reason] ?? 0) + 1; };

  if (lines.length < 2) return { encoding, runs: [], dropped: { "no data rows": 0 } };

  const header = splitCsvLine(lines[0]);
  // The same operator labels the train column differently per line: Line 1 uses
  // 열차번호, Line 2 uses 순번. Accept either rather than assuming one — the
  // mismatch silently produced zero Line 2 runs until the drop count showed it.
  const trainNoIndex = TRAIN_COLUMNS.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
  if (trainNoIndex < 0) {
    // With no train column there is no train identity, so no run can be formed.
    return { encoding, runs: [], dropped: { [`no ${TRAIN_COLUMNS.join("/")} column`]: lines.length - 1 } };
  }

  // Station columns are everything after the fixed 시발역/종착역/열차번호 block.
  const stationColumns: Array<{ index: number; station: string }> = [];
  header.forEach((cell, index) => {
    if (index <= trainNoIndex) return;
    const english = stationNames.get(cell);
    if (english) stationColumns.push({ index, station: english });
    else if (cell) drop(`station not in dictionary: ${cell}`);
  });
  if (stationColumns.length === 0) {
    return { encoding, runs: [], dropped: { ...dropped, "no known stations": lines.length - 1 } };
  }

  const runs: SeoulTrainRun[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const trainNo = cells[trainNoIndex];
    if (!trainNo) { drop("blank 열차번호"); continue; }

    const calls = stationColumns
      .map(({ index, station }) => ({ station, time: parseClock(cells[index] ?? "") }))
      .filter((call): call is { station: string; time: number } => call.time !== undefined)
      // A published call time is when the train is at the platform; the feed
      // gives one value, so it is both the arrival and the departure rather
      // than an invented dwell.
      .map(({ station, time }) => ({ station, arrival: time, departure: time }));

    if (calls.length < 2) { drop("fewer than two calls"); continue; }
    runs.push({ trainNo, line: slice.line, dayType: slice.dayType, direction: slice.direction, calls });
  }

  return { encoding, runs, dropped };
}

/** Merge per-line/day/direction slices into one timetable. */
export function mergeIncheonTimetables(slices: SeoulTimetable[]): SeoulTimetable {
  const runs: SeoulTrainRun[] = [];
  const dropped: Record<string, number> = {};
  const encodings = new Set<string>();
  for (const slice of slices) {
    runs.push(...slice.runs);
    encodings.add(slice.encoding);
    for (const [reason, count] of Object.entries(slice.dropped)) {
      dropped[reason] = (dropped[reason] ?? 0) + count;
    }
  }
  return { encoding: [...encodings].join("+"), runs, dropped };
}

export const INCHEON_SUBWAY_ARTIFACT_PATH = resolve(
  "src/data/scraped/korea/incheon-subway-timetable.json.gz",
);

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface IncheonArtifactCollectorOptions {
  fetcher?: Fetcher;
  artifactPath?: string;
  stationDatasetUrl?: string;
  timetableDatasets?: IncheonTimetableDataset[];
  allowedDownloadHosts?: string[];
  maximumBytes?: number;
  minimumRuns?: number;
  minimumStations?: number;
}

function decodeHtmlUrl(value: string): string {
  return value.replace(/\\u0026/gi, "&").replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
}

/** data.go.kr exposes the current file's URL as `contentUrl` on the dataset page. */
function contentUrlFrom(html: string, datasetUrl: string): string {
  const match = /["']contentUrl["']\s*:\s*["']([^"']+)["']/i.exec(html);
  if (!match) throw new Error(`The dataset page exposed no CSV contentUrl: ${datasetUrl}`);
  return decodeHtmlUrl(match[1]);
}

async function downloadDatasetCsv(
  datasetUrl: string,
  options: IncheonArtifactCollectorOptions,
): Promise<Buffer> {
  const fetcher = options.fetcher ?? fetch;
  const headers = { "user-agent": "TransitRail scheduled timetable scraper" };

  const page = await fetcher(datasetUrl, { headers });
  if (!page.ok) throw new Error(`Incheon dataset page returned HTTP ${page.status}: ${datasetUrl}`);
  const fileUrl = new URL(contentUrlFrom(await page.text(), datasetUrl));

  // The dataset page is fetched over the network, so treat the URL it hands
  // back as untrusted input rather than following it anywhere it points.
  const allowedHosts = options.allowedDownloadHosts ?? ["www.data.go.kr", "data.go.kr"];
  if (fileUrl.protocol !== "https:" || !allowedHosts.includes(fileUrl.hostname)) {
    throw new Error(`Incheon download URL is not an approved official host: ${fileUrl.hostname}`);
  }

  const response = await fetcher(fileUrl, { headers });
  if (!response.ok) throw new Error(`Incheon CSV returned HTTP ${response.status}: ${fileUrl.href}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const maximumBytes = options.maximumBytes ?? 50 * 1024 * 1024;
  if (buffer.byteLength > maximumBytes) {
    throw new Error(`Incheon CSV is larger than the ${maximumBytes} byte limit.`);
  }
  return buffer;
}

/**
 * Download every configured slice and build one artifact.
 *
 * Hashes the concatenated sources so an unchanged upstream short-circuits — the
 * datasets update annually, and rewriting a byte-identical artifact every night
 * would churn the committed file for nothing.
 */
export async function collectIncheonSubwayArtifact(
  options: IncheonArtifactCollectorOptions = {},
): Promise<KoreanSubwayArtifact> {
  const artifactPath = options.artifactPath ?? INCHEON_SUBWAY_ARTIFACT_PATH;
  const datasets = options.timetableDatasets ?? INCHEON_TIMETABLE_DATASETS;

  const stationCsv = await downloadDatasetCsv(
    options.stationDatasetUrl ?? INCHEON_STATION_DATASET,
    options,
  );
  const stationNames = parseIncheonStationDictionary(stationCsv);

  const hash = createHash("sha256").update(stationCsv);
  const slices: SeoulTimetable[] = [];
  for (const dataset of datasets) {
    const csv = await downloadDatasetCsv(dataset.datasetUrl, options);
    hash.update(csv);
    slices.push(parseIncheonTimetable(csv, stationNames, dataset));
  }
  const sourceSha256 = hash.digest("hex");

  if (existsSync(artifactPath)) {
    try {
      const existing = decodeKoreanSubwayArtifact(readFileSync(artifactPath));
      if (existing.sourceSha256 === sourceSha256) return existing;
    } catch {
      // Replace an unreadable old artifact only once the new source validates.
    }
  }

  const timetable = mergeIncheonTimetables(slices);
  const stationCount = new Set(timetable.runs.flatMap((run) => run.calls.map((call) => call.station))).size;
  const minimumRuns = options.minimumRuns ?? 100;
  const minimumStations = options.minimumStations ?? 25;
  if (timetable.runs.length < minimumRuns || stationCount < minimumStations) {
    // Publishing a shrunken artifact would quietly remove stations from the
    // menu; fail the run and keep the last good file instead.
    throw new Error(
      `Incheon timetable failed completeness checks: ${timetable.runs.length} runs, ${stationCount} stations.`,
    );
  }

  const artifact = buildKoreanSubwayArtifact(timetable, {
    retrievedAt: new Date().toISOString(),
    sourceSha256,
    source: INCHEON_SOURCE,
  });

  mkdirSync(dirname(artifactPath), { recursive: true });
  const temporaryPath = `${artifactPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, encodeKoreanSubwayArtifact(artifact));
  renameSync(temporaryPath, artifactPath);
  return artifact;
}
