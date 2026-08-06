import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SeoulTimetable } from "../../server/seoulSubwayTimetable";
import { serviceDayArtifactFixture } from "../../server/serviceDayArtifactFixture";
import { buildKoreanSubwayArtifact, encodeKoreanSubwayArtifact } from "../koreanSubwayArtifact";
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
  }, {
    trainNo: "L201",
    line: "Line 2",
    dayType: "weekday",
    direction: "INNER",
    calls: [
      { station: "Gangnam", arrival: 480, departure: 480 },
      { station: "City Hall", arrival: 490, departure: 490 },
    ],
  }, {
    trainNo: "K102",
    line: "Line 1",
    dayType: "weekday",
    direction: "DOWN",
    calls: [
      { station: "City Hall", arrival: 494, departure: 494 },
      { station: "Seoul Station", arrival: 505, departure: 505 },
    ],
  }],
};

const artifactFixture = serviceDayArtifactFixture(
  new URL("./korea/seoul-subway-timetable.json.gz", import.meta.url),
  { binary: true },
);
const SERVICE_DATE = "2026-08-03";

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${SERVICE_DATE}T04:00:00.000Z`));
  artifactFixture.stash();
  artifactFixture.write(
    encodeKoreanSubwayArtifact(buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "fixture",
    })),
  );
  loadScrapedData();
});

afterAll(() => {
  artifactFixture.restore();
  loadScrapedData();
  vi.useRealTimers();
});

describe("offline Seoul artifact search", () => {
  it("finds direct metro runs without making a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const results = findScrapedResults(
      "korea",
      "Seoul Station",
      "City Hall",
      SERVICE_DATE,
    );

    expect(results).toHaveLength(1);
    expect(results?.[0].operator).toBe("Seoul Metro");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("resolves the Korail Seoul menu alias against the Seoul Metro artifact", () => {
    const results = findScrapedResults(
      "korea",
      "Seoul (SNC)",
      "City Hall",
      SERVICE_DATE,
    );

    expect(results).toHaveLength(1);
    expect(results?.[0].origin).toBe("Seoul Station");
  });

  it("includes artifact stations while excluding unverified KTX snapshots", () => {
    expect(getScrapedCoverageNames("korea")).toContain("City Hall");
    expect(findScrapedResults("korea", "Seoul (SNC)", "Busan (BSN)", SERVICE_DATE)).toBeNull();
  });

  it("answers a cross-line Seoul journey and exposes its transfer station", () => {
    const results = findScrapedResults("korea", "Gangnam", "Seoul Station", SERVICE_DATE);
    const transfer = results?.find((result) => !result.direct);
    expect(transfer).toMatchObject({
      direct: false,
      transferStations: ["City Hall"],
    });
    expect(transfer?.legs).toHaveLength(2);
  });
});
