import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SEOUL_SUBWAY_ARTIFACT_PATH } from "../../server/seoulSubwayCsv";
import type { SeoulTimetable } from "../../server/seoulSubwayTimetable";
import { buildSeoulSubwayArtifact, encodeSeoulSubwayArtifact } from "../seoulSubwayArtifact";
import {
  findScrapedResults,
  getScrapedCoverageNames,
  loadScrapedData,
} from "./index";

const timetable: SeoulTimetable = {
  encoding: "utf-8",
  dropped: {},
  runs: [{
    trainNo: "K101",
    line: "Line 1",
    dayType: "weekday",
    direction: "UP",
    calls: [
      { station: "Seoul Station", arrival: 331, departure: 331 },
      { station: "City Hall", arrival: 333, departure: 333 },
    ],
  }],
};

let previous: Buffer | undefined;

beforeAll(() => {
  previous = existsSync(SEOUL_SUBWAY_ARTIFACT_PATH)
    ? readFileSync(SEOUL_SUBWAY_ARTIFACT_PATH)
    : undefined;
  writeFileSync(
    SEOUL_SUBWAY_ARTIFACT_PATH,
    encodeSeoulSubwayArtifact(buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "fixture",
    })),
  );
  loadScrapedData();
});

afterAll(() => {
  if (previous) writeFileSync(SEOUL_SUBWAY_ARTIFACT_PATH, previous);
  else if (existsSync(SEOUL_SUBWAY_ARTIFACT_PATH)) unlinkSync(SEOUL_SUBWAY_ARTIFACT_PATH);
  loadScrapedData();
});

describe("offline Seoul artifact search", () => {
  it("finds direct metro runs without making a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const results = findScrapedResults(
      "korea",
      "Seoul Station",
      "City Hall",
      "2026-08-03",
    );

    expect(results).toHaveLength(1);
    expect(results?.[0].operator).toBe("Seoul Metro");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("includes artifact stations in scraped coverage while preserving KTX routes", () => {
    expect(getScrapedCoverageNames("korea")).toContain("City Hall");
    expect(findScrapedResults("korea", "Seoul (SNC)", "Busan (BSN)", "2026-08-03")).not.toBeNull();
  });
});
