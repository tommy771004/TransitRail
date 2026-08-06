import { gunzipSync, gzipSync } from "node:zlib";
import type { ServiceDayType, TransitResult } from "../types";
import { getMinimumTransferMinutes } from "./transferRules";
import type { OfficialSourceId } from "./sourceRegistry";
import {
  buildSeoulJourneys,
  formatClock,
  type SeoulJourneyQuery,
  type SeoulTimetable,
} from "../server/seoulSubwayTimetable";
import { stationSearchKey } from "./stationKey";

export const KOREAN_SUBWAY_ARTIFACT_SCHEMA_VERSION = 1 as const;

type ArtifactCall = [stationIndex: number, arrival: number | null, departure: number | null];
type ArtifactRun = [
  line: string,
  trainNo: string,
  dayType: ServiceDayType,
  direction: string | null,
  calls: ArtifactCall[],
];

/**
 * Official Korean subway timetable feeds this artifact may carry.
 *
 * A closed set, not a free string: the label is what the authenticity oracle
 * reads to decide the data is official, so an unrecognised source must fail
 * validation rather than quietly present itself as verified. Add a feed here
 * only once its licence and machine-readable source are confirmed.
 */
export const KOREAN_SUBWAY_ARTIFACT_SOURCES = [
  "Seoul Metro official timetable CSV",
  "Incheon Transit Corporation official timetable CSV",
] as const;

export type KoreanSubwayArtifactSource = typeof KOREAN_SUBWAY_ARTIFACT_SOURCES[number];

/**
 * Which register entry each artifact feed corresponds to.
 *
 * The mapping is exhaustive over the closed set above, so an artifact that
 * decodes at all has a registered source, and search can attach the same
 * provenance block to artifact rows that a route file carries. The artifact
 * format predates that block and stores only the label; this is where the two
 * are joined, in one place, rather than by matching strings at each call site.
 */
export const KOREAN_ARTIFACT_SOURCE_IDS: Record<KoreanSubwayArtifactSource, OfficialSourceId> = {
  "Seoul Metro official timetable CSV": "kr-seoul-metro-csv",
  "Incheon Transit Corporation official timetable CSV": "kr-incheon-transit-csv",
};

export interface KoreanSubwayArtifact {
  schemaVersion: typeof KOREAN_SUBWAY_ARTIFACT_SCHEMA_VERSION;
  country: "korea";
  source: KoreanSubwayArtifactSource;
  retrievedAt: string;
  sourceSha256: string;
  stations: string[];
  runs: ArtifactRun[];
}

export interface KoreanSubwayArtifactMetadata {
  retrievedAt: string;
  sourceSha256: string;
  /** Which official feed produced these runs. Defaults to the Seoul CSV. */
  source?: KoreanSubwayArtifactSource;
}

export function buildKoreanSubwayArtifact(
  timetable: SeoulTimetable,
  metadata: KoreanSubwayArtifactMetadata,
): KoreanSubwayArtifact {
  const stations: string[] = [];
  const stationIndexes = new Map<string, number>();
  const stationIndex = (station: string) => {
    const existing = stationIndexes.get(station);
    if (existing !== undefined) return existing;
    const index = stations.length;
    stations.push(station);
    stationIndexes.set(station, index);
    return index;
  };

  return {
    schemaVersion: KOREAN_SUBWAY_ARTIFACT_SCHEMA_VERSION,
    country: "korea",
    source: metadata.source ?? "Seoul Metro official timetable CSV",
    retrievedAt: metadata.retrievedAt,
    sourceSha256: metadata.sourceSha256,
    stations,
    runs: timetable.runs.map((run) => [
      run.line ?? "Seoul Subway",
      run.trainNo,
      run.dayType,
      run.direction ?? null,
      run.calls.map((call) => [
        stationIndex(call.station),
        call.arrival ?? null,
        call.departure ?? null,
      ]),
    ]),
  };
}

function isServiceDayType(value: unknown): value is ServiceDayType {
  return value === "weekday"
    || value === "saturday"
    || value === "sunday_holiday"
    || value === "special";
}

export function validateKoreanSubwayArtifact(value: unknown): KoreanSubwayArtifact {
  if (!value || typeof value !== "object") throw new Error("Korean subway artifact is not an object.");
  const artifact = value as Partial<KoreanSubwayArtifact>;
  if (artifact.schemaVersion !== KOREAN_SUBWAY_ARTIFACT_SCHEMA_VERSION) {
    throw new Error("Korean subway artifact schema version is incompatible.");
  }
  if (
    artifact.country !== "korea"
    || typeof artifact.source !== "string"
    || !(KOREAN_SUBWAY_ARTIFACT_SOURCES as readonly string[]).includes(artifact.source)
  ) {
    throw new Error("Korean subway artifact identity is invalid.");
  }
  if (typeof artifact.retrievedAt !== "string" || !Number.isFinite(Date.parse(artifact.retrievedAt))) {
    throw new Error("Korean subway artifact retrievedAt is invalid.");
  }
  if (typeof artifact.sourceSha256 !== "string" || artifact.sourceSha256.length === 0) {
    throw new Error("Korean subway artifact source hash is missing.");
  }
  if (!Array.isArray(artifact.stations) || artifact.stations.length === 0) {
    throw new Error("Korean subway artifact station dictionary is empty.");
  }
  if (artifact.stations.some((station) => typeof station !== "string" || station.length === 0)) {
    throw new Error("Korean subway artifact station dictionary is invalid.");
  }
  if (new Set(artifact.stations).size !== artifact.stations.length) {
    throw new Error("Korean subway artifact station dictionary contains duplicates.");
  }
  if (!Array.isArray(artifact.runs) || artifact.runs.length === 0) {
    throw new Error("Korean subway artifact has no train runs.");
  }

  for (const run of artifact.runs) {
    if (!Array.isArray(run) || run.length !== 5) throw new Error("Korean subway artifact run is invalid.");
    const [line, trainNo, dayType, direction, calls] = run;
    if (typeof line !== "string" || typeof trainNo !== "string" || !isServiceDayType(dayType)) {
      throw new Error("Korean subway artifact run identity is invalid.");
    }
    if (direction !== null && typeof direction !== "string") {
      throw new Error("Korean subway artifact direction is invalid.");
    }
    if (!Array.isArray(calls) || calls.length < 2) throw new Error("Korean subway artifact run has too few calls.");
    for (const call of calls) {
      if (!Array.isArray(call) || call.length !== 3) throw new Error("Korean subway artifact call is invalid.");
      const [index, arrival, departure] = call;
      if (!Number.isInteger(index) || index < 0 || index >= artifact.stations.length) {
        throw new Error("Korean subway artifact call has an invalid station index.");
      }
      for (const time of [arrival, departure]) {
        if (time !== null && (!Number.isFinite(time) || time < 0)) {
          throw new Error("Korean subway artifact call has an invalid time.");
        }
      }
      if (arrival === null && departure === null) throw new Error("Korean subway artifact call has no time.");
    }
  }

  return artifact as KoreanSubwayArtifact;
}

export function encodeKoreanSubwayArtifact(artifact: KoreanSubwayArtifact): Buffer {
  validateKoreanSubwayArtifact(artifact);
  return gzipSync(Buffer.from(JSON.stringify(artifact)), { level: 9 });
}

export function decodeKoreanSubwayArtifact(buffer: Buffer): KoreanSubwayArtifact {
  const parsed = JSON.parse(gunzipSync(buffer).toString("utf8")) as unknown;
  return validateKoreanSubwayArtifact(parsed);
}

function isValidIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The picker has both Korail and Seoul Metro spellings for Seoul Station. */
function artifactStationKey(name: string): string {
  const key = stationSearchKey(name);
  if (key === "seoul (snc)" || key === "seoul") return stationSearchKey("Seoul Station");
  return key;
}

function artifactStationIndex(artifact: KoreanSubwayArtifact, name: string): number {
  const key = artifactStationKey(name);
  return artifact.stations.findIndex((station) => stationSearchKey(station) === key);
}

export function koreanServiceDayType(date: string): ServiceDayType {
  if (!isValidIsoCalendarDate(date)) {
    throw new RangeError(`Invalid Seoul service date: ${date}`);
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));
  if (weekday === "Sat") return "saturday";
  if (weekday === "Sun") return "sunday_holiday";
  return "weekday";
}

/** Stations that have at least one official run on the requested service day. */
export function koreanArtifactCoverageNames(
  artifact: KoreanSubwayArtifact,
  date?: string,
): string[] {
  if (date && !isValidIsoCalendarDate(date)) return [];
  const dayType = date ? koreanServiceDayType(date) : undefined;
  const indexes = new Set<number>();
  for (const [, , runDayType, , calls] of artifact.runs) {
    if (dayType && runDayType !== dayType) continue;
    for (const [stationIndex, arrival, departure] of calls) {
      if (arrival !== null || departure !== null) indexes.add(stationIndex);
    }
  }
  return [...indexes].map((index) => artifact.stations[index]).filter(Boolean);
}

interface ArtifactRunView {
  line: string;
  trainNo: string;
  dayType: ServiceDayType;
  direction: string | null;
  calls: ArtifactCall[];
}

const reachabilityCache = new Map<string, Map<number, Set<number>>>();

function runsForDay(artifact: KoreanSubwayArtifact, dayType: ServiceDayType): ArtifactRunView[] {
  return artifact.runs
    .filter(([, , runDayType]) => runDayType === dayType)
    .map(([line, trainNo, runDayType, direction, calls]) => ({
      line,
      trainNo,
      dayType: runDayType,
      direction,
      calls,
    }));
}

function callTime(call: ArtifactCall, arrivalFirst: boolean): number | null {
  return (arrivalFirst ? call[1] ?? call[2] : call[2] ?? call[1]) ?? null;
}

function runCallIndex(run: ArtifactRunView, stationIndex: number, start = 0): number {
  return run.calls.findIndex((call, index) => index >= start && call[0] === stationIndex);
}

function indexRunsByStation(runs: ArtifactRunView[]): Map<number, ArtifactRunView[]> {
  const runsByStation = new Map<number, ArtifactRunView[]>();
  for (const run of runs) {
    const seenStations = new Set<number>();
    for (const [stationIndex] of run.calls) {
      if (seenStations.has(stationIndex)) continue;
      seenStations.add(stationIndex);
      const list = runsByStation.get(stationIndex) || [];
      list.push(run);
      runsByStation.set(stationIndex, list);
    }
  }
  return runsByStation;
}

function cloneReachability(source: Map<number, Set<number>>): Map<number, Set<number>> {
  return new Map([...source].map(([origin, destinations]) => [origin, new Set(destinations)]));
}

function directReachability(
  artifact: KoreanSubwayArtifact,
  dayType: ServiceDayType,
): Map<number, Set<number>> {
  const reachable = new Map<number, Set<number>>();
  for (const run of runsForDay(artifact, dayType)) {
    const { calls } = run;
    for (let from = 0; from < calls.length; from += 1) {
      const fromTime = callTime(calls[from], false);
      if (fromTime === null) continue;
      for (let to = from + 1; to < calls.length; to += 1) {
        const toTime = callTime(calls[to], true);
        if (toTime === null || toTime < fromTime) continue;
        const destinations = reachable.get(calls[from][0]) || new Set<number>();
        destinations.add(calls[to][0]);
        reachable.set(calls[from][0], destinations);
      }
    }
  }
  return reachable;
}

/**
 * Build direct plus one-transfer reachability once per artifact/service day.
 * The inner loops only inspect runs that call at the same interchange, rather
 * than comparing every pair of trains in the 12k-run artifact.
 */
function reachabilityForDay(
  artifact: KoreanSubwayArtifact,
  dayType: ServiceDayType,
): Map<number, Set<number>> {
  const cacheKey = `${artifact.sourceSha256}:${dayType}`;
  const cached = reachabilityCache.get(cacheKey);
  if (cached) return cached;

  const runs = runsForDay(artifact, dayType);
  const reachable = cloneReachability(directReachability(artifact, dayType));
  type EndpointLineTimes = Map<number, Map<string, number>>;
  const arrivalsByTransfer = new Map<number, EndpointLineTimes>();
  const departuresByTransfer = new Map<number, EndpointLineTimes>();
  const keepExtreme = (
    table: Map<number, EndpointLineTimes>,
    transfer: number,
    endpoint: number,
    line: string,
    time: number,
    better: (candidate: number, incumbent: number) => boolean,
  ) => {
    const byEndpoint = table.get(transfer) || new Map<number, Map<string, number>>();
    const byLine = byEndpoint.get(endpoint) || new Map<string, number>();
    const previous = byLine.get(line);
    if (previous === undefined || better(time, previous)) byLine.set(line, time);
    byEndpoint.set(endpoint, byLine);
    table.set(transfer, byEndpoint);
  };

  // Reduce the train-pair search to one candidate per line, chosen so that the
  // pair kept is the one most likely to connect: the EARLIEST arrival and the
  // LATEST departure. For a fixed pair of lines, if that pair cannot clear the
  // station floor then no other pair can, so this is exactly "does any pair
  // connect" — the same existence test crossLineJourneys applies, which has no
  // upper bound on the wait. Keeping the earliest departure instead would let a
  // train that leaves before the earliest arrival veto every later one.
  for (const run of runs) {
    for (let transferIndex = 0; transferIndex < run.calls.length; transferIndex += 1) {
      const transfer = run.calls[transferIndex][0];
      const arrival = callTime(run.calls[transferIndex], true);
      if (transferIndex > 0 && arrival !== null) {
        for (let originIndex = 0; originIndex < transferIndex; originIndex += 1) {
          if (callTime(run.calls[originIndex], false) !== null) {
            keepExtreme(
              arrivalsByTransfer,
              transfer,
              run.calls[originIndex][0],
              run.line,
              arrival,
              (candidate, incumbent) => candidate < incumbent,
            );
          }
        }
      }

      const departure = callTime(run.calls[transferIndex], false);
      if (transferIndex < run.calls.length - 1 && departure !== null) {
        for (let destinationIndex = transferIndex + 1; destinationIndex < run.calls.length; destinationIndex += 1) {
          if (callTime(run.calls[destinationIndex], true) !== null) {
            keepExtreme(
              departuresByTransfer,
              transfer,
              run.calls[destinationIndex][0],
              run.line,
              departure,
              (candidate, incumbent) => candidate > incumbent,
            );
          }
        }
      }
    }
  }

  for (const [transfer, arrivalsByOrigin] of arrivalsByTransfer) {
    const departuresByDestination = departuresByTransfer.get(transfer);
    if (!departuresByDestination) continue;
    const minimum = getMinimumTransferMinutes("korea", artifact.stations[transfer]);
    for (const [origin, arrivalByLine] of arrivalsByOrigin) {
      for (const [destination, departureByLine] of departuresByDestination) {
        if (origin === destination) continue;
        const connected = [...arrivalByLine].some(([firstLine, arrival]) => (
          [...departureByLine].some(([secondLine, departure]) => (
            firstLine !== secondLine && departure >= arrival + minimum
          ))
        ));
        if (connected) {
          const destinations = reachable.get(origin) || new Set<number>();
          destinations.add(destination);
          reachable.set(origin, destinations);
        }
      }
    }
  }

  reachabilityCache.set(cacheKey, reachable);
  return reachable;
}

const SEOUL_SERVICE_DAY_TYPES: ServiceDayType[] = ["weekday", "saturday", "sunday_holiday"];

/** Warm all public service-day reachability sets once when the artifact loads. */
export function precomputeKoreanReachability(artifact: KoreanSubwayArtifact): void {
  for (const dayType of SEOUL_SERVICE_DAY_TYPES) {
    reachabilityForDay(artifact, dayType);
  }
}

export function koreanArtifactReachableNames(
  artifact: KoreanSubwayArtifact,
  origin: string,
  date: string,
): string[] {
  if (!isValidIsoCalendarDate(date)) return [];
  const originIndex = artifactStationIndex(artifact, origin);
  if (originIndex < 0) return [];
  const reachable = reachabilityForDay(artifact, koreanServiceDayType(date)).get(originIndex) || new Set<number>();
  return [...reachable].map((index) => artifact.stations[index]).filter(Boolean);
}

function idPart(value: string | null | undefined): string {
  return (value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function segmentResult(
  run: ArtifactRunView,
  fromIndex: number,
  toIndex: number,
  artifact: KoreanSubwayArtifact,
  date: string,
): TransitResult | null {
  if (fromIndex < 0 || toIndex <= fromIndex) return null;
  const from = run.calls[fromIndex];
  const to = run.calls[toIndex];
  const departure = callTime(from, false);
  const arrival = callTime(to, true);
  if (departure === null || arrival === null || arrival < departure) return null;
  const stops = run.calls.slice(fromIndex, toIndex + 1).map(([stationIndex]) => artifact.stations[stationIndex]);
  if (stops.some((station) => !station)) return null;
  return {
    id: `${date}-kr-seoul-${idPart(run.line)}-${idPart(run.trainNo)}-${idPart(run.direction)}-${fromIndex}-${toIndex}`,
    country: "korea",
    date,
    operator: "Seoul Metro",
    service: run.line || "Seoul Subway",
    departureTime: formatClock(departure),
    arrivalTime: formatClock(arrival),
    durationMinutes: arrival - departure,
    origin: artifact.stations[from[0]],
    destination: artifact.stations[to[0]],
    direct: true,
    stops,
    headsign: run.direction ?? undefined,
  };
}

function crossLineJourneys(
  artifact: KoreanSubwayArtifact,
  originIndex: number,
  destinationIndex: number,
  date: string,
  dayType: ServiceDayType,
): TransitResult[] {
  const runs = runsForDay(artifact, dayType);
  const runsByStation = indexRunsByStation(runs);

  const results: TransitResult[] = [];
  const seen = new Set<string>();
  for (const first of runs) {
    const fromIndex = runCallIndex(first, originIndex);
    if (fromIndex < 0) continue;
    for (let transferIndex = fromIndex + 1; transferIndex < first.calls.length; transferIndex += 1) {
      const transfer = first.calls[transferIndex][0];
      if (transfer === originIndex || transfer === destinationIndex) continue;
      const arrival = callTime(first.calls[transferIndex], true);
      if (arrival === null) continue;
      const minimum = getMinimumTransferMinutes("korea", artifact.stations[transfer]);
      for (const second of runsByStation.get(transfer) || []) {
        if (second.line === first.line) continue;
        const secondTransferIndex = runCallIndex(second, transfer);
        const departure = secondTransferIndex < 0
          ? null
          : callTime(second.calls[secondTransferIndex], false);
        if (secondTransferIndex < 0 || departure === null || departure < arrival + minimum) continue;
        const destinationCallIndex = runCallIndex(second, destinationIndex, secondTransferIndex + 1);
        if (destinationCallIndex < 0) continue;

        const firstResult = segmentResult(first, fromIndex, transferIndex, artifact, date);
        const secondResult = segmentResult(second, secondTransferIndex, destinationCallIndex, artifact, date);
        if (!firstResult || !secondResult) continue;
        const id = `${firstResult.id}-x-${secondResult.id}-${transfer}`;
        if (seen.has(id)) continue;
        seen.add(id);
        results.push({
          id,
          country: "korea",
          date,
          operator: "Seoul Metro",
          service: `${firstResult.service} → ${secondResult.service}`,
          departureTime: firstResult.departureTime,
          arrivalTime: secondResult.arrivalTime,
          durationMinutes: (callTime(second.calls[destinationCallIndex], true) || 0)
            - (callTime(first.calls[fromIndex], false) || 0),
          origin: firstResult.origin,
          destination: secondResult.destination,
          direct: false,
          stops: [...firstResult.stops, ...secondResult.stops.slice(1)],
          headsign: secondResult.headsign,
          legs: [
            {
              lineName: firstResult.service,
              origin: firstResult.origin,
              destination: firstResult.destination,
              departureTime: firstResult.departureTime,
              arrivalTime: firstResult.arrivalTime,
              durationMinutes: firstResult.durationMinutes,
              stopCount: Math.max(0, firstResult.stops.length - 1),
              stops: firstResult.stops,
              headsign: firstResult.headsign,
            },
            {
              lineName: secondResult.service,
              origin: secondResult.origin,
              destination: secondResult.destination,
              departureTime: secondResult.departureTime,
              arrivalTime: secondResult.arrivalTime,
              durationMinutes: secondResult.durationMinutes,
              stopCount: Math.max(0, secondResult.stops.length - 1),
              stops: secondResult.stops,
              headsign: secondResult.headsign,
            },
          ],
          transferStations: [artifact.stations[transfer]],
          tags: ["transfer"],
        });
      }
    }
  }
  return results.sort((a, b) => {
    const departure = a.departureTime.localeCompare(b.departureTime);
    return departure || (a.arrivalTime || "").localeCompare(b.arrivalTime || "");
  }).slice(0, 200);
}

export function searchKoreanSubwayArtifact(
  artifact: KoreanSubwayArtifact,
  query: SeoulJourneyQuery,
): TransitResult[] {
  if (!isValidIsoCalendarDate(query.date)) return [];
  const originIndex = artifactStationIndex(artifact, query.origin);
  const destinationIndex = artifactStationIndex(artifact, query.destination);
  if (originIndex < 0 || destinationIndex < 0) return [];

  const dayType = query.dayType ?? koreanServiceDayType(query.date);
  const runs: SeoulTimetable["runs"] = [];
  for (const [line, trainNo, runDayType, direction, calls] of artifact.runs) {
    if (runDayType !== dayType) continue;
    const from = calls.findIndex((call) => call[0] === originIndex);
    if (from < 0 || !calls.some((call, index) => index > from && call[0] === destinationIndex)) continue;
    runs.push({
      line,
      trainNo,
      dayType: runDayType,
      direction: direction ?? undefined,
      calls: calls.map(([station, arrival, departure]) => ({
        station: artifact.stations[station],
        arrival: arrival ?? undefined,
        departure: departure ?? undefined,
      })),
    });
  }

  const directResults = buildSeoulJourneys(
    { encoding: "gzip-json", runs, dropped: {} },
    {
      ...query,
      origin: artifact.stations[originIndex],
      destination: artifact.stations[destinationIndex],
      dayType,
    },
  );
  const transferResults = crossLineJourneys(
    artifact,
    originIndex,
    destinationIndex,
    query.date,
    dayType,
  );
  return [...directResults, ...transferResults].sort((a, b) => {
    const departure = a.departureTime.localeCompare(b.departureTime);
    return departure || (a.arrivalTime || "").localeCompare(b.arrivalTime || "");
  });
}
