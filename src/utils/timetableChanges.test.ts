import { describe, expect, it } from "vitest";
import type { ServiceDayAdvisory, TransitResult } from "../types";
import { describeFingerprintChange, timetableFingerprint } from "./timetableChanges";

const results: TransitResult[] = [{
  id: "trip-1",
  country: "france",
  operator: "SNCF",
  service: "TGV",
  departureTime: "08:00",
  arrivalTime: "10:00",
  origin: "Paris Gare de Lyon",
  destination: "Lyon Part-Dieu",
  direct: true,
  stops: [],
}];

const advisory = (overrides: Partial<ServiceDayAdvisory> = {}): ServiceDayAdvisory => ({
  coverage: "supported",
  serviceDate: "2026-08-03",
  timezone: "Europe/Paris",
  serviceDayType: "weekday",
  firstDeparture: "06:00",
  lastDeparture: "22:00",
  risk: "safe",
  source: "SNCF Open Data GTFS",
  checkedAt: "2026-07-28T00:00:00Z",
  ...overrides,
});

describe("timetable service-boundary fingerprints", () => {
  it("includes first/last and service-day identity but ignores retrieval metadata", () => {
    const before = timetableFingerprint(results, advisory());
    const after = timetableFingerprint(results, advisory({ checkedAt: "2026-07-29T00:00:00Z" }));
    expect(after).toEqual(before);
    expect(describeFingerprintChange(before, after, false)).toBeUndefined();
  });

  it("describes first-train, last-train, and service-day changes", () => {
    const before = timetableFingerprint(results, advisory());
    expect(describeFingerprintChange(before, timetableFingerprint(results, advisory({ firstDeparture: "06:30" })), false)).toBe("First service changed from 06:00 to 06:30.");
    expect(describeFingerprintChange(before, timetableFingerprint(results, advisory({ lastDeparture: "21:30" })), false)).toBe("Last service changed from 22:00 to 21:30.");
    expect(describeFingerprintChange(before, timetableFingerprint(results, advisory({ serviceDayType: "saturday" })), false)).toBe("Service day changed from weekday to saturday.");
  });

  it("does not report unsupported or unavailable advisory states as changes", () => {
    const before = timetableFingerprint(results, advisory());
    const unavailable = timetableFingerprint(results, advisory({ coverage: "unavailable", firstDeparture: undefined, lastDeparture: undefined }));
    expect(describeFingerprintChange(before, unavailable, false)).toBeUndefined();
  });
});
