import type { TransitResult, TransitLine, JourneyLeg } from "../types";

/**
 * Aligns route search legs with the complete sequence of stations from the metro line database.
 * This is applicable to C & D level metro systems (Singapore, Thailand, USA, Hong Kong).
 * No intermediate times are estimated; only station names are retrieved.
 * Long-distance high-speed rail (Japan Shinkansen, Korea KTX) is kept simplified.
 */
export function enrichTransitResultsWithLineStations(
  results: TransitResult[],
  countryLines: TransitLine[],
  country: string
): TransitResult[] {
  const allowedCountries = ["singapore", "thailand", "united_states", "hong_kong", "united_kingdom"];
  if (!allowedCountries.includes(country) || !countryLines || countryLines.length === 0) {
    return results;
  }

  return results.map((result) => {
    // Deep clone the legs to avoid mutating original cache/objects
    const legs: JourneyLeg[] = result.legs ? JSON.parse(JSON.stringify(result.legs)) : [];
    
    // If there are no legs, synthesize one leg for the whole trip so it can be mapped
    if (legs.length === 0) {
      legs.push({
        lineName: result.service || "Transit",
        origin: result.origin,
        destination: result.destination,
        departureTime: result.departureTime,
        arrivalTime: result.arrivalTime,
        durationMinutes: result.durationMinutes,
      });
    }

    let modified = false;

    for (const leg of legs) {
      const oName = (leg.origin || "").toLowerCase().trim();
      const dName = (leg.destination || "").toLowerCase().trim();

      if (!oName || !dName) continue;

      let matchedLine: TransitLine | undefined;
      let matchedOriginIdx = -1;
      let matchedDestIdx = -1;

      const lineNameLower = (leg.lineName || "").toLowerCase().trim();
      const lineCodeLower = (leg.lineCode || "").toLowerCase().trim();

      for (const line of countryLines) {
        const oIdx = line.stations.findIndex(
          (s) => s.name.toLowerCase().trim() === oName
        );
        const dIdx = line.stations.findIndex(
          (s) => s.name.toLowerCase().trim() === dName
        );

        if (oIdx !== -1 && dIdx !== -1 && oIdx !== dIdx) {
          const currLineName = (line.name || "").toLowerCase().trim();
          const currLineId = (line.id || "").toLowerCase().trim();

          // Try to match by line name or line code
          const isNameMatch =
            lineNameLower &&
            (currLineName.includes(lineNameLower) ||
              lineNameLower.includes(currLineName) ||
              currLineId === lineCodeLower);

          if (isNameMatch) {
            matchedLine = line;
            matchedOriginIdx = oIdx;
            matchedDestIdx = dIdx;
            break; // Perfect match found
          }

          // Fallback match: the first line containing both stations
          if (!matchedLine) {
            matchedLine = line;
            matchedOriginIdx = oIdx;
            matchedDestIdx = dIdx;
          }
        }
      }

      if (matchedLine && matchedOriginIdx !== -1 && matchedDestIdx !== -1) {
        let stationsList: string[] = [];
        if (matchedOriginIdx < matchedDestIdx) {
          stationsList = matchedLine.stations
            .slice(matchedOriginIdx, matchedDestIdx + 1)
            .map((s) => s.name);
        } else {
          stationsList = matchedLine.stations
            .slice(matchedDestIdx, matchedOriginIdx + 1)
            .map((s) => s.name)
            .reverse();
        }

        if (stationsList.length >= 2) {
          leg.stops = stationsList;
          leg.stopCount = stationsList.length - 1;
          leg.color = leg.color || matchedLine.color;
          modified = true;
        }
      }
    }

    if (modified) {
      const allStops: string[] = [];
      for (let i = 0; i < legs.length; i++) {
        const legStops = legs[i].stops || [legs[i].origin, legs[i].destination];
        if (i === 0) {
          allStops.push(...legStops);
        } else {
          allStops.push(...legStops.slice(1));
        }
      }

      const transferStations: string[] = [];
      for (let i = 0; i < legs.length - 1; i++) {
        transferStations.push(legs[i].destination);
      }

      return {
        ...result,
        legs,
        stops: allStops,
        transferStations,
        direct: legs.length === 1,
      };
    }

    return result;
  });
}
