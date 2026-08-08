import { describe, expect, it } from "vitest";
import { auditCountry, buildReport } from "./audit-source-coverage";

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
    expect(report).toContain(`bounded-upcoming (${audits[1].serviceDate})`);
    expect(report).toContain("No searchable network");
  });
});
