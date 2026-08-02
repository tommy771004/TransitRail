import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { serviceDayArtifactFixture } from "./serviceDayArtifactFixture";
import { franceGtfsFixture as gtfsFixture } from "./gtfsZipFixture";
import { runTransitSearch } from "./transitSearch";
import { collectFranceServiceDayArtifact, resetFranceGtfsCache, resetFranceGtfsFeedCache } from "./franceGtfs";

const artifact = serviceDayArtifactFixture(
  new URL("../data/service-day/france.json", import.meta.url),
);

describe("runTransitSearch France GTFS service-day advisory", () => {
  beforeAll(() => artifact.stash());
  afterAll(() => artifact.restore());
  // Pin the clock to the service day these fixtures use. Search only answers
  // dates inside the current window, so without this the suite passes only
  // until the calendar moves past that date.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-03T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetFranceGtfsCache();
    artifact.clear();
  });

  it("does not fetch SNCF from the journey-search request when no artifact exists", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("search must not fetch SNCF"); });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the official GTFS calendar, filters cancelled services, and preserves cross-midnight times", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip") {
        return new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } });
      }
      throw new Error(`Unexpected France fixture request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await collectFranceServiceDayArtifact([
      { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
    ], "2026-08-03");

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
      time: "00:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results.length).toBeGreaterThan(0);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      serviceDate: "2026-08-03",
      timezone: "Europe/Paris",
      serviceDayType: "special",
      // The fixture's corridor also carries a slow TER at 07:34, so the
      // service day genuinely opens earlier than the TGV.
      firstDeparture: "07:34",
      lastDeparture: "23:50",
      source: "SNCF Open Data GTFS",
      sourceUrl: "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip",
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the last scheduled artifact when a later collection fails", async () => {
    const fetchMock = vi.fn(async () => new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } }));
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france" as const,
      date: "2026-08-03",
      // Inside the real service day: SNCF's last Paris → Lyon TGV is 21:00. The
      // curated snapshot this replaced invented a 22:00 departure, and asking
      // for one is what made this assertion pass before.
      time: "20:00",
    };
    await collectFranceServiceDayArtifact([
      { origin: input.origin, destination: input.destination },
    ], input.date);
    const first = await runTransitSearch(input);
    expect(first.payload.serviceDayAdvisory?.coverage).toBe("supported");

    resetFranceGtfsFeedCache();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fixture SNCF outage secret"); }));
    await expect(collectFranceServiceDayArtifact([
      { origin: input.origin, destination: input.destination },
    ], input.date)).rejects.toThrow();
    const stale = await runTransitSearch(input);
    expect(stale.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      // The fixture's corridor also carries a slow TER at 07:34, so the
      // service day genuinely opens earlier than the TGV.
      firstDeparture: "07:34",
      lastDeparture: "23:50",
    }));
    expect(stale.payload.message).toBeUndefined();
  });

  it("labels an old scheduled artifact stale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } })));
    await collectFranceServiceDayArtifact([
      { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
    ], "2026-08-03");
    const artifactPath = new URL("../data/service-day/france.json", import.meta.url);
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { retrievedAt: string };
    artifact.retrievedAt = "2026-07-25T00:00:00.000Z";
    writeFileSync(artifactPath, JSON.stringify(artifact));
    resetFranceGtfsCache();

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.payload.serviceDayAdvisory?.coverage).toBe("stale");
  });

  it("recomputes risk for the selected query time from the scheduled boundaries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } })));
    await collectFranceServiceDayArtifact([
      { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
    ], "2026-08-03");

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
      time: "23:40",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      risk: "critical",
      minutesToLastDeparture: 10,
    }));
  });

  it("publishes valid routes when another route has no complete service", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } })));

    const artifact = await collectFranceServiceDayArtifact([
      { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
      { origin: "Unknown Station", destination: "Lyon Part-Dieu" },
    ], "2026-08-03");

    expect(Object.keys(artifact.routes)).toContain("paris gare de lyon->lyon part dieu");
    expect(Object.keys(artifact.routes)).not.toContain("unknown station->lyon part dieu");
  });

  it("does not publish a partial or malformed archive as service-day coverage", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([0x01, 0x02]), {
      status: 200,
      headers: { "content-type": "application/zip" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(collectFranceServiceDayArtifact([
      { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
    ], "2026-08-03")).rejects.toThrow();

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(result.payload.message).toBeUndefined();
    expect(result.payload.serviceDayAdvisory?.note).not.toContain("central directory");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an explicit unavailable advisory even when the journey result is empty", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("search must not fetch SNCF"); });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTransitSearch({
      origin: "Unknown Station",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.results).toHaveLength(0);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "unavailable",
      serviceDate: "2026-08-03",
      risk: "unavailable",
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
