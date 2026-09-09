import { createHash } from "node:crypto";
import type { TransitResult } from "../../src/types";
import { readXlsxValues, type XlsxSheet, type XlsxValue } from "./xlsxValues";

export const KORAIL_TIMETABLE_URL = "https://www.korail.com/ticket/reserve/train-timeTable";
export const KORAIL_BOARD_URL = "https://www.korail.com/com/userBoard.do?mode=list&schBcid=ticketTable";
const DOWNLOAD_ROOT = "https://www.korail.com/file/cubedata/COMMON/";
export type KorailFamily = "ktx" | "regular";

export interface KorailEdition {
  family: KorailFamily;
  title: string;
  url: string;
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface KorailRun {
  id: string;
  trainNumber: string;
  trainType: string;
  line: string;
  weekdays: number[];
  stops: Array<{ name: string; minutes: number }>;
}

export interface KorailDocument extends KorailEdition {
  sha256: string;
  retrievedAt: string;
  runs: KorailRun[];
  exclusions: string[];
}

const compact = (value: XlsxValue | undefined) => String(value ?? "").normalize("NFKC").replace(/\s+/g, "");
const calendarDate = (year: string, month: string, day: string): string => {
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`Invalid Korail date: ${date}`);
  return date;
};

/** Board publication dates are not timetable effective dates. Read the title. */
export function parseKorailEditions(payload: unknown): KorailEdition[] {
  const board = payload as { strResult?: string; boardList?: any[]; totcnt?: number };
  if (board?.strResult !== "SUCC" || !Array.isArray(board.boardList)
    || Number(board.totcnt) !== board.boardList.length) {
    throw new Error("Korail timetable board is incomplete or unavailable");
  }
  const editions: KorailEdition[] = [];
  for (const row of board.boardList) {
    if (row.bdCode !== "_ticketTable02" || typeof row.bdTitle !== "string") continue;
    const title = row.bdTitle.trim();
    const family: KorailFamily | undefined = /^KTX\s*(열차)?시간표/.test(title)
      ? "ktx" : /^일반열차\s*시간표/.test(title) ? "regular" : undefined;
    if (!family) continue;
    const match = /\((\d{4})\s*[.년]\s*(\d{1,2})\s*[.월]\s*(\d{1,2})\s*[.일]?\s*(?:기준|부터)\)/.exec(title);
    if (!match || !Array.isArray(row.fileId) || row.fileId.length !== 1
      || !/^jfile\/[A-Za-z0-9_/-]+\.xlsx$/.test(row.fileId[0])) {
      throw new Error(`Unsupported Korail timetable edition: ${title}`);
    }
    editions.push({
      family, title,
      url: `${DOWNLOAD_ROOT}${row.fileId[0]}`,
      effectiveFrom: calendarDate(match[1], match[2], match[3]),
    });
  }
  for (const family of ["ktx", "regular"] as const) {
    const sorted = editions.filter((edition) => edition.family === family)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    if (sorted.length === 0) throw new Error(`Korail board contains no ${family} timetables`);
    for (let index = 0; index < sorted.length - 1; index++) {
      const next = sorted[index + 1].effectiveFrom;
      if (sorted[index].effectiveFrom === next) throw new Error(`Ambiguous Korail ${family} edition for ${next}`);
      sorted[index].effectiveUntil = new Date(Date.parse(`${next}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    }
  }
  return editions;
}

export function selectKorailEdition(editions: KorailEdition[], family: KorailFamily, date: string): KorailEdition {
  const edition = editions.find((candidate) => candidate.family === family
    && date >= candidate.effectiveFrom && (!candidate.effectiveUntil || date <= candidate.effectiveUntil));
  if (!edition) throw new Error(`No verified Korail ${family} timetable for ${date}`);
  return edition;
}

/** KTX marks every train; the regular workbook's own legend defines blank as daily. */
export function korailWeekdays(value: XlsxValue | undefined, allowBlank = false): number[] {
  const text = compact(value);
  // Some regular-sheet remark cells encode the same empty remark as numeric 0.
  if (text === "매일" || (allowBlank && (text === "" || value === 0 || /^[가-힣]+선경유$/.test(text)))) return [0, 1, 2, 3, 4, 5, 6];
  if (!/^[월화수목금토일]+$/.test(text)) throw new Error(`Unrecognized Korail operating days: ${JSON.stringify(value)}`);
  return [...new Set([...text].map((day) => "일월화수목금토".indexOf(day)))];
}

/** Zero is the workbook's no-stop marker; midnight is an Excel day value of 1. */
function timeMinutes(value: XlsxValue | undefined): number | undefined {
  if (value === undefined || value === 0 || compact(value) === "" || compact(value) === "-") return undefined;
  if (typeof value === "string" && /^[가-힣]+선경유$/.test(compact(value))) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 2) {
    throw new Error(`Unrecognized Korail timetable time: ${JSON.stringify(value)}`);
  }
  // h:mm cells hide seconds; do not round a published 06:52:30 up to 06:53.
  return Math.floor(value * 1440 + 1e-7);
}

function normalizeStops(stops: KorailRun["stops"], startMinutes?: number): KorailRun["stops"] {
  let previous = startMinutes ?? stops[0]?.minutes ?? 0;
  let offset = 0;
  return stops.map((stop) => {
    let minutes = stop.minutes + offset;
    if (minutes < previous) {
      if (previous % 1440 < 20 * 60 || stop.minutes >= 6 * 60 || offset !== 0) {
        throw new Error(`Korail times run backwards at ${stop.name}`);
      }
      offset = 1440;
      minutes += offset;
    }
    if (minutes < previous || minutes >= 2880) throw new Error(`Invalid Korail overnight time at ${stop.name}`);
    previous = minutes;
    return { ...stop, minutes };
  });
}

function stationName(korean: XlsxValue | undefined, english: XlsxValue | undefined, names: Map<string, string>): string {
  const key = compact(korean).replace(/\((?:출발|도착)\)/g, "").replace(/EXPO/gi, "엑스포");
  if (!key || typeof english !== "string" || !/[A-Za-z]/.test(english)) {
    throw new Error(`Missing Korail station identity: ${String(korean)} / ${String(english)}`);
  }
  // Both spellings are published by Korail. Use one English spelling for the
  // same Korean station across the two workbooks, with KTX loaded first.
  if (!names.has(key)) names.set(key, english.trim().replace(/\s+/g, " "));
  return names.get(key)!;
}

function addRun(runs: KorailRun[], run: KorailRun, startMinutes?: number): void {
  if (run.stops.length < 2) throw new Error(`Korail train ${run.trainNumber} has fewer than two timed stops`);
  try {
    run.stops = normalizeStops(run.stops, startMinutes);
  } catch (error) {
    throw new Error(`${run.id} (${run.trainNumber}): ${error instanceof Error ? error.message : error}`);
  }
  if (run.stops.at(-1)!.minutes <= run.stops[0].minutes) throw new Error(`Invalid Korail train duration: ${run.id}`);
  runs.push(run);
}

function parseKtxSheet(sheet: XlsxSheet, names: Map<string, string>): KorailRun[] {
  const runs: KorailRun[] = [];
  let directions = 0;
  for (const [rowNumber, headers] of sheet.rows) {
    for (const [trainColumn, label] of headers) {
      if (compact(label) !== "열차번호") continue;
      directions++;
      if (compact(headers.get(trainColumn + 1)) !== "편성") throw new Error(`Unrecognized KTX layout in ${sheet.name}`);
      const remarkColumn = [...headers.keys()].sort((a, b) => a - b)
        .find((column) => column > trainColumn && compact(headers.get(column)).startsWith("비고"));
      if (!remarkColumn) throw new Error(`KTX operating-day column missing in ${sheet.name}`);
      const stations = [];
      for (let column = trainColumn + 2; column < remarkColumn; column++) {
        stations.push({ column, name: stationName(headers.get(column), sheet.rows.get(rowNumber + 2)?.get(column), names) });
      }
      let count = 0;
      for (const [number, row] of sheet.rows) {
        if (number <= rowNumber + 2 || row.get(trainColumn) === undefined) continue;
        const trainNumber = compact(row.get(trainColumn));
        if (!/^[1-9]\d*$/.test(trainNumber)) throw new Error(`Invalid KTX train number in ${sheet.name}:${number}`);
        const trainType = compact(row.get(trainColumn + 1));
        if (!/^KTX(?:-[가-힣]+)?$/.test(trainType)) throw new Error(`Unknown KTX train type: ${trainType}`);
        const stops = stations.flatMap(({ column, name }) => {
          const minutes = timeMinutes(row.get(column));
          return minutes === undefined ? [] : [{ name, minutes }];
        });
        addRun(runs, {
          id: `ktx-${sheet.name}-${number}-${trainColumn}`,
          trainNumber, trainType, line: sheet.name,
          weekdays: korailWeekdays(row.get(remarkColumn)), stops,
        });
        count++;
      }
      if (!count) throw new Error(`Empty KTX direction in ${sheet.name}`);
    }
  }
  if (directions !== 2) throw new Error(`Expected both KTX directions in ${sheet.name}`);
  return runs;
}

function parseRegularSheet(sheet: XlsxSheet, names: Map<string, string>, exclude: (message: string) => void): KorailRun[] {
  if (sheet.name === "보는방법") return []; // The examples are NOT train data.
  const runs: KorailRun[] = [];
  let directions = 0;
  for (const [headerRow, row] of sheet.rows) {
    for (const [stationColumn, label] of row) {
      if (compact(label) !== "열차번호") continue;
      directions++;
      const trainColumns: number[] = [];
      for (let column = stationColumn + 1; /^[1-9]\d*$/.test(compact(row.get(column))); column++) trainColumns.push(column);
      if (!trainColumns.length) throw new Error(`Empty Korail regular direction in ${sheet.name}`);
      const englishColumn = trainColumns.at(-1)! + 2;
      if (compact(row.get(englishColumn)) !== "TrainNO.") throw new Error(`Unknown regular timetable layout in ${sheet.name}`);
      const remarkRow = [...sheet.rows.keys()].sort((a, b) => a - b)
        .find((number) => number > headerRow && compact(sheet.rows.get(number)?.get(stationColumn)) === "비고");
      if (!remarkRow) throw new Error(`Regular operating-day row missing in ${sheet.name}`);
      trains: for (const column of trainColumns) {
        const trainNumber = compact(row.get(column));
        const trainType = compact(sheet.rows.get(headerRow - 1)?.get(column));
        if (!/^(ITX-[가-힣]+|무궁화|새마을|누리로)$/.test(trainType)) throw new Error(`Unknown regular train type: ${trainType}`);
        const stops: KorailRun["stops"] = [];
        const start = timeMinutes(sheet.rows.get(headerRow - 2)?.get(column));
        const end = timeMinutes(sheet.rows.get(remarkRow + 4)?.get(column));
        if (start === undefined || end === undefined) throw new Error(`Missing regular train endpoints: ${sheet.name} ${trainNumber}`);
        const endMinutes = end < start ? end + 1440 : end;
        for (let number = headerRow + 1; number < remarkRow; number++) {
          const stopRow = sheet.rows.get(number);
          let minutes = timeMinutes(stopRow?.get(column));
          if (minutes === undefined) continue;
          if (minutes < start && endMinutes >= 1440) minutes += 1440;
          if (minutes < start || minutes > endMinutes) {
            exclude(`Korail excluded ${sheet.name} ${trainNumber}: stop outside published start/end span`);
            continue trains;
          }
          stops.push({ name: stationName(stopRow?.get(stationColumn), stopRow?.get(englishColumn), names), minutes });
        }
        // The printed grid interleaves branches (e.g. Gwangju/Geungnakgang).
        // Actual published times, bounded by the train's own start/end, give
        // the order in which this particular train serves those stations.
        stops.sort((a, b) => a.minutes - b.minutes);
        addRun(runs, {
          id: `regular-${sheet.name}-${headerRow}-${column}`,
          trainNumber, trainType, line: sheet.name,
          weekdays: korailWeekdays(sheet.rows.get(remarkRow)?.get(column), true), stops,
        });
      }
    }
  }
  if (directions !== 2) throw new Error(`Expected both regular directions in ${sheet.name}`);
  return runs;
}

export function parseKorailWorkbook(bytes: Uint8Array, family: KorailFamily, names = new Map<string, string>(), exclude: (message: string) => void = console.warn): KorailRun[] {
  const runs = readXlsxValues(bytes).flatMap((sheet) => family === "ktx" ? parseKtxSheet(sheet, names) : parseRegularSheet(sheet, names, exclude));
  if (runs.length === 0) throw new Error(`Korail ${family} workbook has no trains`);
  return runs;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function korailResults(document: KorailDocument, date: string, targetDate = date): TransitResult[] {
  if (date < document.effectiveFrom || (document.effectiveUntil && date > document.effectiveUntil)) {
    throw new Error(`Korail edition does not cover ${date}`);
  }
  const dayOffset = (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  if (dayOffset !== 0 && dayOffset !== 1) throw new Error("Unsupported Korail boarding date");
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return document.runs.filter((run) => run.weekdays.includes(weekday)).flatMap((original) => {
    const run = { ...original, stops: original.stops
      .filter((stop) => stop.minutes >= dayOffset * 1440)
      .map((stop) => ({ ...stop, minutes: stop.minutes - dayOffset * 1440 })) };
    if (run.stops.length < 2 || run.stops[0].minutes >= 1440) return [];
    const first = run.stops[0];
    const last = run.stops.at(-1)!;
    const service = `${run.trainType} ${run.trainNumber}`;
    return {
      id: `korail-${date}-${run.id}${dayOffset ? "-next-day" : ""}`, country: "korea", date: targetDate,
      operator: "Korail", service, trainType: run.trainType,
      origin: first.name, destination: last.name,
      departureTime: formatTime(first.minutes), arrivalTime: formatTime(last.minutes),
      durationMinutes: last.minutes - first.minutes,
      direct: true, stops: run.stops.map((stop) => stop.name),
      headsign: last.name, realtime: false,
      legs: run.stops.slice(0, -1).map((stop, index) => ({
        lineName: service, lineCode: run.line, mode: "train",
        origin: stop.name, destination: run.stops[index + 1].name,
        departureTime: formatTime(stop.minutes), arrivalTime: formatTime(run.stops[index + 1].minutes),
        durationMinutes: run.stops[index + 1].minutes - stop.minutes,
      })),
    };
  });
}

export function createKorailTimetableSource(fetcher: typeof fetch = fetch) {
  let editions: Promise<KorailEdition[]> | undefined;
  const documents = new Map<string, Promise<KorailDocument>>();
  const names = new Map<string, string>();
  async function download(url: string): Promise<Uint8Array> {
    const response = await fetcher(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Korail returned HTTP ${response.status}: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Korail download exceeds size limit");
    return bytes;
  }
  return {
    async load(date: string): Promise<KorailDocument[]> {
      editions ??= download(KORAIL_BOARD_URL).then((bytes) => parseKorailEditions(JSON.parse(new TextDecoder().decode(bytes))));
      const listing = await editions;
      const selected: KorailDocument[] = [];
      // Parse KTX first to establish the shared operator-published station names.
      for (const family of ["ktx", "regular"] as const) {
        const edition = selectKorailEdition(listing, family, date);
        let document = documents.get(edition.url);
        if (!document) {
          document = download(edition.url).then((bytes): KorailDocument => {
            const exclusions: string[] = [];
            const runs = parseKorailWorkbook(bytes, family, names, (message) => {
              exclusions.push(message);
              console.warn(message);
            });
            return { ...edition,
            retrievedAt: new Date().toISOString(),
            sha256: createHash("sha256").update(bytes).digest("hex"),
            runs, exclusions,
          }; });
          documents.set(edition.url, document);
        }
        selected.push(await document);
      }
      return selected;
    },
  };
}
