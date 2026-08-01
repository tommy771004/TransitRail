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

const SERVICE_DAY = SEARCHABILITY_FIXTURE_DATE;
const NOW = SEARCHABILITY_FIXTURE_NOW;
const verifiedRoute = searchabilityPolicyFixtures.verified.route;
const indicativeRoute = searchabilityPolicyFixtures.indicative.route;
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
      name: "accepts an indicative route only where fallback is permitted",
      request: {
        country: searchabilityPolicyFixtures.indicative.country,
        serviceDay: SERVICE_DAY,
        origin: indicativeRoute.origin,
        destination: indicativeRoute.destination,
        source: indicativeRoute,
        now: NOW,
      },
      expected: { searchable: true, truthMode: "indicative", reason: undefined },
    },
    {
      name: "rejects an indicative route where fallback is forbidden",
      request: {
        country: "hong_kong" as const,
        serviceDay: SERVICE_DAY,
        origin: "Central",
        destination: "Airport",
        source: {
          ...indicativeRoute,
          origin: "Central",
          destination: "Airport",
          results: indicativeRoute.results.map((row) => ({
            ...row,
            country: "hong_kong" as const,
            origin: "Central",
            destination: "Airport",
          })),
        },
        now: NOW,
      },
      expected: { searchable: false, truthMode: "indicative", reason: "unavailable_coverage" },
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

  it("resolves aliases and keeps origin-conditioned destinations on the same policy", () => {
    const routes = [verifiedRoute];
    const selection = searchableRoutesForContext(routes, {
      country: "korea",
      serviceDay: SERVICE_DAY,
      origin: "Seoul",
      now: NOW,
    });

    expect(selection.reachableDestinations).toEqual(["Busan (BSN)", "Daejeon"]);
    expect(selection.routes).toHaveLength(1);
    expect(selection.decisions.every((decision) => decision.searchable)).toBe(true);
  });

  it("uses a dateless canonical snapshot as an indicative service-day fallback", () => {
    const selection = searchableRoutesForContext([indicativeRoute], {
      country: "germany",
      serviceDay: SERVICE_DAY,
      origin: indicativeRoute.origin,
      now: NOW,
    });

    expect(selection.routes).toHaveLength(1);
    expect(selection.routes[0].truthMode).toBe("indicative");
    expect(selection.routes[0].results.every((row) => !row.date)).toBe(true);
  });

  it("does not promote an official canonical snapshot to a dated answer", () => {
    const officialCanonical = {
      ...indicativeRoute,
      source: "official timetable",
      provenance: "official" as const,
    };
    const decision = decideSearchability({
      country: "germany",
      serviceDay: SERVICE_DAY,
      origin: officialCanonical.origin,
      destination: officialCanonical.destination,
      source: officialCanonical,
      now: NOW,
    });

    expect(decision).toMatchObject({
      searchable: true,
      truthMode: "indicative",
      canonicalSnapshot: true,
      sourceServiceDay: undefined,
    });
  });
});
