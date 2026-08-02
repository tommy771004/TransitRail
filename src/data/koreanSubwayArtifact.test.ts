import { describe, expect, it } from "vitest";
import type { SeoulTimetable } from "../server/seoulSubwayTimetable";
import {
  buildKoreanSubwayArtifact,
  decodeKoreanSubwayArtifact,
  encodeKoreanSubwayArtifact,
  koreanArtifactCoverageNames,
  koreanArtifactReachableNames,
  koreanServiceDayType,
  searchKoreanSubwayArtifact,
} from "./koreanSubwayArtifact";

const timetable: SeoulTimetable = {
  encoding: "utf-8",
  dropped: {},
  runs: [
    {
      trainNo: "K101",
      line: "Line 1",
      dayType: "weekday",
      direction: "UP",
      calls: [
        { station: "Seoul Station", arrival: 331, departure: 331 },
        { station: "City Hall", arrival: 333, departure: 333 },
      ],
    },
    {
      trainNo: "L201",
      line: "Line 2",
      dayType: "weekday",
      direction: "INNER",
      calls: [
        { station: "Gangnam", arrival: 480, departure: 480 },
        { station: "City Hall", arrival: 490, departure: 490 },
      ],
    },
    {
      // Departs the interchange long BEFORE the Line 2 feeder arrives at 490.
      // Reachability must not let this early train veto the 494 one below.
      trainNo: "K100",
      line: "Line 1",
      dayType: "weekday",
      direction: "DOWN",
      calls: [
        { station: "City Hall", arrival: 400, departure: 400 },
        { station: "Seoul Station", arrival: 411, departure: 411 },
      ],
    },
    {
      trainNo: "K102",
      line: "Line 1",
      dayType: "weekday",
      direction: "DOWN",
      calls: [
        { station: "City Hall", arrival: 494, departure: 494 },
        { station: "Seoul Station", arrival: 505, departure: 505 },
      ],
    },
    {
      trainNo: "L201-SAT",
      line: "Line 2",
      dayType: "saturday",
      direction: "INNER",
      calls: [
        { station: "Gangnam", arrival: 600, departure: 600 },
        { station: "City Hall", arrival: 610, departure: 610 },
      ],
    },
  ],
};

describe("Seoul subway compact artifact", () => {
  it("fails closed for malformed service dates", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });

    expect(koreanArtifactCoverageNames(artifact, "not-a-date")).toEqual([]);
    expect(koreanArtifactReachableNames(artifact, "Seoul Station", "not-a-date")).toEqual([]);
    expect(() => koreanServiceDayType("not-a-date")).toThrow("Invalid Seoul service date");
    expect(searchKoreanSubwayArtifact(artifact, {
      origin: "Seoul Station",
      destination: "City Hall",
      date: "not-a-date",
    })).toEqual([]);
  });

  it("round-trips gzip data and searches real run calls", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });
    const decoded = decodeKoreanSubwayArtifact(encodeKoreanSubwayArtifact(artifact));

    expect(decoded.stations).toEqual(["Seoul Station", "City Hall", "Gangnam"]);
    const results = searchKoreanSubwayArtifact(decoded, {
      origin: "Seoul Station",
      destination: "City Hall",
      date: "2026-08-03",
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      departureTime: "05:31",
      arrivalTime: "05:33",
      service: "Line 1",
    });
  });

  it("carries a second official Korean feed under the same artifact", () => {
    // The artifact is the shared shape for Korean subway feeds, not a Seoul
    // one: Incheon publishes a different CSV layout but the same runs.
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "incheon-fixture",
      source: "Incheon Transit Corporation official timetable CSV",
    });

    expect(artifact.source).toBe("Incheon Transit Corporation official timetable CSV");
    expect(decodeKoreanSubwayArtifact(encodeKoreanSubwayArtifact(artifact)).source)
      .toBe("Incheon Transit Corporation official timetable CSV");
  });

  it("defaults to the Seoul feed when no source is given", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "default-fixture",
    });
    expect(artifact.source).toBe("Seoul Metro official timetable CSV");
  });

  it("rejects a source outside the confirmed feed list", () => {
    // The label is what the authenticity oracle reads to call this official, so
    // an unrecognised feed must fail validation rather than present itself as
    // verified data.
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "unknown-fixture",
    });
    expect(() =>
      decodeKoreanSubwayArtifact(
        encodeKoreanSubwayArtifact({ ...artifact, source: "Some blog's timetable" } as never),
      ),
    ).toThrow(/identity is invalid/i);
  });

  it("fails closed for truncated or incompatible artifacts", () => {
    expect(() => decodeKoreanSubwayArtifact(Buffer.from("not gzip"))).toThrow();

    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });
    expect(() =>
      decodeKoreanSubwayArtifact(
        encodeKoreanSubwayArtifact({ ...artifact, schemaVersion: 99 } as never),
      ),
    ).toThrow(/schema/i);
  });

  it("builds one-transfer journeys from official runs on different lines", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "cross-line-fixture",
    });
    const results = searchKoreanSubwayArtifact(artifact, {
      origin: "Gangnam",
      destination: "Seoul Station",
      date: "2026-08-03",
    });

    const transfer = results.find((result) => !result.direct);
    expect(transfer).toMatchObject({
      origin: "Gangnam",
      destination: "Seoul Station",
      transferStations: ["City Hall"],
      direct: false,
    });
    expect(transfer?.legs).toHaveLength(2);
    expect(transfer?.legs?.[0]).toMatchObject({
      lineName: "Line 2",
      arrivalTime: "08:10",
    });
    expect(transfer?.legs?.[1]).toMatchObject({
      lineName: "Line 1",
      departureTime: "08:14",
      arrivalTime: "08:25",
    });
    expect(koreanArtifactReachableNames(artifact, "Gangnam", "2026-08-03")).toContain("Seoul Station");
  });

  it("offers a destination whose only usable connection is a later train", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "late-connection-fixture",
    });

    // Line 1 leaves the interchange at both 400 (too early to connect) and 494
    // (usable). Reducing the line to its earliest departure would drop the pair
    // and hide Seoul Station from the picker while search still answered it.
    expect(koreanArtifactReachableNames(artifact, "Gangnam", "2026-08-03"))
      .toContain("Seoul Station");

    // The menu must never offer what search cannot answer.
    for (const destination of koreanArtifactReachableNames(artifact, "Gangnam", "2026-08-03")) {
      expect(
        searchKoreanSubwayArtifact(artifact, { origin: "Gangnam", destination, date: "2026-08-03" }),
      ).not.toHaveLength(0);
    }
  });

  it("uses the requested service-day type for cross-line reachability", () => {
    const artifact = buildKoreanSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "service-day-fixture",
    });
    expect(searchKoreanSubwayArtifact(artifact, {
      origin: "Gangnam",
      destination: "Seoul Station",
      date: "2026-08-08", // Saturday: only the first leg exists in the fixture.
    })).toEqual([]);
  });
});
