import { seoulSubwayLines, seoulSubwayStationNames } from "../data/seoulSubway";
import type { TransitResult, JourneyLeg } from "../types";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Step {
  station: string;
  lineName: string;
  lineColor: string;
  lineId: string;
}

interface QueueItem {
  station: string;
  path: Step[];
}

export function generateSeoulSubwayTimetable(
  origin: string,
  destination: string,
  date: string
): TransitResult[] | null {
  const canonicalOrigin = seoulSubwayStationNames.find(
    (s) => s.toLowerCase() === origin.toLowerCase().trim()
  );
  const canonicalDest = seoulSubwayStationNames.find(
    (s) => s.toLowerCase() === destination.toLowerCase().trim()
  );

  if (!canonicalOrigin || !canonicalDest || canonicalOrigin === canonicalDest) {
    return null;
  }

  // Build adjacency graph of station-to-station edges on each line
  const adj = new Map<string, Array<{ to: string; lineName: string; lineColor: string; lineId: string }>>();

  for (const line of seoulSubwayLines) {
    for (let i = 0; i < line.stations.length; i++) {
      const current = line.stations[i].name;
      if (!adj.has(current)) {
        adj.set(current, []);
      }
      if (i > 0) {
        const prev = line.stations[i - 1].name;
        adj.get(current)!.push({
          to: prev,
          lineName: line.name,
          lineColor: line.color,
          lineId: line.id,
        });
      }
      if (i < line.stations.length - 1) {
        const next = line.stations[i + 1].name;
        adj.get(current)!.push({
          to: next,
          lineName: line.name,
          lineColor: line.color,
          lineId: line.id,
        });
      }
    }
  }

  // BFS to find the path with the minimum number of stops (edges)
  const queue: QueueItem[] = [{ station: canonicalOrigin, path: [] }];
  const visited = new Set<string>([canonicalOrigin]);
  let foundPath: Step[] | null = null;

  while (queue.length > 0) {
    const { station, path } = queue.shift()!;
    if (station === canonicalDest) {
      foundPath = path;
      break;
    }

    const neighbors = adj.get(station) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({
          station: edge.to,
          path: [
            ...path,
            {
              station: edge.to,
              lineName: edge.lineName,
              lineColor: edge.lineColor,
              lineId: edge.lineId,
            },
          ],
        });
      }
    }
  }

  if (!foundPath || foundPath.length === 0) {
    return null;
  }

  // Group consecutive steps on the same line into journey legs
  const legs: any[] = [];
  let lastStation = canonicalOrigin;

  for (let i = 0; i < foundPath.length; i++) {
    const step = foundPath[i];
    const prevLeg = legs[legs.length - 1];

    if (prevLeg && prevLeg.lineId === step.lineId) {
      prevLeg.destination = step.station;
      prevLeg.stops.push(step.station);
      prevLeg.durationMinutes += 2; // assume 2 minutes per station stop
    } else {
      legs.push({
        lineName: step.lineName,
        lineId: step.lineId,
        lineColor: step.lineColor,
        origin: lastStation,
        destination: step.station,
        stops: [lastStation, step.station],
        durationMinutes: 2,
      });
    }
    lastStation = step.station;
  }

  // Calculate total duration including a 5-minute transfer wait time per transfer
  let totalDuration = 0;
  for (let i = 0; i < legs.length; i++) {
    totalDuration += legs[i].durationMinutes;
    if (i > 0) {
      totalDuration += 5; // 5 minutes transfer wait
    }
  }

  // Subway fare calculation: base fare 1400 KRW + 100 KRW extra per 3 stops over 5 stops
  const baseFare = 1400;
  const extraFare = Math.max(0, Math.floor((foundPath.length - 5) / 3)) * 100;
  const price = baseFare + extraFare;

  // Generate departures every 10 minutes between 06:00 and 23:00
  const results: TransitResult[] = [];
  const startMinutes = 6 * 60; // 06:00
  const endMinutes = 23 * 60; // 23:00
  const headway = 10; // every 10 minutes

  let tripId = 0;
  for (let m = startMinutes; m <= endMinutes; m += headway) {
    let currentMinutes = m;
    const legResults: JourneyLeg[] = legs.map((leg) => {
      const legDep = currentMinutes;
      const legArr = currentMinutes + leg.durationMinutes;
      currentMinutes = legArr + 5; // next leg starts after transfer wait

      return {
        lineName: leg.lineName,
        lineCode: leg.lineId,
        origin: leg.origin,
        destination: leg.destination,
        departureTime: formatTime(legDep),
        arrivalTime: formatTime(legArr),
        durationMinutes: leg.durationMinutes,
        stopCount: leg.stops.length - 1,
        headsign: `${leg.destination} directions`,
      };
    });

    const depTimeStr = formatTime(m);
    const arrTimeStr = formatTime(m + totalDuration);

    results.push({
      id: `seoul-subway-${canonicalOrigin.replace(/\s+/g, "-")}-${canonicalDest.replace(/\s+/g, "-")}-${tripId++}`,
      country: "korea",
      date,
      operator: "Seoul Metro",
      service: legs.map((l) => l.lineName).join(" → "),
      departureTime: depTimeStr,
      arrivalTime: arrTimeStr,
      durationMinutes: totalDuration,
      price,
      currency: "KRW",
      origin: canonicalOrigin,
      destination: canonicalDest,
      direct: legs.length === 1,
      stops: [canonicalOrigin, ...legs.map((l) => l.destination)],
      legs: legResults,
      transferStations: legs.slice(0, -1).map((l) => l.destination),
      tags: ["local", "subway"],
    });
  }

  return results;
}
