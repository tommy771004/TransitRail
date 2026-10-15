import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTflStationResolutionCache } from "./tfl";
import { crowdingLevel, londonStationCrowding, nextUsuallyQuiet } from "./tflCrowding";

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function stubTfl(stops: Record<string, Array<{ id: string; name: string }>>, crowding: Record<string, unknown>) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const search = url.pathname.match(/^\/StopPoint\/Search\/(.+)$/);
    if (search) return json({ matches: stops[decodeURIComponent(search[1])] || [] });
    const reading = crowding[url.pathname];
    if (reading) return json(reading);
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

beforeEach(() => resetTflStationResolutionCache());
afterEach(() => { vi.unstubAllGlobals(); });

// Thursday 08:20 in London (BST).
const now = new Date("2026-10-15T07:20:00Z");

describe("TfL crowding levels", () => {
  it("uses TfL's own bands", () => {
    expect([0, 0.39, 0.4, 0.7, 0.71, 1.2].map(crowdingLevel)).toEqual(["quiet", "quiet", "busy", "busy", "very_busy", "very_busy"]);
  });

  it("finds the next usually-quiet quarter hour within three hours", () => {
    const typical = { timeBands: [
      { timeBand: "08:00-08:15", percentageOfBaseLine: 0.2 },
      { timeBand: "08:30-08:45", percentageOfBaseLine: 0.8 },
      { timeBand: "09:45-10:00", percentageOfBaseLine: 0.35 },
      { timeBand: "10:00-10:15", percentageOfBaseLine: 0.3 },
    ] };
    expect(nextUsuallyQuiet(typical, 8 * 60 + 20)).toBe("09:45");
    expect(nextUsuallyQuiet(typical, 6 * 60)).toBe("08:00");
    expect(nextUsuallyQuiet({ timeBands: [{ timeBand: "12:00-12:15", percentageOfBaseLine: 0.1 }] }, 8 * 60)).toBeUndefined();
  });
});

describe("London station crowding", () => {
  it("reads a busy Tube station and suggests when it is usually quiet", async () => {
    stubTfl(
      { "Oxford Circus": [{ id: "940GZZLUOXC", name: "Oxford Circus Underground Station" }] },
      {
        "/crowding/940GZZLUOXC/Live": { dataAvailable: true, percentageOfBaseline: 0.55, timeUtc: "2026-10-15T07:16:00.000Z" },
        "/crowding/940GZZLUOXC/Thu": { timeBands: [{ timeBand: "10:00-10:15", percentageOfBaseLine: 0.3 }] },
      },
    );
    expect(await londonStationCrowding("Oxford Circus", now)).toEqual({
      station: "Oxford Circus Underground Station",
      level: "busy",
      measuredAt: "2026-10-15T07:16:00.000Z",
      usuallyQuietFrom: "10:00",
    });
  });

  it("does not look up quieter times for a quiet station", async () => {
    const fetcher = stubTfl(
      { Bank: [{ id: "940GZZLUBNK", name: "Bank Underground Station" }] },
      { "/crowding/940GZZLUBNK/Live": { dataAvailable: true, percentageOfBaseline: 0.2, timeUtc: "2026-10-15T07:16:00.000Z" } },
    );
    expect(await londonStationCrowding("Bank", now)).toMatchObject({ level: "quiet" });
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/Thu"))).toBe(false);
  });

  it("reads Monument from Bank, as TfL counts them together", async () => {
    stubTfl(
      { Monument: [{ id: "940GZZLUMMT", name: "Monument Underground Station" }] },
      { "/crowding/940GZZLUBNK/Live": { dataAvailable: true, percentageOfBaseline: 0.1, timeUtc: "2026-10-15T07:16:00.000Z" } },
    );
    expect(await londonStationCrowding("Monument", now)).toMatchObject({ station: "Monument Underground Station", level: "quiet" });
  });

  it("finds the Tube stop behind a rail-only first match", async () => {
    stubTfl(
      {
        Paddington: [{ id: "910GPADTON", name: "Paddington Rail Station" }],
        "Paddington Underground Station": [{ id: "940GZZLUPAC", name: "Paddington Underground Station" }],
      },
      { "/crowding/940GZZLUPAC/Live": { dataAvailable: true, percentageOfBaseline: 0.3, timeUtc: "2026-10-15T07:16:00.000Z" } },
    );
    expect(await londonStationCrowding("Paddington", now)).toMatchObject({ level: "quiet" });
  });

  it("says nothing when TfL has no reading or the station is not on the Tube", async () => {
    stubTfl(
      { Bank: [{ id: "940GZZLUBNK", name: "Bank Underground Station" }], Stratford: [{ id: "910GSTFD", name: "Stratford" }] },
      { "/crowding/940GZZLUBNK/Live": { dataAvailable: false, percentageOfBaseline: 0, timeUtc: null } },
    );
    expect(await londonStationCrowding("Bank", now)).toBeNull();
    expect(await londonStationCrowding("Stratford", now)).toBeNull();
  });

  it("drops a reading too old to call live", async () => {
    stubTfl(
      { Bank: [{ id: "940GZZLUBNK", name: "Bank Underground Station" }] },
      { "/crowding/940GZZLUBNK/Live": { dataAvailable: true, percentageOfBaseline: 0.2, timeUtc: "2026-10-15T06:40:00.000Z" } },
    );
    expect(await londonStationCrowding("Bank", now)).toBeNull();
  });
});
