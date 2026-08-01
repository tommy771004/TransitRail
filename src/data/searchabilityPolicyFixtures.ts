import type { Country, TransitResult } from "../types";
import type { ScrapedRouteData } from "./scraped/timetableDay";

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

function canonicalResults(country: Country, origin: string, destination: string): TransitResult[] {
  return ["08:00", "09:00", "10:00"].map((departureTime, index) => fixtureResult(
    country,
    origin,
    destination,
    {
      id: `canonical-${index}`,
      date: undefined,
      departureTime,
      arrivalTime: `${String(Number(departureTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
    },
  ));
}

export const searchabilityPolicyFixtures = {
  verified: {
    country: "korea" as const,
    route: {
      origin: "Seoul (SNC)",
      destination: "Busan (BSN)",
      date: SEARCHABILITY_FIXTURE_DATE,
      scrapedAt: "2026-08-01T00:00:00.000Z",
      source: "Seoul Metro official timetable CSV",
      provenance: "official" as const,
      results: [
        fixtureResult("korea", "Seoul (SNC)", "Busan (BSN)"),
        ...canonicalResults("korea", "Seoul (SNC)", "Daejeon").slice(0, 2).map((row, index) => ({
          ...row,
          id: `${SEARCHABILITY_FIXTURE_DATE}-verified-${index}`,
          date: SEARCHABILITY_FIXTURE_DATE,
        })),
      ],
    } satisfies ScrapedRouteData,
  },
  indicative: {
    country: "germany" as const,
    route: {
      origin: "Berlin Hbf",
      destination: "Munich Hbf",
      date: "",
      scrapedAt: "2026-08-01T00:00:00.000Z",
      source: "curated snapshot",
      provenance: "curated" as const,
      results: canonicalResults("germany", "Berlin Hbf", "Munich Hbf"),
    } satisfies ScrapedRouteData,
  },
  stale: {
    country: "hong_kong" as const,
    route: {
      origin: "Central",
      destination: "Airport",
      date: SEARCHABILITY_FIXTURE_DATE,
      scrapedAt: "2026-08-01T00:00:00.000Z",
      source: "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php",
      provenance: "official" as const,
      results: [fixtureResult("hong_kong", "Central", "Airport", {
        realtime: true,
        id: "2026-07-31T23:00:00-fixture",
      })],
    } satisfies ScrapedRouteData,
  },
  noService: {
    country: "korea" as const,
    route: {
      origin: "Seoul (SNC)",
      destination: "Busan (BSN)",
      date: "2026-07-31",
      scrapedAt: "2026-07-31T00:00:00.000Z",
      source: "Seoul Metro official timetable CSV",
      provenance: "official" as const,
      results: [fixtureResult("korea", "Seoul (SNC)", "Busan (BSN)", {
        date: "2026-07-31",
        id: "2026-07-31-no-service",
      })],
    } satisfies ScrapedRouteData,
  },
} as const;

export const malformedSearchabilitySource = {
  origin: "Central",
  destination: "Airport",
  results: [{ id: "not-a-timetable-row" }],
} as const;
