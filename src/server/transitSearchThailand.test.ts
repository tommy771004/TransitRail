import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runTransitSearch } from "./transitSearch";
import { resetThailandBemCache, resetThailandBemPageCache } from "./thailandBem";

const BEM_URL = "https://metro.bemplc.co.th/Fare-Calculation?lang=en";
const fixture = readFileSync(new URL("./fixtures/bem-first-last.html", import.meta.url), "utf8");

describe("runTransitSearch Thailand official HTML advisory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetThailandBemCache();
  });

  it("parses the official station-direction table as partial coverage", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === BEM_URL) return new Response(fixture, { status: 200, headers: { "last-modified": "Tue, 28 Jul 2026 00:00:00 GMT" } });
      throw new Error(`Unexpected BEM fixture request: ${input}`);
    }));

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
      risk: "safe",
      source: "BEM MRT official HTML",
      sourceUrl: BEM_URL,
      updatedAt: "Tue, 28 Jul 2026 00:00:00 GMT",
    }));
  });

  it("uses stale last-known-good HTML when the official page later fails", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response(fixture, { status: 200 });
      throw new Error("fixture BEM outage secret");
    }));
    const input = {
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand" as const,
      date: "2026-08-03",
      time: "20:00",
    };
    const first = await runTransitSearch(input);
    expect(first.payload.serviceDayAdvisory?.coverage).toBe("partial");
    resetThailandBemPageCache();
    const stale = await runTransitSearch(input);
    expect(stale.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "stale",
      firstDeparture: "06:02",
      lastDeparture: "23:42",
    }));
    expect(stale.payload.message).toBeUndefined();
  });

  it("rejects changed HTML and does not apply a page for another service date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>markup changed</body></html>", { status: 200 })));
    const changed = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-03",
    });
    expect(changed.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(changed.payload.message).toBeUndefined();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture, { status: 200 })));
    resetThailandBemCache();
    const wrongDate = await runTransitSearch({
      origin: "Sukhumvit",
      destination: "Hua Lamphong",
      country: "thailand",
      date: "2026-08-02",
    });
    expect(wrongDate.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(wrongDate.payload.serviceDayAdvisory?.note).toContain("2026-08-03");
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
