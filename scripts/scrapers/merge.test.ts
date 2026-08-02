import { describe, expect, it } from "vitest";
import type { TransitResult } from "../../src/types";
import { dedupeScrapedResults, describingRoute, isSparseLiveSlice, replaceDateSlice } from "./merge";

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

  describe("describingRoute", () => {
    const existing = { source: "https://rt.data.gov.hk/…", results: [result(1)] };

    it("keeps the existing metadata when the incoming slice has no rows", () => {
      // A live-only market writes an empty day for every date it cannot speak
      // for. Letting that slice relabel the file rewrote its source, which then
      // failed the load-time provenance check and discarded today's real rows.
      const empty = { source: "MTR live provider", results: [] };
      expect(describingRoute(existing, empty, 4)).toBe(existing);
    });

    it("uses the incoming metadata when the incoming slice has rows", () => {
      const incoming = { source: "MTR live provider", results: [result(2)] };
      expect(describingRoute(existing, incoming, 4)).toBe(incoming);
    });

    it("uses the incoming metadata when nothing survived the merge", () => {
      // An empty file should describe itself, not keep a stale label for rows
      // that are no longer there.
      const empty = { source: "MTR live provider", results: [] };
      expect(describingRoute(existing, empty, 0)).toBe(empty);
    });

    it("uses the incoming metadata when there is no existing file", () => {
      const empty = { source: "MTR live provider", results: [] };
      expect(describingRoute(undefined, empty, 0)).toBe(empty);
    });

    it("does not let one fallback day relabel a file of real provider data", () => {
      // A single rate-limited date falls back to the curated snapshot. Letting
      // it describe the file filed six days of genuine MBTA schedules as
      // `curated`, so the file lied about data it really had.
      const real = { source: "https://api-v3.mbta.com", provenance: "official", results: [result(1)] };
      const fallback = { source: "MBTA curated snapshot fallback", provenance: "curated", results: [result(2)] };
      expect(describingRoute(real, fallback, 315)).toBe(real);
    });

    it("accepts a stronger description replacing a weaker one", () => {
      // The reverse must still work, or a file could never recover once a
      // fallback had touched it.
      const fallback = { source: "MBTA curated snapshot fallback", provenance: "curated", results: [result(1)] };
      const real = { source: "https://api-v3.mbta.com", provenance: "official", results: [result(2)] };
      expect(describingRoute(fallback, real, 315)).toBe(real);
    });
  });
});
