import { afterEach, describe, expect, it, vi } from "vitest";
import { getMbtaStations, mbtaRateLimitWaitMs } from "./mbta";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MBTA rate limit", () => {
  const now = Date.parse("2026-09-24T12:00:15Z");

  it("waits for the window MBTA says it resets, not a fixed backoff", () => {
    // Live keyless 429, 2026-09-23: no Retry-After, only x-ratelimit-reset.
    const headers = new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(now / 1000 + 45) });
    expect(mbtaRateLimitWaitMs(headers, 0, now)).toBe(46_000);
  });

  it("prefers Retry-After, caps a runaway reset, and backs off without either", () => {
    expect(mbtaRateLimitWaitMs(new Headers({ "retry-after": "5" }), 0, now)).toBe(5_000);
    expect(mbtaRateLimitWaitMs(new Headers({ "x-ratelimit-reset": String(now / 1000 + 3600) }), 0, now)).toBe(65_000);
    expect(mbtaRateLimitWaitMs(new Headers({ "x-ratelimit-reset": String(now / 1000 - 5) }), 1, now)).toBe(4_000);
    expect(mbtaRateLimitWaitMs(new Headers(), 2, now)).toBe(8_000);
  });

  it("outlasts a whole throttled window before answering", async () => {
    vi.useFakeTimers({ now });
    const reset = String(now / 1000 + 45);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "x-ratelimit-reset": reset } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "place-harsq", attributes: { name: "Harvard" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const stations = getMbtaStations();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(stations).resolves.toContain("Harvard");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
