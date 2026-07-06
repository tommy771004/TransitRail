import type { TransitResult, JourneyLeg, TransitLine } from "../types";

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

function getDurationPerStation(country: string): number {
  if (["japan", "china", "germany", "france"].includes(country)) {
    return 15;
  }
  return 2;
}

function getCountryConfig(country: string, lineName: string, index: number) {
  const serviceSuffix = 100 + (index % 40) * 3;
  switch (country) {
    case "japan":
      return {
        currency: "JPY",
        operator: "JR",
        service: lineName.includes("Tōhoku") ? `Hayabusa ${serviceSuffix}` : `Hikari ${serviceSuffix}`,
        basePrice: 2200,
        perStopPrice: 1400,
        tags: ["high-speed", "shinkansen"],
        seatClass: "reserved" as const,
      };
    case "korea":
      return {
        currency: "KRW",
        operator: "Korail",
        service: `KTX ${serviceSuffix}`,
        basePrice: 12000,
        perStopPrice: 4500,
        tags: ["express", "ktx"],
        seatClass: "reserved" as const,
      };
    case "china":
      return {
        currency: "CNY",
        operator: "China Railway",
        service: `Fuxing G${serviceSuffix}`,
        basePrice: 50,
        perStopPrice: 30,
        tags: ["high-speed", "fuxing"],
        seatClass: "reserved" as const,
      };
    case "singapore":
      return {
        currency: "SGD",
        operator: "SMRT",
        service: lineName,
        basePrice: 1.5,
        perStopPrice: 0.1,
        tags: ["local", "subway"],
      };
    case "hong_kong":
      return {
        currency: "HKD",
        operator: "MTR",
        service: lineName,
        basePrice: 5.5,
        perStopPrice: 1.2,
        tags: ["local", "mtr"],
      };
    case "thailand":
      return {
        currency: "THB",
        operator: "BTS/MRT",
        service: lineName,
        basePrice: 17,
        perStopPrice: 4,
        tags: ["local", "bts-mrt"],
      };
    case "united_kingdom":
      return {
        currency: "GBP",
        operator: "TfL",
        service: lineName,
        basePrice: 2.8,
        perStopPrice: 0.4,
        tags: ["local", "underground"],
      };
    case "united_states":
      return {
        currency: "USD",
        operator: "MBTA",
        service: lineName,
        basePrice: 2.4,
        perStopPrice: 0.3,
        tags: ["local", "subway"],
      };
    case "germany":
      return {
        currency: "EUR",
        operator: "DB",
        service: `ICE ${serviceSuffix}`,
        basePrice: 19,
        perStopPrice: 8,
        tags: ["high-speed", "ice"],
        seatClass: "reserved" as const,
      };
    case "france":
      return {
        currency: "EUR",
        operator: "SNCF",
        service: `TGV ${serviceSuffix}`,
        basePrice: 19,
        perStopPrice: 8,
        tags: ["high-speed", "tgv"],
        seatClass: "reserved" as const,
      };
    default:
      return {
        currency: "USD",
        operator: "Transit",
        service: lineName,
        basePrice: 2.0,
        perStopPrice: 0.5,
        tags: ["local"],
      };
  }
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

export function generateFallbackTimetable(
  lines: TransitLine[],
  origin: string,
  destination: string,
  date: string,
  country: string
): TransitResult[] | null {
  const allStationNames = Array.from(new Set(lines.flatMap(l => l.stations.map(s => s.name))));
  const canonicalOrigin = allStationNames.find(
    (s) => s.toLowerCase().trim() === origin.toLowerCase().trim()
  );
  const canonicalDest = allStationNames.find(
    (s) => s.toLowerCase().trim() === destination.toLowerCase().trim()
  );

  if (!canonicalOrigin || !canonicalDest || canonicalOrigin === canonicalDest) {
    return null;
  }

  // Build adjacency graph of station-to-station edges on each line
  const adj = new Map<string, Array<{ to: string; lineName: string; lineColor: string; lineId: string }>>();

  for (const line of lines) {
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
          lineColor: line.color || "#94a3b8",
          lineId: line.id,
        });
      }
      if (i < line.stations.length - 1) {
        const next = line.stations[i + 1].name;
        adj.get(current)!.push({
          to: next,
          lineName: line.name,
          lineColor: line.color || "#94a3b8",
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
      prevLeg.durationMinutes += getDurationPerStation(country);
    } else {
      legs.push({
        lineName: step.lineName,
        lineId: step.lineId,
        lineColor: step.lineColor,
        origin: lastStation,
        destination: step.station,
        stops: [lastStation, step.station],
        durationMinutes: getDurationPerStation(country),
      });
    }
    lastStation = step.station;
  }

  // Calculate total duration including a 6-minute transfer wait time per transfer
  let totalDuration = 0;
  for (let i = 0; i < legs.length; i++) {
    totalDuration += legs[i].durationMinutes;
    if (i > 0) {
      totalDuration += 6; // 6 minutes transfer wait
    }
  }

  const isHighSpeed = ["japan", "china", "germany", "france"].includes(country);
  const headway = isHighSpeed ? 30 : 10;
  const startMinutes = 6 * 60; // 06:00
  const endMinutes = 23 * 60; // 23:00

  const results: TransitResult[] = [];
  let tripId = 0;

  for (let m = startMinutes; m <= endMinutes; m += headway) {
    let currentMinutes = m;
    const legResults: JourneyLeg[] = legs.map((leg) => {
      const legDep = currentMinutes;
      const legArr = currentMinutes + leg.durationMinutes;
      currentMinutes = legArr + 6; // next leg starts after transfer wait

      return {
        lineName: leg.lineName,
        lineCode: leg.lineId,
        color: leg.lineColor,
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

    const firstLeg = legs[0];
    const conf = getCountryConfig(country, firstLeg.lineName, tripId);
    const price = Math.round(conf.basePrice + conf.perStopPrice * foundPath.length);

    results.push({
      id: `fallback-${country}-${canonicalOrigin.replace(/\s+/g, "-")}-${canonicalDest.replace(/\s+/g, "-")}-${tripId++}`,
      country: country as any,
      date,
      operator: conf.operator,
      service: conf.service,
      departureTime: depTimeStr,
      arrivalTime: arrTimeStr,
      durationMinutes: totalDuration,
      price,
      currency: conf.currency,
      origin: canonicalOrigin,
      destination: canonicalDest,
      direct: legs.length === 1,
      stops: [canonicalOrigin, ...legs.map((l) => l.destination)],
      legs: legResults,
      transferStations: legs.slice(0, -1).map((l) => l.destination),
      tags: conf.tags,
      lineColor: firstLeg.lineColor,
      seatClass: conf.seatClass,
    });
  }

  return results;
}
