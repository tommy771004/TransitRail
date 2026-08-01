import { describe, expect, it } from "vitest";
import type { TransitResult } from "../../src/types";
import { dedupeScrapedResults, isSparseLiveSlice, replaceDateSlice } from "./merge";

function result(index: number, partial: Partial<TransitResult> = {}): TransitResult {
  return {
    id: `row-${index}`,
    country: "hong_kong",
    date: "2026-08-01",
    operator: "MTR",
    service: "Tsuen Wan Line",
    departureTime: `08:${String(index).padStart(2, "0")}`,
    arrivalTime: `08:${String(index + 20).padStart(2, "0")}`,
    origin: "Central",
    destination: "Tsuen Wan",
    direct: true,
    stops: ["Central", "Tsuen Wan"],
    ...partial,
  };
}

describe("scraper date-slice merge", () => {
  it("deduplicates rows with different provider ids but the same journey", () => {
    const rows = dedupeScrapedResults([
      result(1, { id: "page-1" }),
      result(1, { id: "page-2" }),
      result(2),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["page-1", "row-2"]);
  });

  it("preserves a fuller date slice when a live response is sparse", () => {
    const existing = Array.from({ length: 20 }, (_, index) => result(index));
    const incoming = [result(99, { realtime: true })];
    expect(isSparseLiveSlice(existing, incoming)).toBe(true);
    expect(replaceDateSlice(existing, incoming)).toMatchObject({
      preservedExisting: true,
      results: existing,
    });
  });

  it("accepts a non-sparse live slice as the replacement", () => {
    const existing = Array.from({ length: 4 }, (_, index) => result(index));
    const incoming = Array.from({ length: 4 }, (_, index) => result(index + 10, { realtime: true }));
    expect(replaceDateSlice(existing, incoming)).toMatchObject({
      preservedExisting: false,
      results: incoming,
    });
  });
});
