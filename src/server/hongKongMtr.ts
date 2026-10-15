import {
  findMtrJourney,
  findMtrTransferPlan,
  hongKongMtrLineCatalog,
  mtrLineColors,
  mtrTerminalReachesDestination,
} from "../data/hongKongMtr";
import type { MtrJourney, MtrLineCatalogEntry, MtrStation } from "../data/hongKongMtr";
import { resolveStationAlias } from "../data/stationAliases";
import { stationSearchKey } from "../data/stationKey";
import { getHongKongStationName } from "../data/stationIdentity";
import type { JourneyLeg, SearchResponse, TransitResult } from "../types";

const MTR_NEXT_TRAIN_URL = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

interface MtrTrain {
  dest?: string;
  plat?: string;
  seq?: string;
  time?: string;
  valid?: string;
}

interface MtrPayload {
  status?: number;
  message?: string;
  isdelay?: string;
  data?: Record<string, {
    UP?: MtrTrain[];
    DOWN?: MtrTrain[];
  }>;
}

function dateInHongKong() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function fetchNextTrainPayload(lineCode: string, stationCode: string): Promise<MtrPayload> {
  const query = new URLSearchParams({ line: lineCode, sta: stationCode, lang: "EN" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${MTR_NEXT_TRAIN_URL}?${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`MTR returned HTTP ${response.status}.`);
    }
    return await response.json() as MtrPayload;
  } finally {
    clearTimeout(timeout);
  }
}

function stationNameForCode(code?: string) {
  if (!code) return undefined;
  return getHongKongStationName(code);
}

function validTrains(payload: MtrPayload, journey: MtrJourney): MtrTrain[] {
  const stationData = payload.data?.[`${journey.line.code}-${journey.origin.code}`];
  return (stationData?.[journey.direction] || []).filter(
    (train) =>
      train.valid !== "N" &&
      mtrTerminalReachesDestination(journey, train.dest),
  );
}

function intermediateStops(journey: MtrJourney): string[] {
  return journey.line.stations
    .slice(
      Math.min(journey.originIndex, journey.destinationIndex) + 1,
      Math.max(journey.originIndex, journey.destinationIndex),
    )
    .map((station) => station.name);
}

function trainTime(train: MtrTrain) {
  return train.time?.slice(11, 16) || "--:--";
}

export async function searchHongKongMtr(
  origin: string,
  destination: string,
  date: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  if (date !== dateInHongKong()) {
    return {
      status: 400,
      body: {
        error: "Live date required",
        message: "Hong Kong MTR Next Train only provides live departures for today.",
        results: [],
        source: MTR_NEXT_TRAIN_URL,
      },
    };
  }

  const journey = findMtrJourney(origin, destination);
  if (journey) {
    return searchDirect(origin, destination, journey);
  }

  const transferPlan = findMtrTransferPlan(origin, destination);
  if (transferPlan) {
    return searchWithTransfer(origin, destination, transferPlan.firstLeg, transferPlan.secondLeg, transferPlan.interchange);
  }

  return {
    status: 400,
    body: {
      error: "Route not supported",
      message: "No supported MTR route (direct or one transfer) connects these stations in the live feed.",
      results: [],
      source: MTR_NEXT_TRAIN_URL,
    },
  };
}

async function searchDirect(
  origin: string,
  destination: string,
  journey: MtrJourney,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  try {
    const payload = await fetchNextTrainPayload(journey.line.code, journey.origin.code);
    if (payload.status !== 1) {
      return mtrServiceAlert(payload);
    }

    const trains = validTrains(payload, journey);
    const results: TransitResult[] = trains.map((train, index) => ({
      id: `hk-${journey.line.code}-${journey.origin.code}-${train.time || index}-${train.seq || index}`,
      country: "hong_kong",
      operator: "MTR",
      service: journey.line.name,
      trainType: "Next train",
      departureTime: trainTime(train),
      origin,
      destination,
      direct: true,
      stops: intermediateStops(journey),
      platform: train.plat,
      headsign: stationNameForCode(train.dest) || train.dest,
      realtime: true,
      lineColor: mtrLineColors[journey.line.code],
      warning: payload.isdelay === "Y" ? "MTR reports a delay on this line." : undefined,
    }));

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0 ? "No direct live departures currently reach the selected station." : undefined,
        source: MTR_NEXT_TRAIN_URL,
      },
    };
  } catch (error) {
    return mtrRequestFailed(error);
  }
}

async function searchWithTransfer(
  origin: string,
  destination: string,
  firstLeg: MtrJourney,
  secondLeg: MtrJourney,
  interchange: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  try {
    const [firstPayload, secondPayload] = await Promise.all([
      fetchNextTrainPayload(firstLeg.line.code, firstLeg.origin.code),
      fetchNextTrainPayload(secondLeg.line.code, secondLeg.origin.code),
    ]);
    if (firstPayload.status !== 1) return mtrServiceAlert(firstPayload);
    if (secondPayload.status !== 1) return mtrServiceAlert(secondPayload);

    const firstTrains = validTrains(firstPayload, firstLeg).slice(0, 3);
    const secondTrains = validTrains(secondPayload, secondLeg);
    const secondTimes = secondTrains.map(trainTime);
    const delayWarning = firstPayload.isdelay === "Y" || secondPayload.isdelay === "Y"
      ? "MTR reports a delay on part of this route."
      : undefined;

    const secondLegInfo: JourneyLeg = {
      lineName: secondLeg.line.name,
      lineCode: secondLeg.line.code,
      color: mtrLineColors[secondLeg.line.code],
      origin: interchange,
      destination,
      platform: secondTrains[0]?.plat,
      headsign: stationNameForCode(secondTrains[0]?.dest) || secondTrains[0]?.dest,
      stopCount: intermediateStops(secondLeg).length + 1,
      upcomingDepartures: secondTimes.slice(0, 3),
    };

    const results: TransitResult[] = firstTrains.map((train, index) => ({
      id: `hk-x-${firstLeg.line.code}-${firstLeg.origin.code}-${train.time || index}-${train.seq || index}`,
      country: "hong_kong",
      operator: "MTR",
      service: `${firstLeg.line.name} + ${secondLeg.line.name}`,
      trainType: "Next train",
      departureTime: trainTime(train),
      origin,
      destination,
      direct: false,
      stops: [...intermediateStops(firstLeg), interchange, ...intermediateStops(secondLeg)],
      platform: train.plat,
      headsign: stationNameForCode(train.dest) || train.dest,
      realtime: true,
      lineColor: mtrLineColors[firstLeg.line.code],
      transferStations: [interchange],
      legs: [
        {
          lineName: firstLeg.line.name,
          lineCode: firstLeg.line.code,
          color: mtrLineColors[firstLeg.line.code],
          origin,
          destination: interchange,
          departureTime: trainTime(train),
          platform: train.plat,
          headsign: stationNameForCode(train.dest) || train.dest,
          stopCount: intermediateStops(firstLeg).length + 1,
        },
        secondLegInfo,
      ],
      warning: delayWarning,
    }));

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0
          ? "No live departures currently reach the transfer station."
          : "Second-leg times are the current next trains at the interchange, not guaranteed connections.",
        source: MTR_NEXT_TRAIN_URL,
      },
    };
  } catch (error) {
    return mtrRequestFailed(error);
  }
}

function mtrServiceAlert(payload: MtrPayload): { status: number; body: SearchResponse & { error?: string } } {
  return {
    status: 503,
    body: {
      error: "MTR service alert",
      message: payload.message || "MTR live departures are temporarily unavailable.",
      results: [],
      source: MTR_NEXT_TRAIN_URL,
    },
  };
}

function mtrRequestFailed(error: unknown): { status: number; body: SearchResponse & { error?: string } } {
  return {
    status: 502,
    body: {
      error: "Provider request failed",
      message: error instanceof Error && error.name === "AbortError"
        ? "MTR request timed out."
        : "Could not reach the MTR live data service.",
      results: [],
      source: MTR_NEXT_TRAIN_URL,
    },
  };
}

export interface MtrBoardDeparture {
  /** Departure instant on the Hong Kong clock. */
  at: string;
  /** Termini such as Central alternate platforms, so each train carries its own. */
  platform?: string;
}

/** Trains towards one terminus, as the station screens group them. */
export interface MtrBoardGroup {
  direction: "UP" | "DOWN";
  /** Terminus as the line table names it; the client localises it. */
  destination: string;
  /** Soonest first. */
  departures: MtrBoardDeparture[];
}

export interface MtrBoardLine {
  code: string;
  name: string;
  color?: string;
  /** MTR's line-wide delay flag; it never names a train. */
  delayed: boolean;
  /** The feed did not answer for this line. That is not the same as no trains. */
  unavailable: boolean;
  groups: MtrBoardGroup[];
}

export interface MtrStationBoard {
  station: string;
  lines: MtrBoardLine[];
  checkedAt: string;
  source: string;
}

/**
 * Every line calling at the station, with that line's own code for it. The
 * name is matched as written first: search treats walkway-linked stations
 * such as Central and Hong Kong as one, but their platforms are not.
 */
export function mtrStationLines(stationName: string): Array<{ line: MtrLineCatalogEntry; station: MtrStation }> {
  const linesMatching = (keyOf: (name: string) => string) => {
    const key = keyOf(stationName);
    return hongKongMtrLineCatalog.flatMap((line) => {
      const station = line.stations.find((candidate) => keyOf(candidate.name) === key);
      return station ? [{ line, station }] : [];
    });
  };
  const exact = linesMatching(stationSearchKey);
  return exact.length > 0
    ? exact
    : linesMatching((name) => stationSearchKey(resolveStationAlias("hong_kong", name)));
}

/** "2026-10-15 14:02:00" on the Hong Kong clock, as an unambiguous instant. */
function trainInstant(train: MtrTrain): string | undefined {
  const match = train.time?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  return match ? `${match[1]}T${match[2]}+08:00` : undefined;
}

function boardGroups(payload: MtrPayload, lineCode: string, stationCode: string): MtrBoardGroup[] {
  const stationData = payload.data?.[`${lineCode}-${stationCode}`];
  const groups: MtrBoardGroup[] = [];
  for (const direction of ["UP", "DOWN"] as const) {
    for (const train of stationData?.[direction] || []) {
      const at = trainInstant(train);
      if (train.valid === "N" || !at || !train.dest) continue;
      const destination = stationNameForCode(train.dest) || train.dest;
      let group = groups.find((entry) => entry.direction === direction && entry.destination === destination);
      if (!group) {
        group = { direction, destination, departures: [] };
        groups.push(group);
      }
      group.departures.push({ at, platform: train.plat });
    }
  }
  for (const group of groups) group.departures.sort((a, b) => a.at.localeCompare(b.at));
  return groups;
}

/**
 * The live departures screen for one station: every line through it, each
 * direction and terminus with its next trains. A line whose feed fails is
 * marked unavailable and the rest still show; nothing is estimated.
 */
export async function hongKongStationBoard(stationName: string): Promise<MtrStationBoard | null> {
  const served = mtrStationLines(stationName);
  if (served.length === 0) return null;
  const lines = await Promise.all(served.map(async ({ line, station }): Promise<MtrBoardLine> => {
    const base = { code: line.code, name: line.name, color: line.color };
    try {
      const payload = await fetchNextTrainPayload(line.code, station.code);
      if (payload.status !== 1) return { ...base, delayed: false, unavailable: true, groups: [] };
      return {
        ...base,
        delayed: payload.isdelay === "Y",
        unavailable: false,
        groups: boardGroups(payload, line.code, station.code),
      };
    } catch {
      return { ...base, delayed: false, unavailable: true, groups: [] };
    }
  }));
  return {
    station: served[0].station.name,
    lines,
    checkedAt: new Date().toISOString(),
    source: MTR_NEXT_TRAIN_URL,
  };
}
