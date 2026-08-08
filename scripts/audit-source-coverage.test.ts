import { describe, expect, it } from "vitest";
import {
  auditCountry,
  buildReport,
  classifyTemporalState,
  MIN_FULL_TIMETABLE_SPAN_MINUTES,
} from "./audit-source-coverage";

const NOW = new Date("2026-08-06T12:00:00.000Z");

describe("source coverage audit", () => {
  it("keeps no-source and frequency markets out of the searchable network", async () => {
    for (const country of ["china", "singapore"] as const) {
      const audit = await auditCountry(country, NOW);
      expect(audit.network).toMatchObject({
        state: "no-searchable-network",
        regions: [],
        declaredRegions: expect.any(Array),
        lines: 0,
        stations: 0,
      });
    }
  });

  it("reports bounded next-train data separately from a full-day timetable", async () => {
    const latest = await auditCountry("hong_kong", NOW);
    const hongKong = await auditCountry("hong_kong", new Date(latest.newestFetch!));
    expect(hongKong.temporal).toMatchObject({
      state: "bounded-upcoming",
    });
    expect(hongKong.network.state).toBe("searchable");
  });

  it("renders independent network and temporal verdicts", async () => {
    const latest = await auditCountry("hong_kong", NOW);
    const reportNow = new Date(latest.newestFetch!);
    const audits = await Promise.all([auditCountry("china", reportNow), auditCountry("hong_kong", reportNow)]);
    const report = buildReport(audits, NOW);
    expect(report).toContain("Network today");
    expect(report).toContain("Timetable as of fetch");
    expect(report).toContain("declared regions");
    expect(report).toContain("declared lines");
    expect(report).toContain("declared stations");
    expect(report).toContain(`bounded-upcoming (${audits[1].serviceDate})`);
    expect(report).toContain("No searchable network");
  });

  it("classifies every temporal evidence state with an injected service date", () => {
    const base = {
      country: "japan" as const,
      serviceDate: "2026-08-08",
      departureRows: 4,
      artifactRuns: 0,
      hasServiceDayArtifact: false,
      newestFetch: "2026-08-08T12:00:00.000Z",
      sourceIds: ["jp-odpt-toei"],
      completeness: ["full-timetable"],
      observedSpan: "05:00–21:00",
      observedSpanMinutes: 16 * 60,
    };

    expect(classifyTemporalState(base).state).toBe("full-timetable");
    expect(classifyTemporalState({ ...base, observedSpan: "08:00–08:30", observedSpanMinutes: MIN_FULL_TIMETABLE_SPAN_MINUTES - 1 }).state)
      .toBe("sampled-service-day");
    expect(classifyTemporalState({ ...base, country: "hong_kong", sourceIds: ["hk-mtr-next-train"] }).state)
      .toBe("bounded-upcoming");
    expect(classifyTemporalState({ ...base, country: "united_kingdom", sourceIds: ["uk-tfl-journey-planner"] }).state)
      .toBe("sampled-service-day");
    expect(classifyTemporalState({ ...base, newestFetch: "2026-08-07T12:00:00.000Z" }).state).toBe("stale");
    expect(classifyTemporalState({ ...base, country: "malaysia" }).state).toBe("catalog-only");
    expect(classifyTemporalState({ ...base, departureRows: 0, hasServiceDayArtifact: true }).state)
      .toBe("frequency-or-service-hours");
    expect(classifyTemporalState({ ...base, departureRows: 0, completeness: ["full-timetable"] }).state)
      .toBe("unavailable");
  });
});
