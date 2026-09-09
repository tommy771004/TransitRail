// Regression: ADR 0001 step 2 — Swiss stations were matched by name, through a
// chain that ends in a substring test, and `Genève` is a substring of
// `Genève-Aéroport`. A configured station register number (Switzerland's DIDOK)
// now answers outright and none of the name fallbacks run.
// Added by /qa on 2026-09-09
// ADR: docs/adr/0001-station-identity-keys.md

import { describe, expect, it } from "vitest";
import type { GtfsStop } from "./feed";
import { stationStopIds } from "./journeys";
import { SWISS_REGISTER_IDS } from "../swissGtfs";
import { switzerlandRoutes } from "../../../scripts/scrapers/routes";

/** Two stations whose names are substrings of one another, as Switzerland has. */
const STOPS: GtfsStop[] = [
  { id: "gva-1", name: "Genève", registerId: "8501008" },
  { id: "gva-2", name: "Genève", registerId: "8501008" },
  { id: "gva-air-1", name: "Genève-Aéroport", registerId: "8501026" },
  // Carries the airport's register number under a spelling neither query uses:
  // only the number can place it.
  { id: "gva-air-2", name: "Geneva Airport", registerId: "8501026" },
  { id: "lausanne-1", name: "Lausanne", registerId: "8501120" },
];

// Keyed by the station name as a market spells it; the matcher normalizes.
const REGISTER = {
  registerIds: {
    "Genève": ["8501008"],
    "Genève-Aéroport": ["8501026"],
    "Lausanne": ["8501120"],
  },
};

const ids = (query: string, options = REGISTER) => [...stationStopIds(STOPS, query, options)].sort();

describe("station register numbers", () => {
  it("keeps two stations apart when one name contains the other", () => {
    expect(ids("Genève")).toEqual(["gva-1", "gva-2"]);
    expect(ids("Genève-Aéroport")).toEqual(["gva-air-1", "gva-air-2"]);
  });

  it("does not fall through to name matching when a key matches", () => {
    // A mis-typed key is invisible: the entry never matches and the name
    // fallbacks answer as before. "Geneva Airport" carries the airport's number
    // but shares no word with the query, so only the register path can reach it
    // — its presence proves the register path ran.
    expect(ids("Genève-Aéroport")).toContain("gva-air-2");
    expect([...stationStopIds(STOPS, "Genève-Aéroport", {})]).not.toContain("gva-air-2");
  });

  it("treats a register number the feed no longer carries as no match", () => {
    // Reads as an uncovered station rather than quietly becoming a different
    // one — the whole point of keying on the register instead of the spelling.
    expect([...stationStopIds(STOPS, "Genève", { registerIds: { "Genève": ["9999999"] } })]).toEqual([]);
  });

  it("leaves a market with no register numbers on the name matcher", () => {
    expect([...stationStopIds(STOPS, "Lausanne", {})]).toEqual(["lausanne-1"]);
  });

  it("covers exactly the stations the Swiss routes name", () => {
    // The silent failure this guards: an entry the matcher cannot look up never
    // matches, the name fallbacks answer, and the market looks healthy while
    // running on exactly the matching this replaces. Checking the map against
    // itself cannot catch that — a wrong key still matches itself — so compare
    // it with the names the scrape actually queries.
    const queried = new Set(switzerlandRoutes.flatMap((route) => [route.origin, route.destination]));
    expect(new Set(Object.keys(SWISS_REGISTER_IDS))).toEqual(queried);
  });

  it("resolves every Swiss route endpoint through its register number", () => {
    for (const name of new Set(switzerlandRoutes.flatMap((r) => [r.origin, r.destination]))) {
      const numbers = SWISS_REGISTER_IDS[name];
      const probe = [
        // Named for nothing the query resembles: only the number can reach it.
        { id: "wanted", name: "a spelling the query never uses", registerId: numbers?.[0] },
        { id: "decoy", name, registerId: "0000000" },
      ] as GtfsStop[];
      expect(
        [...stationStopIds(probe, name, { registerIds: SWISS_REGISTER_IDS })],
        `${JSON.stringify(name)} did not resolve through its register number`,
      ).toEqual(["wanted"]);
    }
  });
});
