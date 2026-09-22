import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedTransitSearch, resetSearchResponseCache } from "./searchResponseCache";
import type { TransitSearchInput, TransitSearchResult } from "./transitSearch";

const input: TransitSearchInput = { origin: "Paddington", destination: "Liverpool Street", date: "2026-09-22", country: "united_kingdom", time: "10:00" };
const trip = { id: "t", country: "united_kingdom" as const, operator: "TfL", service: "Elizabeth line", origin: "Paddington", destination: "Liverpool Street", departureTime: "10:06", direct: true, stops: [] };
const hit: TransitSearchResult = { statusCode: 200, payload: { results: [trip] } };
const miss: TransitSearchResult = { statusCode: 404, payload: { results: [], error: "No data" } };

beforeEach(() => resetSearchResponseCache());

describe("cachedTransitSearch", () => {
  it("runs one provider search for concurrent identical queries and reuses the answer", async () => {
    const search = vi.fn(async () => hit);
    const [a, b] = await Promise.all([cachedTransitSearch(input, search), cachedTransitSearch(input, search)]);
    expect(a).toBe(hit);
    expect(b).toBe(hit);
    await cachedTransitSearch({ ...input }, search);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("keeps queries apart by every parameter", async () => {
    const search = vi.fn(async () => hit);
    await cachedTransitSearch(input, search);
    await cachedTransitSearch({ ...input, time: "10:30" }, search);
    await cachedTransitSearch({ ...input, date: "2026-09-23" }, search);
    await cachedTransitSearch({ ...input, country: undefined }, search);
    expect(search).toHaveBeenCalledTimes(4);
  });

  it("never keeps a miss or a failure, so the next passenger gets a fresh answer", async () => {
    const search = vi.fn().mockResolvedValueOnce(miss).mockResolvedValueOnce({ statusCode: 502, payload: { results: [], error: "Provider" } }).mockResolvedValueOnce(hit);
    expect((await cachedTransitSearch(input, search)).statusCode).toBe(404);
    expect((await cachedTransitSearch(input, search)).statusCode).toBe(502);
    expect((await cachedTransitSearch(input, search)).statusCode).toBe(200);
    expect(search).toHaveBeenCalledTimes(3);

    const failing = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(hit);
    await expect(cachedTransitSearch({ ...input, origin: "Other" }, failing)).rejects.toThrow("boom");
    await expect(cachedTransitSearch({ ...input, origin: "Other" }, failing)).resolves.toBe(hit);
  });
});
