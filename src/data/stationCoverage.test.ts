import { describe, expect, it } from "vitest";
import {
  coverageModeFor,
  coveredEndpointNames,
  coveredMenuStations,
  coveredStationKeys,
  hasCoverage,
  isStationCovered,
  uncoveredMenuStations,
} from "./stationCoverage";
import { resolveStationAlias, aliasesForStation } from "./stationAliases";
import type { ScrapedRouteData } from "./scraped/timetableDay";

function route(
  origin: string,
  destination: string,
  resultDestinations: string[] = [],
): ScrapedRouteData {
  return {
    origin,
    destination,
    date: "2026-08-01",
    scrapedAt: "2026-08-01T00:00:00.000Z",
    source: "test",
    results: resultDestinations.map((dest, index) => ({
      id: `2026-08-01-r${index}`,
      country: "korea",
      date: "2026-08-01",
      operator: "Test",
      service: "Test",
      departureTime: "08:00",
      arrivalTime: "09:00",
      durationMinutes: 60,
      origin,
      destination: dest,
      direct: true,
      stops: [origin, dest],
    })) as ScrapedRouteData["results"],
  };
}

describe("coverageModeFor", () => {
  it("bounds snapshot countries by their committed route files", () => {
    expect(coverageModeFor("korea")).toBe("scraped");
    expect(coverageModeFor("japan")).toBe("scraped");
    expect(coverageModeFor("singapore")).toBe("scraped");
  });

  it("leaves live journey planners unbounded", () => {
    // These answer arbitrary pairs, so no station can be declared uncovered.
    expect(coverageModeFor("united_kingdom")).toBe("provider");
    expect(coverageModeFor("united_states")).toBe("provider");
    expect(coverageModeFor("norway")).toBe("provider");
    // provider_then_scraped still reaches a live planner first.
    expect(coverageModeFor("switzerland")).toBe("provider");
  });

  it("marks a station-catalog-only country as such", () => {
    expect(coverageModeFor("malaysia")).toBe("catalog_only");
  });
});

describe("coveredStationKeys", () => {
  it("collects both file-level and result-level endpoints", () => {
    // findInRoutes matches on either, so both must count as covered.
    const keys = coveredStationKeys([route("Seoul (SNC)", "Busan (BSN)", ["Daejeon"])]);
    expect(keys.has("seoul (snc)")).toBe(true);
    expect(keys.has("busan (bsn)")).toBe(true);
    expect(keys.has("daejeon")).toBe(true);
  });

  it("keys case-insensitively", () => {
    const keys = coveredStationKeys([route("  ToKyO ", "Kyoto")]);
    expect(keys.has("tokyo")).toBe(true);
  });
});

describe("coveredMenuStations / uncoveredMenuStations", () => {
  const routes = [route("Seoul (SNC)", "Busan (BSN)")];
  const menu = ["Cheongnyangni", "Seoul (SNC)", "Seoul Station", "Busan (BSN)"];

  it("splits the menu by what search can answer for", () => {
    const covered = coveredMenuStations(menu, routes, "korea");
    expect(covered).toContain("Seoul (SNC)");
    expect(covered).toContain("Busan (BSN)");
    expect(covered).not.toContain("Cheongnyangni");
  });

  it("counts an aliased menu spelling as covered", () => {
    // The picker offers the Seoul Metro label; the timetables use the Korail one.
    expect(coveredMenuStations(menu, routes, "korea")).toContain("Seoul Station");
    expect(uncoveredMenuStations(menu, routes, "korea")).not.toContain("Seoul Station");
  });

  it("reports the station from the pictured bug as uncovered", () => {
    expect(uncoveredMenuStations(menu, routes, "korea")).toEqual(["Cheongnyangni"]);
  });

  it("preserves menu order", () => {
    expect(coveredMenuStations(menu, routes, "korea")).toEqual([
      "Seoul (SNC)",
      "Seoul Station",
      "Busan (BSN)",
    ]);
  });
});

describe("coveredEndpointNames", () => {
  it("de-duplicates by key and returns a sorted display list", () => {
    const names = coveredEndpointNames([
      route("Seoul (SNC)", "Busan (BSN)"),
      route("seoul (snc)", "Daejeon"),
    ]);
    expect(names).toEqual(["Busan (BSN)", "Daejeon", "Seoul (SNC)"]);
  });
});

describe("hasCoverage", () => {
  const keys = coveredStationKeys([route("Seoul (SNC)", "Busan (BSN)")]);

  it("follows same-station aliases", () => {
    expect(hasCoverage(keys, "Seoul Station", "korea")).toBe(true);
    expect(hasCoverage(keys, "Seoul", "korea")).toBe(true);
  });

  it("does not invent coverage without a country", () => {
    expect(hasCoverage(keys, "Seoul Station")).toBe(false);
  });

  it("stays false for a genuinely absent station", () => {
    expect(hasCoverage(keys, "Cheongnyangni", "korea")).toBe(false);
  });
});

describe("isStationCovered", () => {
  it("treats a missing covered list as unbounded, not as empty", () => {
    // Provider-mode countries must never be marked uncovered.
    expect(isStationCovered({ mode: "provider" }, "Anything")).toBe(true);
    expect(isStationCovered(undefined, "Anything")).toBe(true);
  });

  it("honours an explicitly empty covered list", () => {
    expect(isStationCovered({ mode: "scraped", covered: [] }, "Seoul")).toBe(false);
  });
});

describe("resolveStationAlias", () => {
  it("maps the Seoul Metro label onto the Korail timetable spelling", () => {
    expect(resolveStationAlias("korea", "Seoul Station")).toBe("Seoul (SNC)");
    expect(resolveStationAlias("korea", "seoul station")).toBe("Seoul (SNC)");
  });

  it("accepts the operator-code-stripped name route pages display", () => {
    // tidyStationName() renders "Seoul (SNC)" as "Seoul" on prerendered pages.
    expect(resolveStationAlias("korea", "Seoul")).toBe("Seoul (SNC)");
    expect(resolveStationAlias("korea", "Busan")).toBe("Busan (BSN)");
  });

  it("passes through unknown names and other countries untouched", () => {
    expect(resolveStationAlias("korea", "Cheongnyangni")).toBe("Cheongnyangni");
    expect(resolveStationAlias("japan", "Seoul Station")).toBe("Seoul Station");
    expect(resolveStationAlias(undefined, "Seoul Station")).toBe("Seoul Station");
  });
});

describe("aliasesForStation", () => {
  it("lists every spelling that resolves to a canonical station", () => {
    expect(aliasesForStation("korea", "Seoul (SNC)").sort()).toEqual(["seoul", "seoul station"]);
  });

  it("returns nothing for a station with no aliases", () => {
    expect(aliasesForStation("korea", "Daejeon")).toEqual([]);
    expect(aliasesForStation("japan", "Tokyo")).toEqual([]);
  });
});
