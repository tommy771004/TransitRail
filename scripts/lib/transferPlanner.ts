/**
 * Generic, name-based journey planner over static line topology. Generalises the
 * Hong Kong-specific findMtrJourney / findMtrTransferPlan (src/data/hongKongMtr.ts)
 * to any set of lines, so curated snapshots can derive real interchanges and
 * intermediate stops instead of hardcoded guesses.
 *
 * Limits (inherent to the repo's line data): each line is a single ordered array
 * with no branch modelling, and cross-network interchanges are only found when
 * both networks use the SAME station name. Callers must treat a null result — or
 * an implausibly long plan — as "topology can't resolve this" and fall back to a
 * curated value or the LLM gap-filler.
 */
export interface PlannerLine {
  name: string;
  stations: string[]; // ordered station names along the line
}

export interface PlannedLeg {
  line: string;
  from: string;
  to: string;
  stops: string[]; // ordered stations, inclusive of from and to
}

export interface JourneyPlan {
  direct: boolean;
  interchange?: string;
  legs: PlannedLeg[];
  /** Number of station-to-station hops across the whole journey. */
  hops: number;
}

const norm = (s: string) => s.toLowerCase().trim();

function subPath(line: PlannerLine, from: string, to: string): string[] | null {
  const i = line.stations.findIndex((s) => norm(s) === norm(from));
  const j = line.stations.findIndex((s) => norm(s) === norm(to));
  if (i < 0 || j < 0 || i === j) return null;
  return i < j ? line.stations.slice(i, j + 1) : line.stations.slice(j, i + 1).reverse();
}

/**
 * Best (fewest-hops) direct or single-transfer plan, or null if no single line
 * connects them and no shared-name interchange links a line through the origin
 * to a line through the destination.
 */
export function planJourney(
  lines: PlannerLine[],
  origin: string,
  destination: string,
): JourneyPlan | null {
  let best: JourneyPlan | null = null;
  const consider = (plan: JourneyPlan) => {
    if (!best || plan.hops < best.hops) best = plan;
  };

  // Direct: any single line containing both.
  for (const line of lines) {
    const path = subPath(line, origin, destination);
    if (path) {
      consider({ direct: true, legs: [{ line: line.name, from: origin, to: destination, stops: path }], hops: path.length - 1 });
    }
  }
  if (best) return best;

  // One transfer: interchange is a station shared by a line through the origin
  // and a (different) line through the destination.
  const originLines = lines.filter((l) => l.stations.some((s) => norm(s) === norm(origin)));
  const destLines = lines.filter((l) => l.stations.some((s) => norm(s) === norm(destination)));
  for (const l1 of originLines) {
    for (const l2 of destLines) {
      if (l1 === l2) continue;
      for (const station of l1.stations) {
        if (norm(station) === norm(origin) || norm(station) === norm(destination)) continue;
        if (!l2.stations.some((s) => norm(s) === norm(station))) continue;
        const leg1 = subPath(l1, origin, station);
        const leg2 = subPath(l2, station, destination);
        if (!leg1 || !leg2) continue;
        consider({
          direct: false,
          interchange: station,
          legs: [
            { line: l1.name, from: origin, to: station, stops: leg1 },
            { line: l2.name, from: station, to: destination, stops: leg2 },
          ],
          hops: leg1.length - 1 + (leg2.length - 1),
        });
      }
    }
  }
  return best;
}
