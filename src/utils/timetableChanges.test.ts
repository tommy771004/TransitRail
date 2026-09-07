import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../i18n";
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

let t: ReturnType<typeof i18n.getFixedT>;
beforeAll(() => { t = i18n.getFixedT("en", "translation"); });

describe("timetable service-boundary fingerprints", () => {
  it("includes first/last and service-day identity but ignores retrieval metadata", () => {
    const before = timetableFingerprint(results, advisory());
    const after = timetableFingerprint(results, advisory({ checkedAt: "2026-07-29T00:00:00Z" }));
    expect(after).toEqual(before);
    expect(describeFingerprintChange(before, after, t)).toBeUndefined();
  });

  it("describes first-train, last-train, and service-day changes", () => {
    const before = timetableFingerprint(results, advisory());
    expect(describeFingerprintChange(before, timetableFingerprint(results, advisory({ firstDeparture: "06:30" })), t)).toBe("First service is now 06:30, was 06:00.");
    expect(describeFingerprintChange(before, timetableFingerprint(results, advisory({ lastDeparture: "21:30" })), t)).toBe("Last service is now 21:30, was 22:00.");
  });

  it("names the service day the way the rest of the app does, never by its enum", () => {
    // "Service day changed from weekday to saturday" leaked an internal key
    // into the one sentence a passenger reads about their own journey.
    const message = describeFingerprintChange(
      timetableFingerprint(results, advisory()),
      timetableFingerprint(results, advisory({ serviceDayType: "sunday_holiday" })),
      t,
    );
    expect(message).toBe("Now running the Sunday / holiday timetable.");
    expect(message).not.toContain("sunday_holiday");
  });

  it("counts departures in words instead of a signed delta", () => {
    const before = timetableFingerprint(results, advisory());
    const extra = timetableFingerprint([...results, { ...results[0], id: "trip-2" }], advisory());
    expect(describeFingerprintChange(before, extra, t)).toBe("One more departure than before.");
    expect(describeFingerprintChange(extra, before, t)).toBe("One fewer departure than before.");
  });

  it("reads a service date as a day, not as an ISO field", () => {
    const message = describeFingerprintChange(
      timetableFingerprint(results, advisory()),
      timetableFingerprint(results, advisory({ serviceDate: "2026-08-04" })),
      t,
    );
    expect(message).toBe("Now running to the Aug 4 timetable.");
    expect(message).not.toContain("2026-08-04");
  });

  it("does not report unsupported or unavailable advisory states as changes", () => {
    const before = timetableFingerprint(results, advisory());
    const unavailable = timetableFingerprint(results, advisory({ coverage: "unavailable", firstDeparture: undefined, lastDeparture: undefined }));
    expect(describeFingerprintChange(before, unavailable, t)).toBeUndefined();
  });
});
