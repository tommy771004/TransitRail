import { describe, expect, it } from "vitest";
import type { SeoulTimetable } from "../server/seoulSubwayTimetable";
import {
  buildSeoulSubwayArtifact,
  decodeSeoulSubwayArtifact,
  encodeSeoulSubwayArtifact,
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
  ],
};

describe("Seoul subway compact artifact", () => {
  it("round-trips gzip data and searches real run calls", () => {
    const artifact = buildSeoulSubwayArtifact(timetable, {
      retrievedAt: "2026-08-01T00:00:00.000Z",
      sourceSha256: "abc123",
    });
    const decoded = decodeSeoulSubwayArtifact(encodeSeoulSubwayArtifact(artifact));

    expect(decoded.stations).toEqual(["Seoul Station", "City Hall"]);
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
});
