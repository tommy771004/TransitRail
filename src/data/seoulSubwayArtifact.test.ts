import { describe, expect, it } from "vitest";
import type { SeoulTimetable } from "../server/seoulSubwayTimetable";
import {
  buildSeoulSubwayArtifact,
  decodeSeoulSubwayArtifact,
  encodeSeoulSubwayArtifact,
  seoulArtifactCoverageNames,
  seoulArtifactReachableNames,
  seoulServiceDayType,
  searchSeoulSubwayArtifact,
} from "./seoulSubwayArtifact";

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
    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });

    expect(seoulArtifactCoverageNames(artifact, "not-a-date")).toEqual([]);
    expect(seoulArtifactReachableNames(artifact, "Seoul Station", "not-a-date")).toEqual([]);
    expect(() => seoulServiceDayType("not-a-date")).toThrow("Invalid Seoul service date");
    expect(searchSeoulSubwayArtifact(artifact, {
      origin: "Seoul Station",
      destination: "City Hall",
      date: "not-a-date",
    })).toEqual([]);
  });

  it("round-trips gzip data and searches real run calls", () => {
    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });
    const decoded = decodeSeoulSubwayArtifact(encodeSeoulSubwayArtifact(artifact));

    expect(decoded.stations).toEqual(["Seoul Station", "City Hall", "Gangnam"]);
    const results = searchSeoulSubwayArtifact(decoded, {
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

  it("fails closed for truncated or incompatible artifacts", () => {
    expect(() => decodeSeoulSubwayArtifact(Buffer.from("not gzip"))).toThrow();

    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });
    expect(() =>
      decodeSeoulSubwayArtifact(
        encodeSeoulSubwayArtifact({ ...artifact, schemaVersion: 99 } as never),
      ),
    ).toThrow(/schema/i);
  });

  it("builds one-transfer journeys from official runs on different lines", () => {
    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "cross-line-fixture",
    });
    const results = searchSeoulSubwayArtifact(artifact, {
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
    expect(seoulArtifactReachableNames(artifact, "Gangnam", "2026-08-03")).toContain("Seoul Station");
  });

  it("uses the requested service-day type for cross-line reachability", () => {
    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "service-day-fixture",
    });
    expect(searchSeoulSubwayArtifact(artifact, {
      origin: "Gangnam",
      destination: "Seoul Station",
      date: "2026-08-08", // Saturday: only the first leg exists in the fixture.
    })).toEqual([]);
  });
});
