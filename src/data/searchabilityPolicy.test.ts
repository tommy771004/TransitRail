import { describe, expect, it } from "vitest";
import {
  SEARCHABILITY_FIXTURE_DATE,
  SEARCHABILITY_FIXTURE_NOW,
  searchabilityPolicyFixtures,
} from "./searchabilityPolicyFixtures";
import {
  decideSearchability,
  searchableRoutesForContext,
  type SearchabilityPolicyRequest,
} from "./searchabilityPolicy";
import { buildSourceMeta } from "./sourceRegistry";

const SERVICE_DAY = SEARCHABILITY_FIXTURE_DATE;
const NOW = SEARCHABILITY_FIXTURE_NOW;
const verifiedRoute = searchabilityPolicyFixtures.verified.route;
const unverifiedRoute = searchabilityPolicyFixtures.unverified.route;
const curatedRoute = searchabilityPolicyFixtures.curated.route;
const staleRoute = searchabilityPolicyFixtures.stale.route;

describe("Searchability policy contract", () => {
  it.each(([
    {
      name: "accepts a verified route for its service day",
      request: {
        country: verifiedRoute.results[0].country,
        serviceDay: SERVICE_DAY,
        origin: verifiedRoute.origin,
        destination: verifiedRoute.destination,
        source: verifiedRoute,
        now: NOW,
      },
      expected: { searchable: true, truthMode: "verified", reason: undefined },
    },
    {
      name: "rejects a route no registered source vouches for",
      request: {
        country: searchabilityPolicyFixtures.unverified.country,
        serviceDay: SERVICE_DAY,
        origin: unverifiedRoute.origin,
        destination: unverifiedRoute.destination,
        source: unverifiedRoute,
        now: NOW,
      },
      expected: { searchable: false, truthMode: "unusable", reason: "unavailable_coverage" },
    },
    {
      name: "rejects a curated route in a market that used to permit fallback",
      request: {
        country: searchabilityPolicyFixtures.curated.country,
        serviceDay: SERVICE_DAY,
        origin: curatedRoute.origin,
        destination: curatedRoute.destination,
        source: curatedRoute,
        now: NOW,
      },
      expected: { searchable: false, truthMode: "unusable", reason: "unavailable_coverage" },
    },
    {
      name: "rejects stale realtime data",
      request: {
        country: staleRoute.results[0].country,
        serviceDay: SERVICE_DAY,
        origin: staleRoute.origin,
        destination: staleRoute.destination,
        source: staleRoute,
        now: NOW,
      },
      expected: { searchable: false, truthMode: "stale", reason: "unavailable_coverage" },
    },
    {
      name: "returns a stable unsupported-date reason",
      request: {
        country: staleRoute.results[0].country,
        serviceDay: "2026-08-02",
        origin: staleRoute.origin,
        destination: staleRoute.destination,
        source: staleRoute,
        now: NOW,
      },
      expected: { searchable: false, truthMode: "unusable", reason: "unsupported_date" },
    },
  ] satisfies Array<{
    name: string;
    request: SearchabilityPolicyRequest;
    expected: { searchable: boolean; truthMode: string; reason?: string };
  }>))("$name", ({ request, expected }) => {
    expect(decideSearchability(request)).toMatchObject(expected);
  });

  it("holds every market to the same bar, whatever kind of service it runs", () => {
    // Germany used to permit an indicative fallback and Hong Kong did not, so
    // identical rows were searchable in one and rejected in the other.
    for (const country of ["germany", "hong_kong", "japan", "united_kingdom"] as const) {
      const decision = decideSearchability({
        country,
        serviceDay: SERVICE_DAY,
        origin: "A",
        destination: "B",
        source: {
          ...unverifiedRoute,
          origin: "A",
          destination: "B",
          results: unverifiedRoute.results.map((row) => ({ ...row, country, origin: "A", destination: "B" })),
        },
        now: NOW,
      });
      expect(decision.searchable, country).toBe(false);
    }
  });

  it("resolves aliases and keeps origin-conditioned destinations on the same policy", () => {
    const selection = searchableRoutesForContext([verifiedRoute], {
      country: "korea",
      serviceDay: SERVICE_DAY,
      origin: "Seoul",
      now: NOW,
    });

    expect(selection.reachableDestinations).toEqual(["Busan (BSN)", "Daejeon"]);
    expect(selection.routes).toHaveLength(1);
    expect(selection.decisions.every((decision) => decision.searchable)).toBe(true);
  });

  it("does not answer a service day from a dateless canonical snapshot", () => {
    const canonical = {
      ...verifiedRoute,
      results: verifiedRoute.results.map(({ date: _date, ...row }) => row),
    };
    const decision = decideSearchability({
      country: "korea",
      serviceDay: SERVICE_DAY,
      origin: canonical.origin,
      destination: canonical.destination,
      source: canonical,
      now: NOW,
    });

    expect(decision).toMatchObject({
      searchable: false,
      truthMode: "unusable",
      sourceServiceDay: undefined,
    });
  });

  it("rejects a route whose source block was retargeted at a different country", () => {
    const decision = decideSearchability({
      country: "korea",
      serviceDay: SERVICE_DAY,
      origin: verifiedRoute.origin,
      destination: verifiedRoute.destination,
      source: {
        ...verifiedRoute,
        sourceMeta: buildSourceMeta({ sourceId: "de-gtfs", fetchedAt: verifiedRoute.scrapedAt }),
      },
      now: NOW,
    });

    expect(decision.searchable).toBe(false);
  });
});
