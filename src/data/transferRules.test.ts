import { describe, expect, it } from "vitest";
import type { TransitResult } from "../types";
import {
  DEFAULT_MIN_TRANSFER_MINUTES,
  SAME_OPERATOR_FARE_WARNING,
  aggregateTransferFare,
  getMinimumTransferMinutes,
  sameOperatorFareWarning,
} from "./transferRules";

function result(operator: string, price: number): TransitResult {
  return {
    id: operator,
    country: "japan",
    operator,
    service: operator,
    departureTime: "08:00",
    arrivalTime: "09:00",
    origin: "A",
    destination: "B",
    direct: true,
    stops: ["A", "B"],
    price,
  };
}

describe("transfer rules", () => {
  it("uses conservative country and station floors", () => {
    expect(getMinimumTransferMinutes("japan", "Unknown station")).toBe(5);
    expect(getMinimumTransferMinutes("korea", "Express Bus Terminal")).toBe(5);
    expect(getMinimumTransferMinutes("thailand", "Asok")).toBe(5);
    expect(getMinimumTransferMinutes("japan", "Unknown station")).toBeGreaterThanOrEqual(
      DEFAULT_MIN_TRANSFER_MINUTES,
    );
  });

  it("resolves an operator alias before looking up a station floor", () => {
    expect(getMinimumTransferMinutes("thailand", "Sukhumvit")).toBe(5);
    expect(getMinimumTransferMinutes("thailand", "Asok")).toBe(5);
  });

  it("does not add same-operator fares", () => {
    const legs = [result("MTR", 10), result("MTR", 12)];
    expect(aggregateTransferFare(legs)).toBeUndefined();
    expect(sameOperatorFareWarning(legs)).toBe(SAME_OPERATOR_FARE_WARNING);
  });

  it("adds fares across operators when every leg has a fare", () => {
    const legs = [result("JR East", 10), result("JR Central", 12)];
    expect(aggregateTransferFare(legs)).toBe(22);
    expect(sameOperatorFareWarning(legs)).toBeUndefined();
  });
});
