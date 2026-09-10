import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BaseScraper, ScrapeRunReport } from "./base";

vi.mock("./artifactBuilder", () => ({ buildCountryMetadata: () => [] }));
vi.mock("./malaysia", () => ({ syncMalaysiaStationCatalog: async () => ({ stationCount: 0, sourceCount: 0 }) }));
vi.mock("../../src/server/errorLog", () => ({ recordError: async () => ({}) }));

const scrapers: BaseScraper[] = [];
vi.mock("./registry", () => ({
  createTimetableScrapers: () => scrapers,
  scraperDisplayNames: () => ({}),
}));

const { runAllScrapers } = await import("./index");
const { providerDateValue } = await import("../../src/data/countries");

/**
 * A scraper that records when it ran rather than fetching anything, so the
 * schedule itself can be asserted. The delay is what makes overlap observable.
 */
function fakeScraper(country: string, name: string, log: string[], delayMs = 5, overlaps: string[] = []) {
  let inFlight = false;
  let lastDate = "";
  return {
    country,
    name,
    routes: [{ origin: "A", destination: "B" }],
    async runAll(date: string) {
      // Two scrapers of one country sharing a data directory must never
      // overlap; this is the invariant the country-level pool exists to keep.
      // Recorded rather than asserted here: `runAllScrapers` catches whatever a
      // scraper throws, so an `expect` inside this fake would be swallowed and
      // the test would pass while the invariant was broken.
      if (inFlight) overlaps.push(`${country}/${name} ${date}`);
      inFlight = true;
      lastDate = date;
      log.push(`start ${country}/${name} ${date}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      log.push(`end ${country}/${name} ${date}`);
      inFlight = false;
      return [{ results: [{}] }];
    },
    report(): ScrapeRunReport {
      return {
        country,
        scraper: name,
        date: lastDate,
        outcomes: [{ origin: "A", destination: "B", date: lastDate, status: "ok", rowCount: 1, sourceId: "be-irail" }],
      } as unknown as ScrapeRunReport;
    },
  } as unknown as BaseScraper;
}

describe("runAllScrapers scheduling", () => {
  beforeEach(() => {
    scrapers.length = 0;
  });

  it("collects a country's whole window before moving to its next scraper", async () => {
    const log: string[] = [];
    scrapers.push(fakeScraper("japan", "one", log), fakeScraper("japan", "two", log));

    await runAllScrapers(["2026-08-01", "2026-08-02"], { countryConcurrency: 4 });

    // Every date of scraper "one" precedes the first date of "two": a browser
    // market launches one Chromium for the window, not one per service day.
    // The full sequence, not just the starts: scraper "one" must have finished
    // its whole window before "two" opens, which is what lets a browser market
    // hold one Chromium for the window.
    expect(log).toEqual([
      "start japan/one 2026-08-01", "end japan/one 2026-08-01",
      "start japan/one 2026-08-02", "end japan/one 2026-08-02",
      "start japan/two 2026-08-01", "end japan/two 2026-08-01",
      "start japan/two 2026-08-02", "end japan/two 2026-08-02",
    ]);
  });

  it("overlaps different countries and never overlaps one country's scrapers", async () => {
    const log: string[] = [];
    const overlaps: string[] = [];
    scrapers.push(
      fakeScraper("japan", "one", log, 20, overlaps),
      fakeScraper("japan", "two", log, 20, overlaps),
      fakeScraper("belgium", "be", log, 20, overlaps),
      fakeScraper("norway", "no", log, 20, overlaps),
    );

    await runAllScrapers(["2026-08-01"], { countryConcurrency: 3 });

    // Belgium runs while Japan is still on its first scraper. Asserted on the
    // order of events rather than on elapsed time, so a loaded machine cannot
    // fail the nightly gate and cost a night's publication.
    const order = log.filter((line) => line.startsWith("start"));
    expect(order.indexOf("start belgium/be 2026-08-01"))
      .toBeLessThan(order.indexOf("start japan/two 2026-08-01"));
    expect(overlaps).toEqual([]);
  });

  it("honours the concurrency cap", async () => {
    const log: string[] = [];
    let inFlight = 0;
    let peak = 0;
    for (const country of ["japan", "belgium", "norway", "france", "germany"]) {
      const inner = fakeScraper(country, "s", log, 15);
      const original = inner.runAll.bind(inner);
      inner.runAll = async (d: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        try { return await original(d); } finally { inFlight -= 1; }
      };
      scrapers.push(inner);
    }

    await runAllScrapers(["2026-08-01"], { countryConcurrency: 2 });

    expect(peak).toBe(2);
  });

  it("asks a live-only market only about the day its source can answer", async () => {
    const log: string[] = [];
    scrapers.push(fakeScraper("hong_kong", "mtr", log));
    const today = providerDateValue("hong_kong");
    const other = today === "2026-08-01" ? "2026-08-02" : "2026-08-01";

    await runAllScrapers([today, other], { countryConcurrency: 2 });

    expect(log.filter((line) => line.startsWith("start"))).toEqual([`start hong_kong/mtr ${today}`]);
  });
});
