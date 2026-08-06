import type { Country, TransitResult } from "../types";
import type { ScrapedRouteData } from "./scraped/timetableDay";
import { buildSourceMeta, type OfficialSourceId } from "./sourceRegistry";

/** Stable service-day fixtures shared by journey, catalog, and publication tests. */
export const SEARCHABILITY_FIXTURE_DATE = "2026-08-01";
export const SEARCHABILITY_FIXTURE_NOW = new Date("2026-08-01T04:00:00.000Z");

export function fixtureResult(
  country: Country,
  origin: string,
  destination: string,
  overrides: Partial<TransitResult> = {},
): TransitResult {
  return {
    id: `${SEARCHABILITY_FIXTURE_DATE}-fixture`,
    country,
    operator: "Fixture Rail",
    service: "Fixture Express",
    date: SEARCHABILITY_FIXTURE_DATE,
    departureTime: "09:00",
    arrivalTime: "10:00",
    origin,
    destination,
    direct: true,
    stops: [origin, destination],
    ...overrides,
  };
}

/** Attach the source block the pipeline would have written for this source. */
function fromSource(sourceId: OfficialSourceId, route: Omit<ScrapedRouteData, "source" | "sourceMeta" | "provenance">): ScrapedRouteData {
  const sourceMeta = buildSourceMeta({ sourceId, fetchedAt: route.scrapedAt });
  return { ...route, source: sourceMeta.sourceName, sourceMeta, provenance: "official" };
}

function datedResults(country: Country, origin: string, destination: string, date: string): TransitResult[] {
  return ["08:00", "09:00", "10:00"].map((departureTime, index) => fixtureResult(
    country,
    origin,
    destination,
    {
      id: `${date}-${origin}-${index}`,
      date,
      departureTime,
      arrivalTime: `${String(Number(departureTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
    },
  ));
}

export const searchabilityPolicyFixtures = {
  verified: {
    country: "korea" as const,
    route: fromSource("kr-seoul-metro-csv", {
      origin: "Seoul (SNC)",
      destination: "Busan (BSN)",
      date: SEARCHABILITY_FIXTURE_DATE,
      scrapedAt: "2026-08-01T00:00:00.000Z",
      results: [
        fixtureResult("korea", "Seoul (SNC)", "Busan (BSN)"),
        ...datedResults("korea", "Seoul (SNC)", "Daejeon", SEARCHABILITY_FIXTURE_DATE).slice(0, 2),
      ],
    }),
  },
  /**
   * A route that reads as official but is vouched for by nobody: rows, a
   * plausible label, no registered source block. This is what every curated
   * snapshot now looks like to the policy, and what a hand-written file looks
   * like. The fixture is named for the outcome, not the old "indicative" tier —
   * there is no tier below verified any more.
   */
  unverified: {
    country: "germany" as const,
    route: {
      origin: "Berlin Hbf",
      destination: "Munich Hbf",
      date: SEARCHABILITY_FIXTURE_DATE,
      scrapedAt: "2026-08-01T00:00:00.000Z",
      source: "Long distance rail timetable",
      results: datedResults("germany", "Berlin Hbf", "Munich Hbf", SEARCHABILITY_FIXTURE_DATE),
    } satisfies ScrapedRouteData,
  },
  /** A registered source whose rows carry an explicit curated marker. */
  curated: {
    country: "germany" as const,
    route: {
      ...fromSource("de-gtfs", {
        origin: "Berlin Hbf",
        destination: "Munich Hbf",
        date: SEARCHABILITY_FIXTURE_DATE,
        scrapedAt: "2026-08-01T00:00:00.000Z",
        results: datedResults("germany", "Berlin Hbf", "Munich Hbf", SEARCHABILITY_FIXTURE_DATE),
      }),
      provenance: "curated" as const,
    },
  },
  stale: {
    country: "hong_kong" as const,
    route: fromSource("hk-mtr-next-train", {
      origin: "Central",
      destination: "Airport",
      date: SEARCHABILITY_FIXTURE_DATE,
      scrapedAt: "2026-08-01T00:00:00.000Z",
      results: [fixtureResult("hong_kong", "Central", "Airport", {
        realtime: true,
        id: "2026-07-31T23:00:00-fixture",
      })],
    }),
  },
  noService: {
    country: "korea" as const,
    route: fromSource("kr-seoul-metro-csv", {
      origin: "Seoul (SNC)",
      destination: "Busan (BSN)",
      date: "2026-07-31",
      scrapedAt: "2026-07-31T00:00:00.000Z",
      results: [fixtureResult("korea", "Seoul (SNC)", "Busan (BSN)", {
        date: "2026-07-31",
        id: "2026-07-31-no-service",
      })],
    }),
  },
} as const;

export const malformedSearchabilitySource = {
  origin: "Central",
  destination: "Airport",
  results: [{ id: "not-a-timetable-row" }],
} as const;
