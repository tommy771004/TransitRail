import { describe, expect, it } from "vitest";
import { londonParts } from "./tfl";

describe("TfL London timestamps", () => {
  it("reads a zone-less TfL timestamp as London wall-clock time", () => {
    // TfL returns "2026-08-05T09:00:00" with no designator: it is already
    // London local. Round-tripping it through `new Date()` read it in the
    // process's zone, so every departure shifted by the gap to London — an hour
    // late on a UTC host during British Summer Time.
    expect(londonParts("2026-08-05T09:00:00")).toEqual({ date: "2026-08-05", time: "09:00" });
    expect(londonParts("2026-01-15T23:45:00")).toEqual({ date: "2026-01-15", time: "23:45" });
  });

  it("does not depend on the process timezone", () => {
    const original = process.env.TZ;
    const seen = new Set<string>();
    for (const zone of ["UTC", "Asia/Taipei", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      seen.add(JSON.stringify(londonParts("2026-08-05T09:00:00")));
    }
    process.env.TZ = original;
    expect(seen.size).toBe(1);
  });

  it("still converts a timestamp that carries a zone", () => {
    // 08:00 UTC is 09:00 in London during British Summer Time.
    expect(londonParts("2026-08-05T08:00:00Z")).toEqual({ date: "2026-08-05", time: "09:00" });
    // 08:00 UTC is 08:00 in London outside it.
    expect(londonParts("2026-01-15T08:00:00Z")).toEqual({ date: "2026-01-15", time: "08:00" });
  });

  it("returns null for missing or unusable values", () => {
    expect(londonParts(undefined)).toBeNull();
    expect(londonParts("not a timestamp")).toBeNull();
  });
});
