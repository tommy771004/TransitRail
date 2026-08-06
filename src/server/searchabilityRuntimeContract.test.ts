import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEARCHABILITY_FIXTURE_DATE,
  SEARCHABILITY_FIXTURE_NOW,
  searchabilityPolicyFixtures,
} from "../data/searchabilityPolicyFixtures";
import { decideSearchability } from "../data/searchabilityPolicy";

const fixture = searchabilityPolicyFixtures.verified;

vi.mock("../data/scraped", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/scraped")>();
  return {
    ...actual,
    findScrapedSearchability: (country: typeof fixture.country, origin: string, destination: string, date?: string) => {
      if (country !== fixture.country || origin !== fixture.route.origin || destination !== fixture.route.destination) {
        return null;
      }
      const decision = decideSearchability({
        country,
        serviceDay: date,
        origin,
        destination,
        source: fixture.route,
        now: SEARCHABILITY_FIXTURE_NOW,
      });
      return decision.searchable ? { decision, results: fixture.route.results } : null;
    },
    getScrapedRoutes: () => [fixture.route],
    getScrapedCountryFreshness: () => fixture.route.scrapedAt,
    getScrapedCoverageNames: () => [fixture.route.origin, fixture.route.destination],
  };
});

import { runTransitSearch } from "./transitSearch";

describe("searchability policy runtime wiring", () => {
  // Korea enforces its published date range, so the fixture's service day has
  // to be inside the window the clock says is current.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(SEARCHABILITY_FIXTURE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("carries the shared verified fixture through the journey coordinator", async () => {
    const result = await runTransitSearch({
      country: fixture.country,
      origin: fixture.route.origin,
      destination: fixture.route.destination,
      date: SEARCHABILITY_FIXTURE_DATE,
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload).toMatchObject({
      source: "scraped",
      provenance: "official",
      truthMode: "verified",
    });
    expect(result.payload.results).toHaveLength(fixture.route.results.length);
  });
});
