import { describe, expect, it } from "vitest";
import { thailandTransitLines } from "./metroLines";

describe("metro topology station aliases", () => {
  it("derives Bangkok interchanges through the known operator spellings", () => {
    const expected = [
      ["Asok", "MRT Blue Line"],
      ["Sukhumvit", "BTS Sukhumvit Line"],
      ["Sala Daeng", "MRT Blue Line"],
      ["Si Lom", "BTS Silom Line"],
      ["Mo Chit", "MRT Blue Line"],
      ["Chatuchak Park", "BTS Sukhumvit Line"],
      ["Ha Yaek Lat Phrao", "MRT Blue Line"],
      ["Phahon Yothin", "BTS Sukhumvit Line"],
    ] as const;

    for (const [station, lineName] of expected) {
      const entry = thailandTransitLines
        .flatMap((line) => line.stations)
        .find((candidate) => candidate.name === station);
      expect(entry?.interchanges).toContain(lineName);
    }
  });
});
