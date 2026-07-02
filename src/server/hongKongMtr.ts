import {
  findMtrJourney,
  hongKongMtrLines,
  mtrTerminalReachesDestination,
} from "../data/hongKongMtr";
import type { SearchResponse, TransitResult } from "../types";

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
  if (!journey) {
    return {
      status: 400,
      body: {
        error: "Direct line required",
        message: "Choose two stations on the same supported MTR line. Transfer routing is not available from this live feed.",
        results: [],
        source: MTR_NEXT_TRAIN_URL,
      },
    };
  }

  const query = new URLSearchParams({
    line: journey.line.code,
    sta: journey.origin.code,
    lang: "EN",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`${MTR_NEXT_TRAIN_URL}?${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        status: 502,
        body: {
          error: "Provider request failed",
          message: `MTR returned HTTP ${response.status}.`,
          results: [],
          source: MTR_NEXT_TRAIN_URL,
        },
      };
    }

    const payload = await response.json() as MtrPayload;
    if (payload.status !== 1) {
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

    const stationData = payload.data?.[`${journey.line.code}-${journey.origin.code}`];
    const trains = (stationData?.[journey.direction] || []).filter(
      (train) =>
        train.valid !== "N" &&
        mtrTerminalReachesDestination(journey, train.dest),
    );

    const results: TransitResult[] = trains.map((train, index) => {
      const terminal = hongKongMtrLines
        .flatMap((line) => line.stations)
        .find((station) => station.code === train.dest);
      return {
        id: `hk-${journey.line.code}-${journey.origin.code}-${train.time || index}-${train.seq || index}`,
        country: "hong_kong",
        operator: "MTR",
        service: journey.line.name,
        trainType: "Next train",
        departureTime: train.time?.slice(11, 16) || "--:--",
        origin,
        destination,
        direct: true,
        stops: journey.line.stations
          .slice(
            Math.min(journey.originIndex, journey.destinationIndex) + 1,
            Math.max(journey.originIndex, journey.destinationIndex),
          )
          .map((station) => station.name),
        platform: train.plat,
        headsign: terminal?.name || train.dest,
        realtime: true,
        warning: payload.isdelay === "Y" ? "MTR reports a delay on this line." : undefined,
      };
    });

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0 ? "No direct live departures currently reach the selected station." : undefined,
        source: MTR_NEXT_TRAIN_URL,
      },
    };
  } catch (error) {
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
  } finally {
    clearTimeout(timeout);
  }
}
