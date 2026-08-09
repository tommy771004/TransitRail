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
    );

    expect(gotoCalls).toBe(16);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].departureTime).toBe("08:03");
  });
});
