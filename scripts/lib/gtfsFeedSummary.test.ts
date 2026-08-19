import { describe, expect, it } from "vitest";
import { parseGtfsFeed } from "../../src/server/gtfs/feed";
import { zipFixture } from "../../src/server/gtfsZipFixture";
import { isGtfsRailRouteType, scrapeRoutePairs, summarizeGtfsRoutes } from "./gtfsFeedSummary";

// A GTFS-JP shaped feed: one rail line whose trips do not all run the full
// length, one bus line on the same operator's account, and station names in the
// operator's own script — which is the spelling search has to match.
const feed = parseGtfsFeed(zipFixture({
  "stops.txt": [
    "stop_id,stop_name,parent_station",
    "S1,高松築港,",
    "S2,片原町,",
    "S3,瓦町,",
    "S4,栗林公園,",
    "S5,琴電琴平,",
    "B1,高松駅前,",
    "B2,空港通り,",
  ].join("\n"),
  "trips.txt": [
    "route_id,service_id,trip_id,trip_headsign",
    "R-KOTOHIRA,weekday,T-full,琴電琴平",
    "R-KOTOHIRA,weekday,T-short,瓦町",
    "R-KOTOHIRA,weekday,T-back,高松築港",
    "R-BUS,weekday,T-bus,空港通り",
  ].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "T-full,06:00:00,06:00:00,S1,1",
    "T-full,06:03:00,06:03:00,S2,2",
    "T-full,06:06:00,06:06:00,S3,3",
    "T-full,06:12:00,06:12:00,S4,4",
    "T-full,07:00:00,07:00:00,S5,5",
    "T-short,08:00:00,08:00:00,S1,1",
    "T-short,08:06:00,08:06:00,S3,2",
    "T-back,09:00:00,09:00:00,S5,1",
    "T-back,10:00:00,10:00:00,S1,2",
    "T-bus,07:00:00,07:00:00,B1,1",
    "T-bus,07:20:00,07:20:00,B2,2",
  ].join("\n"),
  "calendar.txt": [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "weekday,1,1,1,1,1,0,0,20260101,20261231",
  ].join("\n"),
  "routes.txt": [
    "route_id,route_short_name,route_long_name,route_type",
    "R-KOTOHIRA,琴平線,高松築港 - 琴電琴平,2",
    "R-BUS,空港線,高松駅前 - 空港通り,3",
  ].join("\n"),
}), { label: "fixture" });

describe("GTFS feed summary", () => {
  it("reports each line's terminals and calling pattern in the feed's own spelling", () => {
    const summaries = summarizeGtfsRoutes(feed);

    expect(summaries.map((summary) => summary.routeId)).toEqual(["R-KOTOHIRA", "R-BUS"]);
    expect(summaries[0]).toMatchObject({
      name: "琴平線",
      routeType: 2,
      tripCount: 3,
      // Two of the three trips start at 高松築港 and two end at 琴電琴平, so the
      // short-turn and the return working do not move the terminals.
      terminals: ["高松築港", "琴電琴平"],
      stops: ["高松築港", "片原町", "瓦町", "栗林公園", "琴電琴平"],
    });
  });

  it("proposes both directions of each rail line and leaves buses out", () => {
    expect(scrapeRoutePairs(summarizeGtfsRoutes(feed))).toEqual([
      { origin: "高松築港", destination: "琴電琴平" },
      { origin: "琴電琴平", destination: "高松築港" },
    ]);
  });

  it("counts the extended route types European feeds file rail under", () => {
    // SNCF files a TGV as 101 and a TER as 106; a filter that knows only 0/1/2
    // would drop both.
    expect(isGtfsRailRouteType(101)).toBe(true);
    expect(isGtfsRailRouteType(106)).toBe(true);
    expect(isGtfsRailRouteType(400)).toBe(true);
    expect(isGtfsRailRouteType(3)).toBe(false);
    expect(isGtfsRailRouteType(700)).toBe(false);
  });
});
