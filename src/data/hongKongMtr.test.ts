import { describe, expect, it } from "vitest";
import { findMtrJourney, hongKongMtrLineCatalog, mtrInterchanges } from "./hongKongMtr";

describe("Hong Kong MTR topology", () => {
  it("deduplicates line variants and keeps the canonical interchange count", () => {
    expect(new Set(hongKongMtrLineCatalog.map((line) => line.code)).size)
      .toBe(hongKongMtrLineCatalog.length);
    expect([...mtrInterchanges.values()].filter((codes) => codes.length > 1)).toHaveLength(21);
    expect(mtrInterchanges.get("central")).toEqual(expect.arrayContaining(["AEL", "TCL", "TWL", "ISL"]));
    expect(mtrInterchanges.get("tsim sha tsui")).toEqual(expect.arrayContaining(["TML", "TWL"]));
    expect(findMtrJourney("Central", "Airport")?.line.code).toBe("AEL");
  });
});
