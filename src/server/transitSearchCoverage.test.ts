/**
 * Regression cover for the reported dead end: the Korean station picker offers
 * all 305 Seoul Metro stations, but the committed timetables cover a handful of
 * Korail corridors, so `Cheongnyangni → Seoul Station` 404'd with a message
 * that read like a network failure.
 *
 * Runs against the real committed snapshots — the point is that the shipped
 * data and the shipped menu agree about what search can answer.
 */
import { describe, expect, it } from "vitest";
import { runTransitSearch } from "./transitSearch";

const DATE = "2026-08-01";

async function search(origin: string, destination: string, country = "korea") {
  return runTransitSearch({ origin, destination, date: DATE, country });
}

describe("uncovered station search", () => {
  it("still refuses to invent a timetable for an uncovered station", async () => {
    const { statusCode, payload } = await search("Cheongnyangni", "Seoul Station");
    expect(statusCode).toBe(404);
    expect(payload.results).toEqual([]);
  });

  it("names the uncovered station instead of implying a fetch failure", async () => {
    const { payload } = await search("Cheongnyangni", "Seoul Station");
    expect(payload.coverageGap?.uncovered).toEqual(["Cheongnyangni"]);
    expect(payload.message).toContain("Cheongnyangni");
    expect(payload.message).not.toContain("may not be covered yet");
  });

  it("offers stations that do have timetables, so the user has a next step", async () => {
    const { payload } = await search("Cheongnyangni", "Seoul Station");
    const suggestions = payload.coverageGap?.suggestions ?? [];
    expect(suggestions).toContain("Seoul (SNC)");
    expect(suggestions).toContain("Busan (BSN)");
    // Every suggestion must actually resolve, or the prompt sends users in circles.
    for (const suggestion of suggestions) {
      expect(suggestion).not.toBe("Cheongnyangni");
    }
  });

  it("reports both endpoints when neither is covered", async () => {
    const { payload } = await search("Cheongnyangni", "Gangnam");
    expect(payload.coverageGap?.uncovered).toEqual(["Cheongnyangni", "Gangnam"]);
  });

  it("leaves live-provider countries without a coverage gap", async () => {
    // A TfL/MBTA 404 is a provider outcome, not a bounded-catalog outcome, and
    // must not be dressed up as "this station has no timetable".
    const { payload } = await search("Nowhere Road", "Elsewhere", "united_kingdom");
    expect(payload.coverageGap).toBeUndefined();
  });
});

describe("same-station aliases", () => {
  it("resolves the Seoul Metro label to the Korail timetable", async () => {
    // Was a 404 before: the menu says "Seoul Station", the data says "Seoul (SNC)".
    const { statusCode, payload } = await search("Seoul Station", "Busan (BSN)");
    expect(statusCode).toBe(200);
    expect(payload.results.length).toBeGreaterThan(0);
  });

  it("works in both directions and on either endpoint", async () => {
    const forward = await search("Seoul Station", "Gangneung");
    const reverse = await search("Busan Station", "Seoul Station");
    expect(forward.statusCode).toBe(200);
    expect(reverse.statusCode).toBe(200);
    expect(forward.payload.results.length).toBeGreaterThan(0);
    expect(reverse.payload.results.length).toBeGreaterThan(0);
  });

  it("accepts the operator-code-stripped names used on prerendered route pages", async () => {
    const { statusCode, payload } = await search("Seoul", "Busan");
    expect(statusCode).toBe(200);
    expect(payload.results.length).toBeGreaterThan(0);
  });

  it("does not alias a station onto an unrelated one", async () => {
    // Cheongnyangni is a real, distinct station — it must stay a miss, not get
    // silently answered with Seoul Station's departures.
    const { statusCode } = await search("Cheongnyangni", "Busan (BSN)");
    expect(statusCode).toBe(404);
  });
});

describe("covered corridors still work", () => {
  it("answers the canonical Korail pairs unchanged", async () => {
    for (const [origin, destination] of [
      ["Seoul (SNC)", "Busan (BSN)"],
      ["Yongsan", "Mokpo"],
      ["Daejeon", "Busan (BSN)"],
    ]) {
      const { statusCode, payload } = await search(origin, destination);
      expect(statusCode, `${origin} → ${destination}`).toBe(200);
      expect(payload.results.length, `${origin} → ${destination}`).toBeGreaterThan(0);
    }
  });
});
