import { gunzipSync, gzipSync } from "node:zlib";
import type { ServiceDayType, TransitResult } from "../types";
import {
  buildSeoulJourneys,
  type SeoulJourneyQuery,
  type SeoulTimetable,
} from "../server/seoulSubwayTimetable";

export const SEOUL_SUBWAY_ARTIFACT_SCHEMA_VERSION = 1 as const;

type ArtifactCall = [stationIndex: number, arrival: number | null, departure: number | null];
type ArtifactRun = [
  line: string,
  trainNo: string,
  dayType: ServiceDayType,
  direction: string | null,
  calls: ArtifactCall[],
];

export interface SeoulSubwayArtifact {
  schemaVersion: typeof SEOUL_SUBWAY_ARTIFACT_SCHEMA_VERSION;
  country: "korea";
  source: "Seoul Metro official timetable CSV";
  retrievedAt: string;
  sourceSha256: string;
  stations: string[];
  runs: ArtifactRun[];
}

export interface SeoulSubwayArtifactMetadata {
  retrievedAt: string;
  sourceSha256: string;
}

export function buildSeoulSubwayArtifact(
  timetable: SeoulTimetable,
  metadata: SeoulSubwayArtifactMetadata,
): SeoulSubwayArtifact {
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
    schemaVersion: SEOUL_SUBWAY_ARTIFACT_SCHEMA_VERSION,
    country: "korea",
    source: "Seoul Metro official timetable CSV",
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

export function validateSeoulSubwayArtifact(value: unknown): SeoulSubwayArtifact {
  if (!value || typeof value !== "object") throw new Error("Seoul artifact is not an object.");
  const artifact = value as Partial<SeoulSubwayArtifact>;
  if (artifact.schemaVersion !== SEOUL_SUBWAY_ARTIFACT_SCHEMA_VERSION) {
    throw new Error("Seoul artifact schema version is incompatible.");
  }
  if (artifact.country !== "korea" || artifact.source !== "Seoul Metro official timetable CSV") {
    throw new Error("Seoul artifact identity is invalid.");
  }
  if (typeof artifact.retrievedAt !== "string" || !Number.isFinite(Date.parse(artifact.retrievedAt))) {
    throw new Error("Seoul artifact retrievedAt is invalid.");
  }
  if (typeof artifact.sourceSha256 !== "string" || artifact.sourceSha256.length === 0) {
    throw new Error("Seoul artifact source hash is missing.");
  }
  if (!Array.isArray(artifact.stations) || artifact.stations.length === 0) {
    throw new Error("Seoul artifact station dictionary is empty.");
  }
  if (artifact.stations.some((station) => typeof station !== "string" || station.length === 0)) {
    throw new Error("Seoul artifact station dictionary is invalid.");
  }
  if (new Set(artifact.stations).size !== artifact.stations.length) {
    throw new Error("Seoul artifact station dictionary contains duplicates.");
  }
  if (!Array.isArray(artifact.runs) || artifact.runs.length === 0) {
    throw new Error("Seoul artifact has no train runs.");
  }

  for (const run of artifact.runs) {
    if (!Array.isArray(run) || run.length !== 5) throw new Error("Seoul artifact run is invalid.");
    const [line, trainNo, dayType, direction, calls] = run;
    if (typeof line !== "string" || typeof trainNo !== "string" || !isServiceDayType(dayType)) {
      throw new Error("Seoul artifact run identity is invalid.");
    }
    if (direction !== null && typeof direction !== "string") {
      throw new Error("Seoul artifact direction is invalid.");
    }
    if (!Array.isArray(calls) || calls.length < 2) throw new Error("Seoul artifact run has too few calls.");
    for (const call of calls) {
      if (!Array.isArray(call) || call.length !== 3) throw new Error("Seoul artifact call is invalid.");
      const [index, arrival, departure] = call;
      if (!Number.isInteger(index) || index < 0 || index >= artifact.stations.length) {
        throw new Error("Seoul artifact call has an invalid station index.");
      }
      for (const time of [arrival, departure]) {
        if (time !== null && (!Number.isFinite(time) || time < 0)) {
          throw new Error("Seoul artifact call has an invalid time.");
        }
      }
      if (arrival === null && departure === null) throw new Error("Seoul artifact call has no time.");
    }
  }

  return artifact as SeoulSubwayArtifact;
}

export function encodeSeoulSubwayArtifact(artifact: SeoulSubwayArtifact): Buffer {
  validateSeoulSubwayArtifact(artifact);
  return gzipSync(Buffer.from(JSON.stringify(artifact)), { level: 9 });
}

export function decodeSeoulSubwayArtifact(buffer: Buffer): SeoulSubwayArtifact {
  const parsed = JSON.parse(gunzipSync(buffer).toString("utf8")) as unknown;
  return validateSeoulSubwayArtifact(parsed);
}

export function seoulServiceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));
  if (weekday === "Sat") return "saturday";
  if (weekday === "Sun") return "sunday_holiday";
  return "weekday";
}

export function searchSeoulSubwayArtifact(
  artifact: SeoulSubwayArtifact,
  query: SeoulJourneyQuery,
): TransitResult[] {
  const originIndex = artifact.stations.findIndex(
    (station) => station.toLowerCase() === query.origin.toLowerCase().trim(),
  );
  const destinationIndex = artifact.stations.findIndex(
    (station) => station.toLowerCase() === query.destination.toLowerCase().trim(),
  );
  if (originIndex < 0 || destinationIndex < 0) return [];

  const dayType = query.dayType ?? seoulServiceDayType(query.date);
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

  return buildSeoulJourneys(
    { encoding: "gzip-json", runs, dropped: {} },
    { ...query, dayType },
  );
}
