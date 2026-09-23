import { describe, expect, it } from "vitest";
import type { TransitResult } from "../types";
import { bandLegs, tightestWait } from "./RouteBand";

// An Entur journey as the Norway snapshot stores it: walks are their own "foot" legs.
const osloBergen: TransitResult = {
  id: "no", country: "norway", operator: "Entur", service: "FLY2 + foot + Oslo-Bergen + foot + FB50",
  origin: "Oslo S", destination: "Bergen busstasjon", departureTime: "08:10", arrivalTime: "10:55",
  durationMinutes: 165, direct: false, stops: [],
  legs: [
    { lineName: "FLY2", mode: "rail", origin: "Oslo S", destination: "Oslo lufthavn stasjon", departureTime: "08:10", arrivalTime: "08:29" },
    { lineName: "foot", mode: "foot", origin: "Oslo lufthavn stasjon", destination: "Oslo lufthavn", departureTime: "08:29", arrivalTime: "08:32" },
    { lineName: "Oslo-Bergen", mode: "air", origin: "Oslo lufthavn", destination: "Bergen lufthavn", departureTime: "09:10", arrivalTime: "10:05" },
    { lineName: "foot", mode: "foot", origin: "Bergen lufthavn", destination: "Bergen lufthavn", departureTime: "10:20", arrivalTime: "10:22" },
    { lineName: "FB50", mode: "bus", origin: "Bergen lufthavn", destination: "Bergen busstasjon", departureTime: "10:30", arrivalTime: "10:55" },
  ],
};

describe("route band rides", () => {
  it("draws rides only and keeps each walk inside the change around it", () => {
    const legs = bandLegs(osloBergen);
    expect(legs.map((leg) => leg.name)).toEqual(["FLY2", "Oslo-Bergen", "FB50"]);
    // 08:29 → 09:10 and 10:05 → 10:30: a comfortable change, not a zero-minute one.
    expect(legs.map((leg) => leg.waitMinutes)).toEqual([41, 25, undefined]);
    expect(tightestWait(legs)).toBe(25);
  });

  it("treats a journey whose only ride is flanked by walks as one ride", () => {
    const legs = bandLegs({ ...osloBergen, legs: osloBergen.legs!.slice(0, 2) });
    expect(legs).toHaveLength(1);
    expect(legs[0].name).toBe("FLY2");
  });
});
