import { describe, expect, it } from "vitest";
import {
  buildTflBrowserQueryUrl,
  buildTflBrowserResults,
  scrapeTflBrowserServiceDay,
  type TflBrowserJourneySummary,
} from "./tflBrowser";

describe("TfL official Journey Planner browser scraper", () => {
  it("builds a dated official-page query with stable station ids", () => {
    const url = new URL(buildTflBrowserQueryUrl(
      "King's Cross St. Pancras Underground Station",
      "Oxford Circus Underground Station",
      "2026-08-13",
      "08:30",
    ));

    expect(url.origin + url.pathname).toBe("https://tfl.gov.uk/JourneyPlanner/ResultsAsync");
    expect(url.searchParams.get("FromId")).toBe("1000129");
    expect(url.searchParams.get("ToId")).toBe("1000173");
    expect(url.searchParams.get("Date")).toBe("20260813");
    expect(url.searchParams.get("Time")).toBe("0830");
    expect(url.searchParams.get("TimeIs")).toBe("departing");
    expect(url.searchParams.get("Modes")).toBe("tube,dlr,overground,elizabeth-line");
  });

  it("turns only journeys actually returned by the page into dated timetable rows", () => {
    const samples: TflBrowserJourneySummary[] = [
      {
        departureTime: "08:03",
        arrivalTime: "08:48",
        durationMinutes: 45,
        services: ["Elizabeth line"],
        modes: ["elizabeth-line"],
        price: 15.5,
      },
      {
        departureTime: "08:19",
        arrivalTime: "09:05",
        durationMinutes: 46,
        services: ["Piccadilly line"],
        modes: ["tube"],
      },
      // The web planner may still return bus alternatives even when rail modes
      // are requested. TransitRail must not publish those as train departures.
      {
        departureTime: "08:21",
        arrivalTime: "09:09",
        durationMinutes: 48,
        services: ["73 bus"],
        modes: ["bus"],
      },
      // Overlapping samples on the Journey Planner return the same departure.
      {
        departureTime: "08:19",
        arrivalTime: "09:05",
        durationMinutes: 46,
        services: ["Piccadilly line"],
        modes: ["tube"],
      },
    ];

    const results = buildTflBrowserResults(
      "Heathrow Terminals 2&3",
      "Oxford Circus Underground Station",
      "2026-08-13",
      samples,
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.departureTime)).toEqual(["08:03", "08:19"]);
    expect(results[0]).toMatchObject({
      country: "united_kingdom",
      date: "2026-08-13",
      operator: "Transport for London",
      service: "Elizabeth line",
      price: 15.5,
      currency: "GBP",
      realtime: false,
      direct: true,
      stops: [],
    });
    expect(results[0].id).toMatch(/^2026-08-13-uk-tfl-browser-0803-0848-/);
  });

  it("rejects stations outside the configured official-page route set", () => {
    expect(() => buildTflBrowserQueryUrl(
      "Waterloo Underground Station",
      "Oxford Circus Underground Station",
      "2026-08-13",
      "08:30",
    )).toThrow(/No TfL Journey Planner station id/);
  });

  it("retries a transient page navigation failure without inventing a row", async () => {
    let gotoCalls = 0;
    const page = {
      goto: async () => {
        gotoCalls += 1;
        if (gotoCalls === 1) throw new Error("temporary navigation timeout");
      },
      waitForFunction: async () => undefined,
      locator: () => ({
        evaluateAll: async () => [{
          departureTime: "08:03",
          arrivalTime: "08:48",
          services: ["Victoria line"],
          modes: ["tube"],
        }],
      }),
    };

    const result = await scrapeTflBrowserServiceDay(
      page as never,
      "King's Cross St. Pancras Underground Station",
      "Oxford Circus Underground Station",
      "2026-08-15",
      { retryDelayMs: 0 },
    );

    expect(gotoCalls).toBe(16);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].departureTime).toBe("08:03");
  });

  /** A page that refuses the sample times named, and answers every other one. */
  function pageRefusing(times: string[]) {
    let attempted = 0;
    const page = {
      goto: async (url: string) => {
        attempted += 1;
        const time = new URL(url).searchParams.get("Time") || "";
        if (times.includes(time)) throw new Error("page.waitForFunction: Timeout 12000ms exceeded.");
      },
      waitForFunction: async () => undefined,
      locator: () => ({
        evaluateAll: async () => [{
          departureTime: "08:03",
          arrivalTime: "08:48",
          services: ["Victoria line"],
          modes: ["tube"],
        }],
      }),
    };
    return { page, attempts: () => attempted };
  }

  it("keeps the samples the planner did answer when a few are refused", async () => {
    // A single refused sample used to throw out of the sweep, so one timeout at
    // 05:30 discarded the fourteen samples that were never attempted.
    const { page, attempts } = pageRefusing(["0530", "0645"]);

    const result = await scrapeTflBrowserServiceDay(
      page as never,
      "Leicester Square",
      "Camden Town",
      "2026-08-19",
      { retryDelayMs: 0 },
    );

    expect(result.results).toHaveLength(1);
    // Every sample time is still tried: 13 answered once, 2 refused twice.
    expect(attempts()).toBe(17);
  });

  it("refuses a day with material gaps rather than publishing a sparse one", async () => {
    const { page } = pageRefusing(["0530", "0645", "0800", "0915"]);

    await expect(scrapeTflBrowserServiceDay(
      page as never,
      "Leicester Square",
      "Camden Town",
      "2026-08-19",
      { retryDelayMs: 0 },
    )).rejects.toThrow(/covered too little of 2026-08-19.*11\/15 samples answered/s);
  });

  it("says what the page was when the results markup never appears", async () => {
    const page = {
      goto: async () => undefined,
      waitForFunction: async () => { throw new Error("page.waitForFunction: Timeout 12000ms exceeded."); },
      locator: () => ({ evaluateAll: async () => [] }),
      url: () => "https://tfl.gov.uk/JourneyPlanner/ResultsAsync?x=1",
      evaluate: async () => ({ title: "Access denied", text: "Your request has been blocked." }),
    };

    await expect(scrapeTflBrowserServiceDay(
      page as never,
      "Leicester Square",
      "Camden Town",
      "2026-08-19",
      { retryDelayMs: 0 },
    )).rejects.toThrow(/title "Access denied".*Your request has been blocked/s);
  });
});
