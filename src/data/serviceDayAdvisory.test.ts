import { describe, expect, it } from "vitest";
import { validateServiceDayAdvisory } from "./serviceDayAdvisory";

const valid = {
  coverage: "supported",
  serviceDate: "2026-07-28",
  timezone: "Europe/Paris",
  serviceDayType: "weekday",
  firstDeparture: "05:30",
  lastDeparture: "24:30",
  risk: "safe",
  source: "Official fixture",
};

describe("validateServiceDayAdvisory", () => {
  it("accepts normalized service-day values including after-midnight times", () => {
    expect(validateServiceDayAdvisory(valid)).toMatchObject(valid);
  });

  it("rejects supported coverage without both service boundaries", () => {
    expect(() => validateServiceDayAdvisory({ ...valid, lastDeparture: undefined })).toThrow(/first and last/);
  });

  it("rejects malformed artifacts and unsafe attribution URLs", () => {
    expect(() => validateServiceDayAdvisory({ ...valid, serviceDate: "2026-02-30" })).toThrow(/service date/);
    expect(() => validateServiceDayAdvisory({ ...valid, firstDeparture: "99:00" })).toThrow(/first departure/);
    expect(() => validateServiceDayAdvisory({ ...valid, sourceUrl: "javascript:alert(1)" })).toThrow(/unsafe/);
  });
});
