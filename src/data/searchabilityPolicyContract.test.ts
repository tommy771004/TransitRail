import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import {
  SEARCHABILITY_FIXTURE_DATE,
  SEARCHABILITY_FIXTURE_NOW,
  malformedSearchabilitySource,
  searchabilityPolicyFixtures,
} from "./searchabilityPolicyFixtures";
import {
  decideRouteContextSearchability,
  decideSearchability,
  searchableRoutesForContext,
  summarizeSearchability,
  toNoResultReason,
} from "./searchabilityPolicy";
import {
  coveredEndpointNames,
  reachableDestinations,
  searchableRoutesForDate,
} from "./stationCoverage";
import { collectRoutePages } from "../../scripts/lib/routePages";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Searchability policy shared output contract", () => {
  it.each([
    {
      name: "verified facts stay searchable in journey and catalog output",
      fixture: searchabilityPolicyFixtures.verified,
      origin: "Seoul",
      destination: "Busan",
      expectedTruthMode: "verified",
      expectedRoutes: 1,
      expectedCovered: true,
      expectedNoResult: undefined,
    },
    {
      name: "canonical facts stay explicitly indicative where fallback is permitted",
      fixture: searchabilityPolicyFixtures.indicative,
      origin: "Berlin Hbf",
      destination: "Munich Hbf",
      expectedTruthMode: "indicative",
      expectedRoutes: 1,
      expectedCovered: true,
      expectedNoResult: undefined,
    },
    {
      name: "stale facts fail closed in journey and catalog output",
      fixture: searchabilityPolicyFixtures.stale,
      origin: "Central",
      destination: "Airport",
      expectedTruthMode: "stale",
      expectedRoutes: 0,
      expectedCovered: false,
      expectedNoResult: "no_verified_data",
    },
    {
      name: "a covered route with no service day rows reports no service",
      fixture: searchabilityPolicyFixtures.noService,
      origin: "Seoul",
      destination: "Busan",
      expectedTruthMode: "unusable",
      expectedRoutes: 0,
      expectedCovered: false,
      expectedNoResult: "no_service",
    },
  ])(
    "$name",
    ({ fixture, origin, destination, expectedTruthMode, expectedRoutes, expectedCovered, expectedNoResult }) => {
      const journey = decideSearchability({
        country: fixture.country,
        serviceDay: SEARCHABILITY_FIXTURE_DATE,
        origin,
        destination,
        source: fixture.route,
        now: SEARCHABILITY_FIXTURE_NOW,
      });
      const catalog = searchableRoutesForContext([fixture.route], {
        country: fixture.country,
        serviceDay: SEARCHABILITY_FIXTURE_DATE,
        origin,
        now: SEARCHABILITY_FIXTURE_NOW,
      });
      const summary = summarizeSearchability(catalog.decisions);
      const covered = coveredEndpointNames([fixture.route], fixture.country, SEARCHABILITY_FIXTURE_DATE);
      const publishedRoutes = searchableRoutesForDate([fixture.route], fixture.country, SEARCHABILITY_FIXTURE_DATE);

      expect(journey.truthMode).toBe(expectedTruthMode);
      expect(journey.searchable).toBe(expectedRoutes > 0);
      expect(catalog.routes).toHaveLength(expectedRoutes);
      expect(summary.truthMode).toBe(expectedRoutes > 0 ? expectedTruthMode : "unusable");
      expect(covered.includes(destination) || covered.includes(fixture.route.destination)).toBe(expectedCovered);
      expect(publishedRoutes).toHaveLength(expectedRoutes);

      if (expectedNoResult) {
        const noResult = decideRouteContextSearchability([fixture.route], {
          country: fixture.country,
          serviceDay: SEARCHABILITY_FIXTURE_DATE,
          origin,
          destination,
          now: SEARCHABILITY_FIXTURE_NOW,
        });
        expect(toNoResultReason(noResult.reason!)).toBe(expectedNoResult);
      }
    },
  );

  it("shares aliases and reachable destinations between catalog and journey graph", () => {
    const fixture = searchabilityPolicyFixtures.verified;
    const catalogDestinations = reachableDestinations(
      [fixture.route],
      "Seoul",
      fixture.country,
      SEARCHABILITY_FIXTURE_DATE,
    );
    const journeyDestinations = searchableRoutesForContext([fixture.route], {
      country: fixture.country,
      serviceDay: SEARCHABILITY_FIXTURE_DATE,
      origin: "Seoul",
      now: SEARCHABILITY_FIXTURE_NOW,
    }).reachableDestinations;

    expect(catalogDestinations).toEqual(journeyDestinations);
    expect(catalogDestinations).toContain("Busan (BSN)");
    expect(catalogDestinations).toContain("Daejeon");
  });

  it("fails malformed source facts closed before they reach catalog or publication", () => {
    const decision = decideSearchability({
      country: "hong_kong",
      serviceDay: SEARCHABILITY_FIXTURE_DATE,
      origin: "Central",
      destination: "Airport",
      source: malformedSearchabilitySource,
      now: SEARCHABILITY_FIXTURE_NOW,
    });
    expect(decision).toMatchObject({ searchable: false, truthMode: "unusable", reason: "unavailable_coverage" });
  });

  it("preserves verified and indicative truth mode in route publication", () => {
    const directory = mkdtempSync(join(tmpdir(), "transitrail-searchability-"));
    temporaryDirectories.push(directory);
    for (const [country, route] of [
      ["korea", searchabilityPolicyFixtures.verified.route],
      ["germany", searchabilityPolicyFixtures.indicative.route],
      ["hong_kong", searchabilityPolicyFixtures.stale.route],
    ] as const) {
      const countryDirectory = join(directory, country);
      mkdirSync(countryDirectory, { recursive: true });
      writeFileSync(join(countryDirectory, `${country}.json`), JSON.stringify(route));
    }

    const pages = collectRoutePages(directory);
    const verifiedPage = pages.find((page) => page.country === "korea");
    const indicativePage = pages.find((page) => page.country === "germany");

    expect(verifiedPage).toMatchObject({ truthMode: "verified", indicative: false, provenance: "official", canonicalDate: SEARCHABILITY_FIXTURE_DATE });
    expect(indicativePage).toMatchObject({ truthMode: "indicative", indicative: true, provenance: "curated", canonicalDate: "" });
    expect(indicativePage?.dayResults.every((result) => !result.date)).toBe(true);
    expect(pages.some((page) => page.country === "hong_kong")).toBe(false);
  });
});
