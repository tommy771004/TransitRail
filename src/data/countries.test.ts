import { describe, expect, it } from "vitest";
import {
  isSearchDateAllowed,
  providerDateTimeValue,
  providerDateValue,
  providerDateValues,
  searchDateRange,
} from "./countries";

describe("market-local date and time values", () => {
  const instant = new Date("2026-07-28T00:30:00.000Z");

  it("uses the market timezone for the current provider date", () => {
    expect(providerDateValue("united_states", instant)).toBe("2026-07-27");
    expect(providerDateValue("united_kingdom", instant)).toBe("2026-07-28");
  });

  it("generates consecutive provider dates without browser timezone drift", () => {
    expect(providerDateValues("united_states", 3, instant)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
    ]);
  });

  it("derives the implicit search time from the market timezone", () => {
    expect(providerDateTimeValue("united_kingdom", instant).time).toBe("00:30");
    expect(providerDateTimeValue("united_states", instant).time).toBe("19:30");
  });

  it("keeps the implicit date and time paired across market midnight", () => {
    expect(providerDateTimeValue("united_kingdom", new Date("2026-07-27T23:30:00.000Z"))).toEqual({
      date: "2026-07-27",
      time: "23:30",
    });
  });

  it("locks TfL and MTR to today", () => {
    const instant = new Date("2026-07-28T00:30:00.000Z");
    expect(searchDateRange("united_kingdom", instant)).toMatchObject({
      start: "2026-07-28",
      end: "2026-07-28",
      days: 1,
      liveOnly: true,
    });
    expect(searchDateRange("hong_kong", instant).days).toBe(1);
  });

  it("keeps Seoul and MBTA on a seven-day window", () => {
    const instant = new Date("2026-07-28T00:30:00.000Z");
    expect(searchDateRange("korea", instant).days).toBe(7);
    expect(searchDateRange("united_states", instant).days).toBe(7);
    expect(isSearchDateAllowed("united_states", "2026-08-02", instant)).toBe(true);
    expect(isSearchDateAllowed("united_states", "2026-08-04", instant)).toBe(false);
  });
});
