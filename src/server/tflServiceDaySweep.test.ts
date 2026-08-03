import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTflStationResolutionCache, searchTflServiceDay } from "./tfl";

/**
 * The sweep that builds a London service day used to issue every request once
 * per sampled hour and wait for each in turn: eleven station resolutions per
 * endpoint, eleven first/last pairs, eleven journeys, strictly serial. That cost
 * ~82 seconds a route, and the daily scrape ran out of its 30-minute budget with
 * three of seven dates done (run 46, cancelled 2026-08-02).
 *
 * What the sweep asks for is unchanged — these cases pin down what it stopped
 * asking for twice.
 */

const DATE = "2026-08-03";

function journeyAt(time: string) {
  const hhmm = `${time.slice(0, 2)}:${time.slice(2)}`;
  return {
    startDateTime: `${DATE}T${hhmm}:00`,
    arrivalDateTime: `${DATE}T${hhmm}:00`,
    duration: 20,
    legs: [
      {
        departureTime: `${DATE}T${hhmm}:00`,
        arrivalTime: `${DATE}T${hhmm}:00`,
        duration: 20,
        mode: { name: "Tube" },
        departurePoint: { commonName: "Green Park" },
        arrivalPoint: { commonName: "Oxford Circus" },
        routeOptions: [{ lineIdentifier: { id: "victoria", name: "Victoria" } }],
      },
    ],
  };
}

/** Records what the sweep actually put on the wire. */
function installTflStub(latencyMs = 0) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));

    if (url.pathname.startsWith("/StopPoint/Search/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop() || "");
      calls.push(`resolve:${query}`);
      return new Response(JSON.stringify({
        matches: [{ id: query === "Green Park" ? "940GZZLUGPK" : "940GZZLUOXC", name: query }],
      }), { status: 200 });
    }

    if (url.pathname.startsWith("/Journey/JourneyResults/")) {
      const adjustment = url.searchParams.get("adjustment");
      const time = url.searchParams.get("time") || "";
      calls.push(adjustment ? `bounds:${adjustment}` : `journey:${time}`);
      return new Response(JSON.stringify({ journeys: [journeyAt(adjustment ? "0530" : time)] }), { status: 200 });
    }

    throw new Error(`Unexpected TfL fixture request: ${url}`);
  }));
  return calls;
}

/** The sweep paces its samples, so drive the clock rather than waiting on it. */
async function runSweep() {
  const pending = searchTflServiceDay("Green Park", "Oxford Circus", DATE);
  await vi.runAllTimersAsync();
  return pending;
}

describe("TfL service-day sweep", () => {
  beforeEach(() => {
    resetTflStationResolutionCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves each station once for the whole sweep, not once per sample", async () => {
    const calls = installTflStub();

    await runSweep();

    expect(calls.filter((call) => call === "resolve:Green Park")).toHaveLength(1);
    expect(calls.filter((call) => call === "resolve:Oxford Circus")).toHaveLength(1);
  });

  it("fetches the service day's first and last trip once for the whole sweep", async () => {
    const calls = installTflStub();

    await runSweep();

    // One pair for the day, not one pair per sampled hour: TripFirst and
    // TripLast do not depend on the time being sampled.
    expect(calls.filter((call) => call === "bounds:TripFirst")).toHaveLength(1);
    expect(calls.filter((call) => call === "bounds:TripLast")).toHaveLength(1);
  });

  it("still samples every hour of the operating day exactly once", async () => {
    const calls = installTflStub();

    await runSweep();

    const sampled = calls.filter((call) => call.startsWith("journey:")).sort();
    expect(sampled).toEqual([
      "journey:0530", "journey:0700", "journey:0830", "journey:1000",
      "journey:1200", "journey:1400", "journey:1600", "journey:1730",
      "journey:1900", "journey:2100", "journey:2300",
    ].sort());
  });

  it("overlaps the samples instead of waiting out one round trip at a time", async () => {
    // A round trip slower than the pacing interval is the case that mattered:
    // TfL answered in seconds, so serial samples added up to ~82s a route.
    installTflStub(3_000);

    // Count only the per-sample journey queries. A single sample already fetches
    // its two stations and its two trip bounds in parallel, so counting every
    // request in flight would look concurrent even when the samples themselves
    // run strictly one after another.
    let inFlight = 0;
    let peakInFlight = 0;
    const underlying = globalThis.fetch as typeof fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const isSample = url.pathname.startsWith("/Journey/JourneyResults/")
        && !url.searchParams.get("adjustment");
      if (isSample) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
      }
      try {
        return await underlying(input);
      } finally {
        if (isSample) inFlight -= 1;
      }
    });

    await runSweep();

    expect(peakInFlight).toBeGreaterThan(1);
  });

  it("costs the sweep 15 requests rather than one set per sampled hour", async () => {
    const calls = installTflStub();

    await runSweep();

    // Two station lookups and one first/last pair for the route and date, plus
    // the eleven samples that are the point of the sweep. It was 55.
    expect(calls).toHaveLength(15);
  });

  it("paces itself against the anonymous rate limit by default", async () => {
    installTflStub();

    const startedAt = Date.now();
    await runSweep();

    // TfL allows ~50 requests/min without a subscription key, and the sweep's
    // fifteen requests are spread across that rate.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(14 * 1_200);
  });

  it("never lets requests bunch up, however they were scheduled", async () => {
    installTflStub();

    // Pacing the *samples* was not enough: they all waited on one shared station
    // lookup and then resumed in the same tick, so a route opened with about ten
    // simultaneous requests and a 429 sent every one of them into a retry that
    // bunched the same way. The gate covers each request, so no two may start
    // closer together than the interval.
    const startTimes: number[] = [];
    const underlying = globalThis.fetch as typeof fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      startTimes.push(Date.now());
      return underlying(input);
    });

    await runSweep();

    expect(startTimes.length).toBe(15);
    const gaps = startTimes.slice(1).map((at, index) => at - startTimes[index]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1_200);
  });

  it("uses the higher rate the subscription key buys, and sends the key", async () => {
    vi.stubEnv("TFL_APP_KEY", "test-app-key");
    const calls = installTflStub();
    const seenKeys = new Set<string | null>();
    const underlying = globalThis.fetch as typeof fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      seenKeys.add(new URL(String(input)).searchParams.get("app_key"));
      return underlying(input);
    });

    const startedAt = Date.now();
    await runSweep();

    // A subscribed key raises the ceiling to ~500/min, so the sweep no longer
    // spends twelve seconds waiting to be allowed to ask.
    expect(Date.now() - startedAt).toBeLessThan(12_000);
    expect(seenKeys).toEqual(new Set(["test-app-key"]));
    expect(calls).toHaveLength(15);
  });

  it("returns the sampled departures in time order, de-duplicated by id", async () => {
    installTflStub();

    const { status, body } = await runSweep();

    expect(status).toBe(200);
    const times = body.results.map((result) => result.departureTime);
    expect(times).toEqual([...times].sort());
    expect(new Set(body.results.map((result) => result.id)).size).toBe(body.results.length);
  });
});
