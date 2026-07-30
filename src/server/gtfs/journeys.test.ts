import { describe, expect, it } from "vitest";
import { forEachGtfsCsvRow, parseGtfsFeed } from "./feed";
import { collectGtfsJourneys, collectGtfsJourneysForDates } from "./journeys";
import { germanyGtfsFixture } from "../gtfsZipFixture";

describe("collectGtfsJourneysForDates", () => {
  it("matches the single-route collector while scanning the feed once", () => {
    const feed = parseGtfsFeed(germanyGtfsFixture, { label: "fixture" });
    const route = { origin: "Berlin Hbf", destination: "Munich Hbf" };
    const expected = collectGtfsJourneys(feed, route.origin, route.destination, "2026-08-03");
    const result = collectGtfsJourneysForDates(feed, [route], ["2026-08-03"]);

    expect(result.get("0:2026-08-03")).toEqual(expected);
  });

  it("decodes byte-backed CSV entries incrementally", () => {
    const rows: Record<string, string>[] = [];
    forEachGtfsCsvRow(new TextEncoder().encode("\uFEFFid,name\r\n1,Zurich\r\n2,Bern\r\n"), (row) => rows.push(row));

    expect(rows).toEqual([
      { id: "1", name: "Zurich" },
      { id: "2", name: "Bern" },
    ]);
  });
});
