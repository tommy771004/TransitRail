import { describe, expect, it } from "vitest";
import type { TransitResult } from "../../src/types";
import type { ScrapedRouteData } from "../../src/data/scraped/timetableDay";
import { buildSourceMeta } from "../../src/data/sourceRegistry";
import {
  VALIDATION_CHECKS,
  detectRowLossRegressions,
  hasBlockingFindings,
  summarizeFindings,
  validateRoute,
  type ValidationCheckId,
} from "./timetableValidation";

const SOURCE = buildSourceMeta({ sourceId: "de-gtfs", fetchedAt: "2026-08-01T00:00:00.000Z" });

function row(overrides: Partial<TransitResult> = {}): TransitResult {
  return {
    id: "2026-08-01-row",
    country: "germany",
    date: "2026-08-01",
    operator: "DB",
    service: "ICE 100",
    departureTime: "08:00",
    arrivalTime: "10:00",
    durationMinutes: 120,
    origin: "Berlin Hbf",
    destination: "Munich Hbf",
    direct: true,
    stops: ["Berlin Hbf", "Munich Hbf"],
    ...overrides,
  };
}

function route(results: TransitResult[], overrides: Partial<ScrapedRouteData> = {}): ScrapedRouteData {
  return {
    origin: "Berlin Hbf",
    destination: "Munich Hbf",
    date: "2026-08-01",
    scrapedAt: "2026-08-01T00:00:00.000Z",
    source: SOURCE.sourceName,
    sourceMeta: SOURCE,
    provenance: "official",
    results,
    ...overrides,
  };
}

function checksFrom(findings: ReturnType<typeof validateRoute>): ValidationCheckId[] {
  return [...new Set(findings.map((finding) => finding.check))];
}

/** Departure times an hour apart, which is a plausible intercity spacing. */
function hourly(count: number): TransitResult[] {
  return Array.from({ length: count }, (_, index) => row({
    id: `2026-08-01-row-${index}`,
    departureTime: `${String(8 + index).padStart(2, "0")}:00`,
    arrivalTime: `${String(10 + index).padStart(2, "0")}:00`,
  }));
}

describe("a clean route", () => {
  it("passes every check", () => {
    // Varied spacing, as a real operating day has.
    const results = [
      row({ id: "a", departureTime: "08:00", arrivalTime: "10:00" }),
      row({ id: "b", departureTime: "08:20", arrivalTime: "10:20" }),
      row({ id: "c", departureTime: "09:05", arrivalTime: "11:05" }),
      row({ id: "d", departureTime: "10:30", arrivalTime: "12:30" }),
    ];
    expect(validateRoute({ country: "germany", route: route(results) })).toEqual([]);
  });
});

describe("check 1 — empty data", () => {
  it("warns about a full-timetable source that stored nothing", () => {
    const findings = validateRoute({ country: "germany", route: route([]) });
    expect(findings).toEqual([expect.objectContaining({ check: "empty-data", severity: "warning" })]);
  });

  it("does not warn when the source only publishes service hours", () => {
    const serviceHours = buildSourceMeta({ sourceId: "th-bem-service-hours", fetchedAt: "2026-08-01T00:00:00.000Z" });
    const findings = validateRoute({
      country: "thailand",
      route: route([], { sourceMeta: serviceHours, source: serviceHours.sourceName }),
    });
    // Storing no departures is the correct output for a frequency-only source,
    // not a fault to be chased.
    expect(checksFrom(findings)).not.toContain("empty-data");
  });
});

describe("check 2 — duplicate departures", () => {
  it("blocks the same departure stored under two ids", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row({ id: "first" }), row({ id: "second" })]),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "duplicate-departures",
      severity: "blocking",
    }));
  });

  it("does not confuse the same time on two service days", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row({ id: "mon" }), row({ id: "tue", date: "2026-08-02" })]),
    });
    expect(checksFrom(findings)).not.toContain("duplicate-departures");
  });
});

describe("check 3 — reversed times", () => {
  it("blocks a stated duration that contradicts the clock times", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row({ departureTime: "10:00", arrivalTime: "08:00", durationMinutes: 120 })]),
    });
    expect(findings).toContainEqual(expect.objectContaining({ check: "reversed-times", severity: "blocking" }));
  });

  it("accepts a train that arrives after midnight", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row({ departureTime: "23:30", arrivalTime: "01:10", durationMinutes: 100 })]),
    });
    expect(checksFrom(findings)).not.toContain("reversed-times");
  });
});

describe("check 4 — over 24 hours", () => {
  it("blocks a journey longer than a day", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row({ departureTime: "08:00", arrivalTime: "33:00", durationMinutes: 1500 })]),
    });
    expect(findings).toContainEqual(expect.objectContaining({ check: "over-24-hours", severity: "blocking" }));
  });
});

describe("check 5 — unknown stations", () => {
  it("warns about an endpoint the station catalog has never heard of", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row()]),
      knownStations: new Set(["berlin hbf"]),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "unknown-stations",
      severity: "warning",
      message: expect.stringContaining("Munich Hbf"),
    }));
  });

  it("skips the check when no catalog was supplied", () => {
    expect(checksFrom(validateRoute({ country: "germany", route: route([row()]) })))
      .not.toContain("unknown-stations");
  });
});

describe("check 6 — synthetic headway", () => {
  it("blocks a whole day generated at one exact interval", () => {
    const findings = validateRoute({ country: "germany", route: route(hourly(10)) });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "synthetic-headway",
      severity: "blocking",
      message: expect.stringContaining("60 minutes apart"),
    }));
  });

  it("does not flag a short live response that happens to be evenly spaced", () => {
    // A next-train feed can genuinely return four trains four minutes apart.
    // Flagging that would delete real data, which is the more expensive error.
    const findings = validateRoute({ country: "germany", route: route(hourly(4)) });
    expect(checksFrom(findings)).not.toContain("synthetic-headway");
  });

  it("does not flag a real day whose spacing varies anywhere", () => {
    const varied = hourly(10);
    varied[5] = { ...varied[5], departureTime: "13:12" };
    expect(checksFrom(validateRoute({ country: "germany", route: route(varied) })))
      .not.toContain("synthetic-headway");
  });
});

describe("checks 7–10 — source provenance", () => {
  it("blocks a route with no source block", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row()], { sourceMeta: undefined }),
    });
    expect(findings).toContainEqual(expect.objectContaining({ check: "source-mismatch", severity: "blocking" }));
  });

  it("blocks a source block belonging to another country", () => {
    const findings = validateRoute({
      country: "france",
      route: route([row()]),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "source-mismatch",
      message: expect.stringContaining("belongs to germany"),
    }));
  });

  it("blocks a source URL edited away from the register", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row()], { sourceMeta: { ...SOURCE, sourceUrl: "https://example.invalid" } }),
    });
    // isValidSourceMeta rejects it first, which is the stronger statement.
    expect(hasBlockingFindings({ findings, routesChecked: 1, countriesChecked: 1 })).toBe(true);
  });

  it("blocks an unusable fetch time", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row()], { sourceMeta: { ...SOURCE, fetchedAt: "recently" } }),
    });
    expect(hasBlockingFindings({ findings, routesChecked: 1, countriesChecked: 1 })).toBe(true);
  });

  it("warns rather than blocks on an older artifact version", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([row()], { sourceMeta: { ...SOURCE, artifactVersion: 1 } }),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "missing-artifact-version",
      severity: "warning",
    }));
    expect(hasBlockingFindings({ findings, routesChecked: 1, countriesChecked: 1 })).toBe(false);
  });
});

describe("check 11 — source drift", () => {
  it("warns when the stored source is not one the country's scrapers still fetch", () => {
    // Singapore's shape: migrated to a full-timetable source that has never
    // succeeded, so the old frequency-only file survives untouched and reads as
    // a market that simply has no timetable to publish.
    const findings = validateRoute({
      country: "germany",
      route: route([]),
      configuredSourceIds: new Set(["fr-sncf-gtfs"]),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "source-not-configured",
      severity: "warning",
      message: expect.stringContaining("de-gtfs"),
    }));
    // A warning, never blocking: the kept file is still the best answer there is.
    expect(hasBlockingFindings({ findings, routesChecked: 1, countriesChecked: 1 })).toBe(false);
  });

  it("says so when the unrefreshable file is also empty", () => {
    const findings = validateRoute({
      country: "germany",
      route: route([]),
      configuredSourceIds: new Set(["fr-sncf-gtfs"]),
    });
    expect(findings).toContainEqual(expect.objectContaining({
      check: "source-not-configured",
      message: expect.stringContaining("holds no departures"),
    }));
  });

  it("stays quiet when the stored source is still configured", () => {
    expect(checksFrom(validateRoute({
      country: "germany",
      route: route(hourly(3)),
      configuredSourceIds: new Set(["de-gtfs"]),
    }))).not.toContain("source-not-configured");
  });

  it("drops the check rather than guessing when the scrapers cannot be enumerated", () => {
    expect(checksFrom(validateRoute({
      country: "germany",
      route: route(hourly(3)),
      configuredSourceIds: new Set(),
    }))).not.toContain("source-not-configured");
  });
});

describe("reporting", () => {
  it("groups findings in the declared check order", () => {
    const findings = [
      ...validateRoute({ country: "germany", route: route([row({ id: "x" }), row({ id: "y" })]) }),
      ...validateRoute({ country: "germany", route: route([], { sourceMeta: undefined }) }),
    ];
    const grouped = [...summarizeFindings(findings).keys()];
    expect(grouped).toEqual(VALIDATION_CHECKS.filter((check) => grouped.includes(check)));
  });
});

describe("data-loss guard", () => {
  it("blocks a run that would replace a country's data with much less of it", () => {
    expect(detectRowLossRegressions({ germany: 800 }, { germany: 100 })).toEqual([
      expect.objectContaining({ severity: "blocking", country: "germany", message: expect.stringContaining("88% lost") }),
    ]);
  });

  it("allows an ordinary timetable change", () => {
    expect(detectRowLossRegressions({ germany: 800 }, { germany: 760 })).toEqual([]);
  });

  it("never blocks on a gain, or on a country that had nothing to lose", () => {
    expect(detectRowLossRegressions({ germany: 800 }, { germany: 1200 })).toEqual([]);
    expect(detectRowLossRegressions({ china: 0 }, { china: 0 })).toEqual([]);
  });

  it("treats a country disappearing entirely as data loss", () => {
    expect(detectRowLossRegressions({ korea: 500 }, {})).toHaveLength(1);
  });
});
