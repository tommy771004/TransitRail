import { describe, expect, it } from "vitest";
import {
  belgiumRoutes,
  franceRoutes,
  germanyRoutes,
  hongKongRoutes,
  japanJrCentralRoutes,
  malaysiaKtmbRoutes,
  norwayRoutes,
  singaporeRoutes,
  switzerlandRoutes,
  unitedKingdomRoutes,
  unitedStatesRoutes,
  withReturnDirections,
} from "./routes";

describe("withReturnDirections", () => {
  it("adds the way back for a pair listed one way only", () => {
    expect(withReturnDirections([{ origin: "A", destination: "B" }])).toEqual([
      { origin: "A", destination: "B" },
      { origin: "B", destination: "A" },
    ]);
  });

  it("does not list a return the operator pair already has", () => {
    const both = [
      { origin: "A", destination: "B" },
      { origin: "B", destination: "A" },
    ];
    expect(withReturnDirections(both)).toEqual(both);
  });
});

describe("scrape lists", () => {
  // Search no longer answers a direction by reversing the other one's rows, so
  // a pair scraped one way only is a pair half the passengers cannot search.
  // Thailand is absent: BEM publishes service windows, not departures.
  it.each([
    ["belgium", belgiumRoutes],
    ["france", franceRoutes],
    ["germany", germanyRoutes],
    ["hong_kong", hongKongRoutes],
    ["japan (JR Central)", japanJrCentralRoutes],
    ["malaysia", malaysiaKtmbRoutes],
    ["norway", norwayRoutes],
    ["singapore", singaporeRoutes],
    ["switzerland", switzerlandRoutes],
    ["united_kingdom", unitedKingdomRoutes],
    ["united_states", unitedStatesRoutes],
  ])("%s scrapes every pair in both directions", (_market, routes) => {
    const listed = new Set(routes.map((route) => `${route.origin} → ${route.destination}`));
    const oneWay = routes.filter((route) => !listed.has(`${route.destination} → ${route.origin}`));
    expect(oneWay).toEqual([]);
    expect(listed.size).toBe(routes.length);
  });
});
