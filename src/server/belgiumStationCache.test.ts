import { afterEach, describe, expect, it, vi } from "vitest";
import { getBelgiumStations } from "./belgium";

const STATIONS = {
  station: [
    { id: "BE.NMBS.008813003", name: "Brussels-Central", standardname: "Brussel-Centraal" },
    { id: "BE.NMBS.008821006", name: "Antwerpen-Centraal", standardname: "Antwerpen-Centraal" },
  ],
};

function installIRail(responses: (() => Response)[]) {
  const calls = { count: 0 };
  vi.stubGlobal("fetch", vi.fn(async () => {
    const next = responses[Math.min(calls.count, responses.length - 1)];
    calls.count += 1;
    return next();
  }));
  return calls;
}

const ok = () => new Response(JSON.stringify(STATIONS), { status: 200 });
const gatewayTimeout = () => new Response("", { status: 504 });

describe("getBelgiumStations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serves the cached list rather than refetching within the TTL", async () => {
    const calls = installIRail([ok]);

    const first = await getBelgiumStations();
    const second = await getBelgiumStations();

    expect(first).toEqual(["Antwerpen-Centraal", "Brussels-Central"]);
    expect(second).toEqual(first);
    expect(calls.count).toBe(1);
  });

  it("keeps serving an expired cache when iRail answers 504", async () => {
    // iRail returned 504 for every route in the 2026-08-01 scrape. Station ids
    // barely change, so an outage must not also cost us name resolution.
    vi.useFakeTimers();
    const calls = installIRail([ok, gatewayTimeout]);

    // The cache is module state, so expire anything an earlier test left behind
    // before measuring; otherwise this passes for the wrong reason.
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    const fresh = await getBelgiumStations();
    expect(fresh).toEqual(["Antwerpen-Centraal", "Brussels-Central"]);

    // Past the 6h TTL again, so the next call refetches and hits the outage.
    vi.advanceTimersByTime(7 * 60 * 60 * 1000);
    const stale = await getBelgiumStations();

    expect(calls.count).toBe(2);
    expect(stale).toEqual(fresh);
  });
});
