import { describe, expect, it } from "vitest";
import type { SearchParams, TransitResult } from "../types";
import { nearestAvailableDate, resolveSearchConditions, searchQuery, searchTimeMode, sortResults } from "./searchConditions";

const params: SearchParams = { country: "japan", origin: "Tokyo", destination: "Shin-Osaka", date: "2026-09-13" };

describe("explicit time conditions", () => {
  it("leaves today's all-day query unbounded, including legacy searches", () => {
    const actual = resolveSearchConditions({ ...params, timeMode: "all_day", time: "18:00" }, new Date("2026-09-13T08:00:00Z"));
    expect(actual).toEqual({ ...params, timeMode: "all_day", time: undefined });
    expect(new URLSearchParams(searchQuery(actual)).has("time")).toBe(false);
    expect(searchTimeMode(params)).toBe("all_day");
    expect(searchTimeMode({ time: "09:00" })).toBe("specified");
  });
  it("captures the actual local now with no one-hour offset, across midnight", () => {
    const actual = resolveSearchConditions({ ...params, timeMode: "now", time: "12:00" }, new Date("2026-09-13T15:05:00Z"));
    expect(actual).toEqual({ ...params, date: "2026-09-14", time: "00:05", timeMode: "now" });
    const query = new URLSearchParams(searchQuery(actual));
    expect(query.get("date")).toBe(actual.date);
    expect(query.get("time")).toBe(actual.time);
    expect(query.toString()).not.toContain("undefined");
  });
  it("keeps specified date and time exactly, including midnight", () => {
    const actual = resolveSearchConditions({ ...params, time: "00:00", timeMode: "specified" });
    expect(actual.date).toBe(params.date);
    expect(new URLSearchParams(searchQuery(actual)).get("time")).toBe("00:00");
  });
  it.each([undefined, "", "24:00", "09:60", "9:00"])("rejects an invalid specified time: %s", time => {
    expect(() => resolveSearchConditions({ ...params, time, timeMode: "specified" })).toThrow();
  });
});

const trip = (id: string, departureTime: string, durationMinutes?: number, price?: number): TransitResult => ({
  ...params, id, departureTime, durationMinutes, price, operator: "Test", service: id, direct: true, stops: [],
});
const trips = [trip("later-fast-cheap", "10:00", 10, 1), trip("early", "09:00", 60, 5), trip("early-fast", "09:00", 20, 8)];
const ids = (results: TransitResult[]) => results.map(trip => trip.id);

describe("departure priority", () => {
  it.each(["now", "specified"] as const)("%s sorts by departure first, fastest only breaks ties", mode => {
    expect(ids(sortResults(trips, "fastest", "all", mode))).toEqual(["early-fast", "early", "later-fast-cheap"]);
    expect(ids(sortResults(trips, "cheapest", "all", mode))).toEqual(["early", "early-fast", "later-fast-cheap"]);
    expect(ids(sortResults(trips, "earliest", "cheapest", mode))).toEqual(["early", "early-fast", "later-fast-cheap"]);
  });
  it("preserves all-day fastest and cheapest sorting", () => {
    expect(ids(sortResults(trips, "fastest", "all", "all_day"))).toEqual(["later-fast-cheap", "early-fast", "early"]);
    expect(ids(sortResults(trips, "cheapest", "all", "all_day"))).toEqual(["later-fast-cheap", "early", "early-fast"]);
    expect(trips[0].id).toBe("later-fast-cheap");
  });
  it("orders service hours numerically without wrapping extended hours", () => {
    expect(ids(sortResults([trip("next", "25:00"), trip("night", "23:00"), trip("morning", "9:00"), trip("unknown", "—")], "earliest", "all", "now")))
      .toEqual(["morning", "night", "next", "unknown"]);
  });
  it("preserves Korean filters and puts unknown fares last among simultaneous departures", () => {
    const results = [trip("unknown", "09:00"), ...trips, { ...trip("transfer", "08:00", 5, 1), direct: false }];
    expect(ids(sortResults(results, "cheapest", "direct", "specified"))).toEqual(["early", "early-fast", "unknown", "later-fast-cheap"]);
    expect(sortResults(results, "fastest", "first_class", "all_day")).toEqual([]);
  });
});

it("offers only the nearest available date, or no date when coverage is empty", () => {
  expect(nearestAvailableDate("2099-01-01", ["2026-09-13", "2026-09-14"])).toBe("2026-09-14");
  expect(nearestAvailableDate("1999-01-01", ["2026-09-13", "2026-09-14"])).toBe("2026-09-13");
  expect(nearestAvailableDate("2026-09-13", [])).toBeUndefined();
});
