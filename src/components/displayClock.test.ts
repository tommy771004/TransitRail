import { describe, expect, it } from "vitest";
import { displayClock } from "./ResultShell";

describe("displayClock", () => {
  it("writes a service-day time past 24:00 as the next calendar day", () => {
    expect(displayClock("24:06")).toEqual({ text: "00:06", dayOffset: 1 });
  });

  it("marks an arrival that crosses midnight when the journey length agrees", () => {
    expect(displayClock("00:26", "22:19", 127)).toEqual({ text: "00:26", dayOffset: 1 });
    expect(displayClock("11:30", "09:00", 150)).toEqual({ text: "11:30", dayOffset: 0 });
    // A duration that cannot reach midnight is not read as an overnight trip.
    expect(displayClock("08:00", "09:00", 30)).toEqual({ text: "08:00", dayOffset: 0 });
  });

  it("leaves unknown shapes alone", () => {
    expect(displayClock(undefined)).toBeNull();
    expect(displayClock("soon")).toEqual({ text: "soon", dayOffset: 0 });
  });
});
