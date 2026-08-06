import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coverageModeFor,
  coveredEndpointNames,
  coveredMenuStations,
  coveredStationKeys,
  hasCoverage,
  isStationCovered,
  reachableDestinations,
  searchableRoutesForDate,
  uncoveredMenuStations,
} from "./stationCoverage";
import { resolveStationAlias, aliasesForStation } from "./stationAliases";
import type { ScrapedRouteData } from "./scraped/timetableDay";
import { buildSourceMeta } from "./sourceRegistry";

const SEOUL_SOURCE = buildSourceMeta({
  sourceId: "kr-seoul-metro-csv",
  fetchedAt: "2026-08-01T00:00:00.000Z",
});

function route(
  origin: string,
  destination: string,
  resultDestinations: string[] = [destination],
): ScrapedRouteData {
  return {
    origin,
    destination,
    date: "2026-08-01",
    scrapedAt: "2026-08-01T00:00:00.000Z",
    source: SEOUL_SOURCE.sourceName,
    sourceMeta: SEOUL_SOURCE,
    provenance: "official",
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

// The realtime-staleness rule compares a row's date against today, so a fixture
// written as "tomorrow" silently becomes "today" once the calendar catches up.
// Pin the clock so a date this suite calls another day stays another day.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-01T04:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

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

  it("does not count a station a train merely calls at", () => {
    // findInRoutes never reads `stops`, so a called-at station is not an
    // endpoint. Counting it here would put a name in the picker that search is
    // guaranteed to answer nothing for.
    const calling = route("Seoul (SNC)", "Busan (BSN)");
    calling.results[0].stops = ["Seoul (SNC)", "Daejeon", "Busan (BSN)"];

    const keys = coveredStationKeys([calling]);
    expect(keys.has("seoul (snc)")).toBe(true);
    expect(keys.has("busan (bsn)")).toBe(true);
    expect(keys.has("daejeon")).toBe(false);
  });

  it("keys case-insensitively", () => {
    const keys = coveredStationKeys([route("  ToKyO ", "Kyoto")]);
    expect(keys.has("tokyo")).toBe(true);
  });

  it("excludes indicative fixed-headway snapshots from searchable coverage", () => {
    const indicative = route("Siam", "Mo Chit", ["Mo Chit"]);
    indicative.source = "BTS/MRT curated snapshot";
    indicative.provenance = "curated";
    indicative.results = Array.from({ length: 4 }, (_, index) => ({
      ...indicative.results[0],
      id: `2026-08-01-indicative-${index}`,
      departureTime: `0${8 + index}:00`,
      arrivalTime: `0${8 + index}:12`,
      date: "2026-08-01",
    }));

    expect(coveredStationKeys([indicative], "thailand", "2026-08-01").size).toBe(0);
  });

  it("excludes realtime rows whose embedded timestamp belongs to another date", () => {
    // The id carries the provider timestamp the row was really captured at.
    // When it disagrees with the service day the row claims, the row is a live
    // capture restamped onto another date and cannot be trusted for that day.
    const stale = route("London", "Oxford");
    stale.source = "https://api.tfl.gov.uk";
    stale.results = [{
      ...stale.results[0],
      id: "2026-08-02-tfl-2026-08-01T08:00:00-0",
      date: "2026-08-02",
      realtime: true,
    }];

    expect(coveredStationKeys([stale], "united_kingdom", "2026-08-02").size).toBe(0);
  });

  it("excludes a today-only market's realtime rows dated to another day", () => {
    // Separate rule, and it applies per market: the MTR feed speaks only for
    // the current service day, so even a self-consistent row for another date
    // is not something it can vouch for. London is deliberately not covered by
    // this — its planner does answer future dates.
    const stale = route("Central", "Tsuen Wan");
    stale.source = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";
    stale.results = [{
      ...stale.results[0],
      id: "2026-08-02-hk-TWL-CEN-2026-08-02 08:00:00-0",
      date: "2026-08-02",
      realtime: true,
    }];

    expect(coveredStationKeys([stale], "hong_kong", "2026-08-02").size).toBe(0);
  });

  it("does not expose an intercity curated snapshot as coverage", () => {
    // Long-distance rail used to be exempt from the gate that metro data was
    // held to, so a 12306 curated snapshot still populated China's station
    // menu. There is no exemption now, and no country-shaped reason for one.
    const intercity = route("Beijing South", "Shanghai Hongqiao");
    intercity.source = "12306 curated snapshot";
    intercity.sourceMeta = undefined;
    intercity.results = Array.from({ length: 4 }, (_, index) => ({
      ...intercity.results[0],
      id: `2026-08-01-intercity-${index}`,
      country: "china" as const,
      departureTime: `0${8 + index}:00`,
      arrivalTime: `0${10 + index}:00`,
      date: "2026-08-01",
    }));

    expect(searchableRoutesForDate([intercity], "china", "2026-08-01")).toHaveLength(0);
    expect(coveredStationKeys([intercity], "china", "2026-08-01")).toEqual(new Set());
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

describe("reachableDestinations", () => {
  it("uses real intermediate stops and transfer chains for an origin-conditioned menu", () => {
    const first = route("A", "C", ["C"]);
    first.results[0].stops = ["A", "B", "C"];
    first.results[0].legs = [
      {
        lineName: "Line A",
        origin: "A",
        destination: "B",
        departureTime: "08:00",
        arrivalTime: "08:30",
      },
      {
        lineName: "Line A",
        origin: "B",
        destination: "C",
        departureTime: "08:30",
        arrivalTime: "09:00",
      },
    ];
    const second = route("B", "D", ["D"]);
    second.results[0].departureTime = "09:40";
    const routes = [first, second];

    expect(reachableDestinations(routes, "A", "korea", "2026-08-01")).toEqual(["B", "C", "D"]);
  });

  it("does not expose a station that the dated graph cannot reach", () => {
    const routes = [route("A", "B")];
    expect(reachableDestinations(routes, "A", "korea", "2026-08-02")).toEqual([]);
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

  it("normalizes the known Bangkok interchange spellings", () => {
    expect(resolveStationAlias("thailand", "Asok")).toBe("Sukhumvit");
    expect(resolveStationAlias("thailand", "Si Lom")).toBe("Sala Daeng");
    expect(resolveStationAlias("thailand", "Chatuchak Park")).toBe("Mo Chit");
    expect(resolveStationAlias("thailand", "Phahon Yothin")).toBe("Ha Yaek Lat Phrao");
  });

  it("normalizes the MTR interchange spellings", () => {
    expect(resolveStationAlias("hong_kong", "Hong Kong")).toBe("Central");
    expect(resolveStationAlias("hong_kong", "East Tsim Sha Tsui")).toBe("Tsim Sha Tsui");
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

  it("does not list the canonical spelling as its own alias", () => {
    expect(aliasesForStation("thailand", "Sukhumvit")).toEqual(["asok"]);
  });
});
