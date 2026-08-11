import { describe, expect, it } from "vitest";
import {
  isSearchDateAllowed,
  countryOptions,
  providerDateTimeValue,
  providerDateValue,
  providerDateValues,
  searchDateRange,
} from "./countries";

describe("market-local date and time values", () => {
  it("hides markets with no searchable published timetable from the picker", () => {
    expect(countryOptions).not.toContain("singapore");
    expect(countryOptions).not.toContain("thailand");
  });

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

  it("locks MTR to today, because its feed answers no other date", () => {
    // The MTR feed reports the next few trains and nothing about any other
    // service day, so there is no honest future date to offer.
    const instant = new Date("2026-07-28T00:30:00.000Z");
    expect(searchDateRange("hong_kong", instant)).toMatchObject({
      start: "2026-07-28",
      end: "2026-07-28",
      days: 1,
      liveOnly: true,
    });
  });

  it("gives TfL a seven-day window, because its planner answers future dates", () => {
    // London is live at request time but not today-only: the journey planner
    // answers a future date from the published schedule.
    const instant = new Date("2026-07-28T00:30:00.000Z");
    expect(searchDateRange("united_kingdom", instant)).toMatchObject({
      start: "2026-07-28",
      days: 7,
      liveOnly: false,
    });
  });

  it("keeps Seoul and MBTA on a seven-day window", () => {
    const instant = new Date("2026-07-28T00:30:00.000Z");
    expect(searchDateRange("korea", instant).days).toBe(7);
    expect(searchDateRange("united_states", instant).days).toBe(7);
    expect(isSearchDateAllowed("united_states", "2026-08-02", instant)).toBe(true);
    expect(isSearchDateAllowed("united_states", "2026-08-04", instant)).toBe(false);
  });
});
