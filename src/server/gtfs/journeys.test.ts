import { describe, expect, it } from "vitest";
import { forEachGtfsCsvRow, parseGtfsFeed } from "./feed";
import { collectGtfsJourneys, collectGtfsJourneysForDates } from "./journeys";
import { germanyGtfsFixture, zipFixture } from "../gtfsZipFixture";

describe("collectGtfsJourneysForDates", () => {
  it("matches the single-route collector while scanning the feed once", () => {
    const feed = parseGtfsFeed(germanyGtfsFixture, { label: "fixture" });
    const route = { origin: "Berlin Hbf", destination: "Munich Hbf" };
    const expected = collectGtfsJourneys(feed, route.origin, route.destination, "2026-08-03");
    const result = collectGtfsJourneysForDates(feed, [route], ["2026-08-03"]);

    expect(result.get("0:2026-08-03")).toEqual(expected);
  });

  it("matches the single-route collector for routes that share a hub, over several dates", () => {
    // The regime the batch collector exists for and the one the rewrite
    // changed: many routes reading the same stop, answered from one scan.
    // Every pair must still equal what the single-route collector returns.
    const feed = parseGtfsFeed(germanyGtfsFixture, { label: "fixture" });
    const stops = [...feed.stops.values()].map((stop) => stop.name);
    const names = [...new Set(stops)].sort().slice(0, 4);
    const routes = names.flatMap((origin) => names
      .filter((destination) => destination !== origin)
      .map((destination) => ({ origin, destination })));
    const dates = ["2026-08-03", "2026-08-04"];

    const batched = collectGtfsJourneysForDates(feed, routes, dates);

    expect(routes.length).toBeGreaterThan(4);
    for (const [index, route] of routes.entries()) {
      for (const date of dates) {
        expect(batched.get(`${index}:${date}`))
          .toEqual(collectGtfsJourneys(feed, route.origin, route.destination, date));
      }
    }
  });

  it("keeps every call when a trip visits the same stop twice", () => {
    // A loop service calls at its origin again later in the run. Both stop
    // times have to survive the shared index, or the journey that starts at the
    // second call is lost.
    const feed = parseGtfsFeed(zipFixture({
      "stops.txt": ["stop_id,stop_name,parent_station", "S1,Loop End,", "S2,Middle,"].join("\n"),
      "trips.txt": ["route_id,service_id,trip_id,trip_headsign", "R1,daily,T1,Loop"].join("\n"),
      "stop_times.txt": [
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
        "T1,06:00:00,06:00:00,S1,1",
        "T1,06:30:00,06:30:00,S2,2",
        "T1,07:00:00,07:00:00,S1,3",
        "T1,07:30:00,07:30:00,S2,4",
      ].join("\n"),
      "calendar.txt": [
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
        "daily,1,1,1,1,1,1,1,20260101,20261231",
      ].join("\n"),
      "routes.txt": ["route_id,route_short_name,route_long_name,route_type", "R1,L,Loop,2"].join("\n"),
    }), { label: "fixture" });
    const route = { origin: "Loop End", destination: "Middle" };

    const batched = collectGtfsJourneysForDates(feed, [route], ["2026-08-19"]);

    expect(batched.get("0:2026-08-19"))
      .toEqual(collectGtfsJourneys(feed, route.origin, route.destination, "2026-08-19"));
    expect(batched.get("0:2026-08-19")).toEqual([
      expect.objectContaining({ tripId: "T1", departure: 6 * 60, arrival: 6 * 60 + 30 }),
    ]);
  });

  it("tells stations apart in a feed with no Latin letters", () => {
    // Station names normalized through an ASCII-only class collapse to "" and
    // then compare equal to every stop, so a Japanese feed answered a query for
    // its terminus with whichever stops a trip happened to call at.
    const feed = parseGtfsFeed(zipFixture({
      "stops.txt": ["stop_id,stop_name,parent_station", "S1,高松築港,", "S2,瓦町,", "S3,琴電琴平,"].join("\n"),
      "trips.txt": ["route_id,service_id,trip_id,trip_headsign", "R1,weekday,T1,琴電琴平"].join("\n"),
      "stop_times.txt": [
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
        "T1,06:00:00,06:00:00,S1,1",
        "T1,06:06:00,06:06:00,S2,2",
        "T1,07:00:00,07:00:00,S3,3",
      ].join("\n"),
      "calendar.txt": [
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
        "weekday,1,1,1,1,1,0,0,20260101,20261231",
      ].join("\n"),
      "routes.txt": ["route_id,route_short_name,route_long_name,route_type", "R1,琴平線,高松築港 - 琴電琴平,2"].join("\n"),
    }), { label: "fixture" });

    const journeys = collectGtfsJourneys(feed, "高松築港", "琴電琴平", "2026-08-19");

    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toMatchObject({ tripId: "T1", departure: 6 * 60, arrival: 7 * 60 });
    expect(collectGtfsJourneys(feed, "琴電琴平", "高松築港", "2026-08-19")).toEqual([]);
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
