/**
 * Regression cover for the reported dead end. Seoul timetable coverage now
 * comes from the compact official CSV artifact produced by the daily scraper.
 *
 * Runs against the real committed snapshots — the point is that the shipped
 * data and the shipped menu agree about what search can answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";

const DATE = "2026-08-01";

// Search only answers dates inside the current window, so a suite pinned to a
// fixed service day has to pin the clock with it. Without this the whole file
// starts returning 422 the morning after DATE — the assertions never changed,
// the calendar did.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${DATE}T04:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

async function search(origin: string, destination: string, country = "korea") {
  return runTransitSearch({ origin, destination, date: DATE, country });
}

describe("scheduled Seoul artifact search", () => {
  it("answers the formerly uncovered corridor from official train runs", async () => {
    const { statusCode, payload } = await search("Cheongnyangni", "Seoul Station");
    expect(statusCode).toBe(200);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0].operator).toBe("Seoul Metro");
    expect(payload.results[0].price).toBeUndefined();
  });

  it("does not label artifact-backed metro stations uncovered", async () => {
    const { payload } = await search("Cheongnyangni", "Gangnam");
    expect(payload.coverageGap).toBeUndefined();
  });

  it("answers a cross-line pair through one official transfer", async () => {
    const { statusCode, payload } = await search("Cheongnyangni", "Gangnam");
    expect(statusCode).toBe(200);
    expect(payload.results.some((result) => !result.direct)).toBe(true);
    expect(payload.results.find((result) => !result.direct)?.transferStations?.length).toBe(1);
  });

  it("leaves live-provider countries without a coverage gap", async () => {
    // A TfL/MBTA 404 is a provider outcome, not a bounded-catalog outcome, and
    // must not be dressed up as "this station has no timetable".
    const { payload } = await search("Nowhere Road", "Elsewhere", "united_kingdom");
    expect(payload.coverageGap).toBeUndefined();
  });
});

describe("unverified intercity snapshots stay hidden", () => {
  it("does not expose a Korail snapshot through the Seoul Metro menu", async () => {
    const { statusCode, payload } = await search("Seoul Station", "Busan (BSN)");
    expect(statusCode).toBe(404);
    expect(payload.noResultReason).toBe("no_verified_data");
    expect(payload.officialSourceUrl).toContain("seoulmetro.co.kr");
  });

  it("does not expose unverified intercity endpoints in either direction", async () => {
    const forward = await search("Seoul Station", "Gangneung");
    const reverse = await search("Busan Station", "Seoul Station");
    expect(forward.statusCode).toBe(404);
    expect(reverse.statusCode).toBe(404);
    expect(forward.payload.noResultReason).toBe("no_verified_data");
    expect(reverse.payload.noResultReason).toBe("no_verified_data");
  });

  it("does not let operator-code aliases bypass the authenticity filter", async () => {
    const { statusCode, payload } = await search("Seoul", "Busan");
    expect(statusCode).toBe(404);
    expect(payload.noResultReason).toBe("no_verified_data");
  });

  it("does not alias a station onto an unrelated one", async () => {
    // Cheongnyangni is a real, distinct station — it must stay a miss, not get
    // silently answered with Seoul Station's departures.
    const { statusCode } = await search("Cheongnyangni", "Busan (BSN)");
    expect(statusCode).toBe(404);
  });
});

describe("covered corridors stay limited to official Seoul Metro data", () => {
  it("does not fall back to the canonical Korail pairs", async () => {
    for (const [origin, destination] of [
      ["Seoul (SNC)", "Busan (BSN)"],
      ["Yongsan", "Mokpo"],
      ["Daejeon", "Busan (BSN)"],
    ]) {
      const { statusCode, payload } = await search(origin, destination);
      expect(statusCode, `${origin} → ${destination}`).toBe(404);
      expect(payload.noResultReason, `${origin} → ${destination}`).toBe("no_verified_data");
    }
  });
});
