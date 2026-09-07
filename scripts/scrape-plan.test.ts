import { describe, expect, it } from "vitest";
import { coveredThroughBySource, decideScrapePass } from "./scrape-plan";
import { FULL_SCRAPE_INTERVAL_DAYS, SCRAPE_WINDOW_DAYS, SEARCH_WINDOW_DAYS } from "../src/data/countries";

/** The window a full run collects must outlast the gap until the next one. */
describe("scrape window sizing", () => {
  it("collects enough days that the picker is never short between full runs", () => {
    expect(SCRAPE_WINDOW_DAYS).toBe(SEARCH_WINDOW_DAYS + FULL_SCRAPE_INTERVAL_DAYS - 1);
  });
});

describe("nightly pass decision", () => {
  it("does not let a fresh Kotoden window hide stale JR and ODPT dates", () => {
    const newest = coveredThroughBySource([
      { sourceMeta: { sourceId: "jp-kotoden-gtfs" }, results: [{ date: "2026-09-13" }] },
      { sourceMeta: { sourceId: "jp-jr-central" }, results: [{ date: "2026-09-07" }] },
      { sourceMeta: { sourceId: "jp-odpt-toei" }, results: [{ date: "2026-09-07" }] },
    ]);
    expect(newest).toBe("2026-09-07");
    expect(decideScrapePass([{ country: "japan", newest, required: "2026-09-11" }]).pass).toBe("full");
  });

  it("combines dates within a source and keeps empty sources out of the frontier", () => {
    expect(coveredThroughBySource([
      { sourceMeta: { sourceId: "one" }, results: [{ date: "2026-09-05" }] },
      { sourceMeta: { sourceId: "one" }, results: [{ date: "2026-09-13" }] },
      { sourceMeta: { sourceId: "empty" }, results: [] },
    ])).toBe("2026-09-13");
    expect(coveredThroughBySource([])).toBeUndefined();
  });

  it("ignores a file with no registered source rather than letting it set the frontier", () => {
    // Only a registered source can answer a search, so an unregistered leftover
    // must not be the least recent frontier that pins the market to a full run.
    expect(coveredThroughBySource([
      { sourceMeta: { sourceId: "jp-odpt-toei" }, results: [{ date: "2026-09-13" }] },
      { results: [{ date: "2026-01-04" }] },
      { sourceMeta: {}, results: [{ date: "2026-01-04" }] },
    ])).toBe("2026-09-13");
  });
  it("stays live-only while every market still covers the offered window", () => {
    const decision = decideScrapePass([
      { country: "japan", newest: "2026-08-27", required: "2026-08-25" },
      { country: "germany", newest: "2026-08-25", required: "2026-08-25" },
    ]);

    expect(decision.pass).toBe("live-only");
    expect(decision.shortfalls).toEqual([]);
  });

  it("runs a full scrape as soon as one market falls short of the picker", () => {
    // A date the picker offers with no rows behind it is the failure this
    // whole cadence has to avoid, so one short market is enough.
    const decision = decideScrapePass([
      { country: "japan", newest: "2026-08-27", required: "2026-08-26" },
      { country: "germany", newest: "2026-08-25", required: "2026-08-26" },
    ]);

    expect(decision.pass).toBe("full");
    expect(decision.shortfalls).toEqual(["germany covers to 2026-08-25, picker offers to 2026-08-26"]);
  });

  it("ignores markets that have no rows at all rather than scraping nightly for them", () => {
    // Singapore and China hold nothing; a full run cannot fix an unwired or
    // credential-blocked source, and letting them vote would pin the job to a
    // daily full scrape forever.
    const decision = decideScrapePass([
      { country: "japan", newest: "2026-08-27", required: "2026-08-25" },
      { country: "singapore", newest: undefined, required: "2026-08-25" },
    ]);

    expect(decision.pass).toBe("live-only");
  });

  it("falls back to a full scrape when nothing committed can prove coverage", () => {
    const decision = decideScrapePass([
      { country: "singapore", newest: undefined, required: "2026-08-25" },
    ]);

    expect(decision.pass).toBe("full");
    expect(decision.reason).toContain("no committed rows");
  });

  it("recovers on its own after a missed run instead of waiting out the cadence", () => {
    // Two nights short is exactly what a failed full run leaves behind; the
    // next night must run full rather than hold the calendar.
    const decision = decideScrapePass([
      { country: "japan", newest: "2026-08-25", required: "2026-08-27" },
    ]);

    expect(decision.pass).toBe("full");
  });
});
