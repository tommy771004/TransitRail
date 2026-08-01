/**
 * Turn 서울 도시철도 열차운행시각표 (data.go.kr 15098251) into journeys.
 *
 * The file is a *per-station-per-train* timetable: one row is "train K101 calls
 * at 시청, arriving 05:33, leaving 05:33:30". Search asks origin -> destination.
 * The bridge is 열차번호: rows sharing a train number are one run, and any two
 * calls on that run (earlier -> later) are a genuine direct journey with real
 * times. No headway is assumed and no travel time is interpolated, so unlike
 * the curated snapshots this data is a real timetable.
 *
 * Station names cross into the app through seoulStationNames — rows naming a
 * station the menu does not carry are dropped, never renamed.
 */
import { parseTable } from "../data/koreaFileData";
import { seoulStationNameFromCode, seoulStationNameFromKorean } from "../data/seoulStationNames";
import type { ServiceDayType, TransitResult } from "../types";

/** One call: minutes since the start of the service day (may exceed 24h). */
export interface SeoulCall {
  station: string;
  arrival?: number;
  departure?: number;
}

export interface SeoulTrainRun {
  trainNo: string;
  line?: string;
  dayType: ServiceDayType;
  direction?: string;
  calls: SeoulCall[];
}

export interface SeoulTimetable {
  encoding: string;
  runs: SeoulTrainRun[];
  /** Why rows were skipped, so a caller can report rather than silently lose data. */
  dropped: Record<string, number>;
}

/**
 * Korean subway timetables express after-midnight service as 24:xx or 25:xx
 * rather than rolling over, so hours past 23 are legitimate and must survive
 * into the duration arithmetic.
 */
export function parseClock(raw: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/** Minutes back to a wall clock the UI can show: 25:10 is displayed as 01:10. */
export function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Order matters: 평일 (weekday) and 토요일 (Saturday) both end in 일, so a bare
 * 일 test would classify every weekday row as Sunday service.
 */
export function parseDayType(raw: string): ServiceDayType {
  const value = raw.replace(/\s+/g, "").toUpperCase();
  if (value === "DAY" || /평일/.test(value)) return "weekday";
  if (value === "SAT" || /토/.test(value)) return "saturday";
  if (value === "END" || /일|휴/.test(value)) return "sunday_holiday";
  return "special";
}

/** "01호선" / "1호선" / "1" all become the menu's "Line 1" label. */
export function parseLineLabel(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `Line ${digits}` : undefined;
}

function resolveStation(name: string, code: string): string | undefined {
  if (name) {
    const byName = seoulStationNameFromKorean(name);
    if (byName) return byName;
  }
  // Only fall back to the code when there was no usable name: a numeric code
  // that lost its leading zero can name the wrong station (seoulStationNames).
  return code ? seoulStationNameFromCode(code) : undefined;
}

export function parseSeoulSubwayTimetable(buffer: Buffer): SeoulTimetable {
  const table = parseTable(buffer);
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };

  const col = {
    station: table.columnOf("station"),
    stationCode: table.columnOf("stationCode"),
    departure: table.columnOf("departure"),
    arrival: table.columnOf("arrival"),
    trainNo: table.columnOf("trainNo"),
    line: table.columnOf("line"),
    dayType: table.columnOf("dayType"),
    direction: table.columnOf("direction"),
  };

  if (col.trainNo < 0) {
    // Without 열차번호 there is no way to know which rows belong to one train,
    // and inventing an order would fabricate journeys.
    return { encoding: table.encoding, runs: [], dropped: { "no 열차번호 column": table.rows.length } };
  }

  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
  const byRun = new Map<string, SeoulTrainRun>();

  for (const row of table.rows) {
    const station = resolveStation(cell(row, col.station), cell(row, col.stationCode));
    if (!station) {
      drop("station not in menu");
      continue;
    }

    const departure = parseClock(cell(row, col.departure));
    const arrival = parseClock(cell(row, col.arrival));
    if (departure === undefined && arrival === undefined) {
      drop("no usable time");
      continue;
    }

    const trainNo = cell(row, col.trainNo);
    if (!trainNo) {
      drop("blank 열차번호");
      continue;
    }

    const rawLine = cell(row, col.line);
    const line = parseLineLabel(rawLine);
    const dayType = parseDayType(cell(row, col.dayType));
    const direction = cell(row, col.direction) || undefined;
    // Train codes are only unique within a line. The official file reuses
    // hundreds of codes across lines (for example 5502 on lines 2 and 5), so
    // omitting the line would splice unrelated calls into a fictitious train.
    const key = `${rawLine}|${trainNo}|${dayType}|${direction ?? ""}`;

    let run = byRun.get(key);
    if (!run) {
      run = {
        trainNo,
        line,
        dayType,
        direction,
        calls: [],
      };
      byRun.set(key, run);
    }
    run.calls.push({ station, arrival, departure });
  }

  // The official CSV groups rows by station rather than by a train's call
  // sequence. Order each run by its published time. Older extracts sometimes
  // wrote after-midnight calls as 00:xx instead of 24:xx; when a run spans late
  // evening and early morning, move those early values into the next service
  // day before sorting.
  for (const run of byRun.values()) {
    const anchors = run.calls
      .map((call) => call.departure ?? call.arrival)
      .filter((value): value is number => value !== undefined);
    const wrapsMidnight = anchors.some((value) => value >= 20 * 60)
      && anchors.some((value) => value < 3 * 60);

    if (wrapsMidnight) {
      for (const call of run.calls) {
        const anchor = call.departure ?? call.arrival;
        if (anchor === undefined || anchor >= 3 * 60) continue;
        if (call.arrival !== undefined) call.arrival += 1440;
        if (call.departure !== undefined) call.departure += 1440;
      }
    }

    run.calls.sort((left, right) => {
      const leftAnchor = left.departure ?? left.arrival ?? Number.POSITIVE_INFINITY;
      const rightAnchor = right.departure ?? right.arrival ?? Number.POSITIVE_INFINITY;
      return leftAnchor - rightAnchor;
    });

    // A malformed mixed extract can still contain one backwards timestamp.
    // Keep the duration monotonic rather than inventing a different call order.
    let previous = Number.NEGATIVE_INFINITY;
    for (const call of run.calls) {
      const anchor = call.departure ?? call.arrival;
      if (anchor === undefined) continue;
      if (anchor < previous) {
        const shift = Math.ceil((previous - anchor) / 1440) * 1440;
        if (call.arrival !== undefined) call.arrival += shift;
        if (call.departure !== undefined) call.departure += shift;
      }
      previous = call.departure ?? call.arrival ?? previous;
    }
  }

  const runs = [...byRun.values()].filter((run) => {
    if (run.calls.length >= 2) return true;
    // A single call cannot express a journey between two stations.
    drop("run with fewer than 2 calls");
    return false;
  });

  return { encoding: table.encoding, runs, dropped };
}

export interface SeoulJourneyQuery {
  origin: string;
  destination: string;
  /** Service date, used for the result id and the date filter the SPA applies. */
  date: string;
  dayType?: ServiceDayType;
}

/**
 * Every run that serves origin before destination becomes one direct journey.
 * Fare is deliberately absent: the file carries no fare, and inventing one is
 * what the curated snapshots already do wrong.
 */
export function buildSeoulJourneys(
  timetable: SeoulTimetable,
  query: SeoulJourneyQuery,
): TransitResult[] {
  const origin = query.origin.toLowerCase().trim();
  const destination = query.destination.toLowerCase().trim();
  const results: TransitResult[] = [];

  for (const run of timetable.runs) {
    if (query.dayType && run.dayType !== query.dayType) continue;

    const originIndex = run.calls.findIndex((c) => c.station.toLowerCase() === origin);
    if (originIndex < 0) continue;
    const destinationIndex = run.calls.findIndex(
      (c, i) => i > originIndex && c.station.toLowerCase() === destination,
    );
    if (destinationIndex < 0) continue;

    const from = run.calls[originIndex];
    const to = run.calls[destinationIndex];
    const departs = from.departure ?? from.arrival;
    const arrives = to.arrival ?? to.departure;
    if (departs === undefined || arrives === undefined || arrives < departs) continue;

    const calls = run.calls.slice(originIndex, destinationIndex + 1);
    const idPart = (value: string | undefined) =>
      (value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    results.push({
      id: `${query.date}-kr-seoul-${idPart(run.line)}-${idPart(run.trainNo)}-${idPart(run.direction)}-${originIndex}-${destinationIndex}`,
      country: "korea",
      date: query.date,
      operator: "Seoul Metro",
      service: run.line ?? "Seoul Subway",
      departureTime: formatClock(departs),
      arrivalTime: formatClock(arrives),
      durationMinutes: arrives - departs,
      origin: from.station,
      destination: to.station,
      direct: true,
      stops: calls.map((c) => c.station),
      headsign: run.direction,
    });
  }

  return results.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}
