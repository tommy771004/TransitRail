import { describe, expect, it } from "vitest";
import type { ScrapeRunReport } from "./base";
import { scrapeSuccessRate } from "./artifactBuilder";

const report: ScrapeRunReport = {
  country: "belgium",
  scraper: "test",
  date: "2026-08-06",
  outcomes: [
    {
      origin: "A",
      destination: "B",
      date: "2026-08-06",
      status: "ok",
      rowCount: 1,
    },
    {
      origin: "C",
      destination: "D",
      date: "2026-08-06",
      status: "failed",
      rowCount: 0,
    },
  ],
};

describe("scrape metadata", () => {
  it("distinguishes an unmeasured success rate from a failed run", () => {
    expect(scrapeSuccessRate()).toBeNull();
    expect(scrapeSuccessRate({ ...report, outcomes: [] })).toBeNull();
  });

  it("calculates a rate when a run report exists", () => {
    expect(scrapeSuccessRate(report)).toBe(0.5);
  });
});
