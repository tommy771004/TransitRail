import { describe, expect, it } from "vitest";
import type { TransitLine } from "../types";
import type { ScrapedRouteData } from "./scraped/timetableDay";
import { getProviderRouteLines, mergeCatalogLines } from "./providerRouteLines";

function routeForDate(date: string): ScrapedRouteData {
  return {
    origin: "Origin",
    destination: "Destination",
    date,
    scrapedAt: "2026-08-01T00:00:00.000Z",
    source: "test-source",
    results: [{
      id: `${date}-test-0`,
      country: "belgium",
      date,
      operator: "Test operator",
      service: "Test service",
      departureTime: "08:00",
      arrivalTime: "09:00",
      origin: "Origin",
      destination: "Destination",
      direct: true,
      stops: ["Middle"],
    }],
  };
}

describe("provider route catalog", () => {
  it("does not expose hand-written routes when no snapshot exists", () => {
    expect(getProviderRouteLines("belgium", [])).toEqual([]);
  });

  it("does not expose a route for a service day without rows", () => {
    expect(getProviderRouteLines("belgium", [routeForDate("2026-08-01")], "2026-08-02")).toEqual([]);
  });

  it("keeps snapshot route cards alongside live provider lines", () => {
    const liveLine: TransitLine = {
      id: "red",
      name: "Red Line",
      stations: [{ name: "Harvard" }, { name: "Andrew" }],
    };
    const snapshots = getProviderRouteLines("united_states", [routeForDate("2026-08-01")]);

    expect(mergeCatalogLines([liveLine], snapshots)).toEqual([liveLine, ...snapshots]);
  });
});
