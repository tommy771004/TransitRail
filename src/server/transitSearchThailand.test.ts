import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { runTransitSearch } from "./transitSearch";
import { collectThailandServiceDayArtifact, resetThailandBemCache } from "./thailandBem";

const BEM_URL = "https://metro.bemplc.co.th/Fare-Calculation?lang=en";
const fixture = readFileSync(new URL("./fixtures/bem-first-last.html", import.meta.url), "utf8");

describe("runTransitSearch Thailand official HTML advisory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetThailandBemCache();
    const artifactPath = new URL("../data/service-day/thailand.json", import.meta.url);
    if (existsSync(artifactPath)) unlinkSync(artifactPath);
  });

  it("does not fetch BEM from the journey-search request when no artifact exists", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("search must not fetch BEM"); });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
    });

    expect(result.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses the official station-direction table as partial coverage", async () => {
    const fetchMock = vi.fn(async () => new Response(fixture, { status: 200, headers: { "last-modified": "Tue, 28 Jul 2026 00:00:00 GMT" } }));
    vi.stubGlobal("fetch", fetchMock);

    await collectThailandServiceDayArtifact(fixture, [
      { origin: "Sukhumvit", destination: "Hua Lamphong" },
    ], "2026-08-03", "Tue, 28 Jul 2026 00:00:00 GMT");

    const result = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
      time: "23:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results.length).toBeGreaterThan(0);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "partial",
      serviceDate: "2026-08-03",
      timezone: "Asia/Bangkok",
      serviceDayType: "weekday",
      firstDeparture: "06:02",
      lastDeparture: "23:42",
      risk: "approaching",
      minutesToLastDeparture: 42,
      source: "BEM MRT official HTML",
      sourceUrl: BEM_URL,
      updatedAt: "Tue, 28 Jul 2026 00:00:00 GMT",
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the last scheduled artifact when a later collection fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture, { status: 200 })));
    const input = {
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand" as const,
      date: "2026-08-03",
      time: "20:00",
    };
    await collectThailandServiceDayArtifact(fixture, [
      { origin: input.origin, destination: input.destination },
    ], input.date);
    const first = await runTransitSearch(input);
    expect(first.payload.serviceDayAdvisory?.coverage).toBe("partial");
    await expect(collectThailandServiceDayArtifact("<html>changed</html>", [
      { origin: input.origin, destination: input.destination },
    ], input.date)).rejects.toThrow();
    const stale = await runTransitSearch(input);
    expect(stale.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "partial",
      firstDeparture: "06:02",
      lastDeparture: "23:42",
    }));
    expect(stale.payload.message).toBeUndefined();
  });

  it("labels an old scheduled artifact stale", async () => {
    await collectThailandServiceDayArtifact(fixture, [
      { origin: "Sukhumvit", destination: "Hua Lamphong" },
    ], "2026-08-03");
    const artifactPath = new URL("../data/service-day/thailand.json", import.meta.url);
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { retrievedAt: string };
    artifact.retrievedAt = "2026-07-25T00:00:00.000Z";
    writeFileSync(artifactPath, JSON.stringify(artifact));
    resetThailandBemCache();

    const result = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
    });

    expect(result.payload.serviceDayAdvisory?.coverage).toBe("stale");
  });

  it("recomputes risk for the selected query time from the scheduled boundaries", async () => {
    await collectThailandServiceDayArtifact(fixture, [
      { origin: "Sukhumvit", destination: "Hua Lamphong" },
    ], "2026-08-03");

    const result = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
      time: "23:40",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      risk: "critical",
      minutesToLastDeparture: 2,
    }));
  });

  it("rejects changed HTML and does not apply a page for another service date", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("search must not fetch BEM"); });
    vi.stubGlobal("fetch", fetchMock);
    await expect(collectThailandServiceDayArtifact("<html><body>markup changed</body></html>", [
      { origin: "Sukhumvit", destination: "Hua Lamphong" },
    ], "2026-08-03")).rejects.toThrow();
    const changed = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
    });
    expect(changed.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(changed.payload.message).toBeUndefined();

    const wrongDate = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-02",
    });
    expect(wrongDate.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(wrongDate.payload.serviceDayAdvisory?.note).toContain("latest scheduled artifact");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not infer BTS coverage from the BEM MRT page", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("BEM should not be queried for BTS fixture"); });
    vi.stubGlobal("fetch", fetchMock);
    const result = await runTransitSearch({
      origin: "Siam",
      destination: "Mo Chit",
      country: "thailand",
      date: "2026-08-02",
    });
    expect(result.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(result.payload.serviceDayAdvisory?.note).toContain("not covered");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
