import { describe, expect, it } from "vitest";
import {
  buildSeoulJourneys,
  formatClock,
  parseClock,
  parseDayType,
  parseLineLabel,
  parseSeoulSubwayTimetable,
} from "./seoulSubwayTimetable";

const utf8 = (rows: string[]) => Buffer.from(rows.join("\n"), "utf8");

/** Two line-1 runs plus one Saturday run, in the file's own call order. */
const TIMETABLE = utf8([
  "호선,역사명,열차번호,요일구분,상하행구분,도착시간,출발시간",
  "1호선,서울역,K101,평일,상행,05:31:00,05:31:30",
  "1호선,시청,K101,평일,상행,05:33:00,05:33:30",
  "1호선,종각,K101,평일,상행,05:35:00,05:35:30",
  "1호선,청량리,K101,평일,상행,05:44:00,05:44:30",
  "1호선,서울역,K103,평일,상행,06:01:00,06:01:30",
  "1호선,시청,K103,평일,상행,06:03:00,06:03:30",
  "1호선,종각,K103,평일,상행,06:05:00,06:05:30",
  "1호선,서울역,K901,토요일,상행,05:40:00,05:40:30",
  "1호선,시청,K901,토요일,상행,05:42:00,05:42:30",
  "",
]);

describe("parseClock / formatClock", () => {
  it("keeps after-midnight hours past 24 instead of wrapping", () => {
    expect(parseClock("05:31:00")).toBe(331);
    expect(parseClock("24:10")).toBe(1450);
    expect(parseClock("25:10:00")).toBe(1510);
  });

  it("rejects malformed times", () => {
    expect(parseClock("")).toBeUndefined();
    expect(parseClock("abc")).toBeUndefined();
    expect(parseClock("05:75")).toBeUndefined();
  });

  it("displays a past-midnight time as a wall clock", () => {
    expect(formatClock(331)).toBe("05:31");
    expect(formatClock(1510)).toBe("01:10");
    expect(formatClock(1440)).toBe("00:00");
  });
});

describe("parseDayType / parseLineLabel", () => {
  it("maps the Korean day markers onto the app's service day types", () => {
    expect(parseDayType("평일")).toBe("weekday");
    expect(parseDayType("토요일")).toBe("saturday");
    expect(parseDayType("일요일")).toBe("sunday_holiday");
    expect(parseDayType("공휴일")).toBe("sunday_holiday");
    expect(parseDayType("")).toBe("special");
  });

  it("normalises 호선 spellings to the menu's line label", () => {
    expect(parseLineLabel("1호선")).toBe("Line 1");
    expect(parseLineLabel("01호선")).toBe("Line 1");
    expect(parseLineLabel("")).toBeUndefined();
  });
});

describe("parseSeoulSubwayTimetable", () => {
  it("groups rows into one run per train number and day type", () => {
    const timetable = parseSeoulSubwayTimetable(TIMETABLE);
    expect(timetable.runs).toHaveLength(3);
    const k101 = timetable.runs.find((r) => r.trainNo === "K101")!;
    expect(k101.line).toBe("Line 1");
    expect(k101.dayType).toBe("weekday");
    expect(k101.calls.map((c) => c.station)).toEqual([
      "Seoul Station",
      "City Hall",
      "Jonggak",
      "Cheongnyangni",
    ]);
  });

  it("resolves Korean names to the English names search matches on", () => {
    const timetable = parseSeoulSubwayTimetable(TIMETABLE);
    const stations = timetable.runs.flatMap((r) => r.calls.map((c) => c.station));
    expect(stations).not.toContain("서울역");
    expect(stations).toContain("Seoul Station");
  });

  it("drops rows naming a station outside the menu instead of renaming them", () => {
    const timetable = parseSeoulSubwayTimetable(
      utf8([
        "호선,역사명,열차번호,요일구분,도착시간,출발시간",
        "1호선,시청,K101,평일,05:33:00,05:33:30",
        "신분당선,판교,D201,평일,05:40:00,05:40:30",
        "1호선,종각,K101,평일,05:35:00,05:35:30",
        "",
      ]),
    );
    expect(timetable.dropped["station not in menu"]).toBe(1);
    expect(timetable.runs.flatMap((r) => r.calls.map((c) => c.station))).toEqual([
      "City Hall",
      "Jonggak",
    ]);
  });

  it("rolls a call that wrapped past midnight forward instead of reordering it", () => {
    const timetable = parseSeoulSubwayTimetable(
      utf8([
        "호선,역사명,열차번호,요일구분,도착시간,출발시간",
        "1호선,서울역,K999,평일,23:55:00,23:55:30",
        "1호선,시청,K999,평일,00:02:00,00:02:30",
        "",
      ]),
    );
    const run = timetable.runs[0];
    // 00:02 on the next calendar day is 24:02 of this service day.
    expect(run.calls[1].departure).toBe(1442);
    expect(run.calls[1].departure!).toBeGreaterThan(run.calls[0].departure!);
  });

  it("refuses to guess when the file has no 열차번호 column", () => {
    const timetable = parseSeoulSubwayTimetable(
      utf8(["호선,역사명,요일구분,출발시간", "1호선,시청,평일,05:33:30", ""]),
    );
    expect(timetable.runs).toEqual([]);
    expect(timetable.dropped["no 열차번호 column"]).toBe(1);
  });

  it("discards a run with a single call, which cannot be a journey", () => {
    const timetable = parseSeoulSubwayTimetable(
      utf8(["호선,역사명,열차번호,요일구분,출발시간", "1호선,시청,K101,평일,05:33:30", ""]),
    );
    expect(timetable.runs).toEqual([]);
    expect(timetable.dropped["run with fewer than 2 calls"]).toBe(1);
  });
});

describe("buildSeoulJourneys", () => {
  const timetable = parseSeoulSubwayTimetable(TIMETABLE);

  it("builds a direct journey from real call times, with no invented fare", () => {
    const [first] = buildSeoulJourneys(timetable, {
      origin: "Seoul Station",
      destination: "Cheongnyangni",
      date: "2026-08-01",
      dayType: "weekday",
    });
    expect(first.departureTime).toBe("05:31");
    expect(first.arrivalTime).toBe("05:44");
    expect(first.durationMinutes).toBe(13);
    expect(first.operator).toBe("Seoul Metro");
    expect(first.service).toBe("Line 1");
    expect(first.direct).toBe(true);
    expect(first.stops).toEqual(["Seoul Station", "City Hall", "Jonggak", "Cheongnyangni"]);
    // The file carries no fare; a snapshot-style invented price is the defect
    // this dataset exists to remove.
    expect(first.price).toBeUndefined();
    expect(first.id.startsWith("2026-08-01-")).toBe(true);
  });

  it("returns one journey per train serving the pair, in departure order", () => {
    const journeys = buildSeoulJourneys(timetable, {
      origin: "Seoul Station",
      destination: "Jonggak",
      date: "2026-08-01",
      dayType: "weekday",
    });
    expect(journeys.map((j) => j.departureTime)).toEqual(["05:31", "06:01"]);
  });

  it("filters by service day type", () => {
    const saturday = buildSeoulJourneys(timetable, {
      origin: "Seoul Station",
      destination: "City Hall",
      date: "2026-08-01",
      dayType: "saturday",
    });
    expect(saturday).toHaveLength(1);
    expect(saturday[0].departureTime).toBe("05:40");
  });

  it("does not answer the reverse direction from a one-way run", () => {
    // K101 runs 서울역 -> 청량리. Asking the other way must find nothing rather
    // than reusing the same times backwards.
    expect(
      buildSeoulJourneys(timetable, {
        origin: "Cheongnyangni",
        destination: "Seoul Station",
        date: "2026-08-01",
        dayType: "weekday",
      }),
    ).toEqual([]);
  });

  it("matches station names case-insensitively, as search does", () => {
    const journeys = buildSeoulJourneys(timetable, {
      origin: "  seoul station ",
      destination: "city hall",
      date: "2026-08-01",
      dayType: "weekday",
    });
    expect(journeys).toHaveLength(2);
  });

  it("computes a duration across midnight without going negative", () => {
    const overnight = parseSeoulSubwayTimetable(
      utf8([
        "호선,역사명,열차번호,요일구분,도착시간,출발시간",
        "1호선,서울역,K999,평일,23:55:00,23:55:30",
        "1호선,시청,K999,평일,00:02:00,00:02:30",
        "",
      ]),
    );
    const [journey] = buildSeoulJourneys(overnight, {
      origin: "Seoul Station",
      destination: "City Hall",
      date: "2026-08-01",
    });
    expect(journey.departureTime).toBe("23:55");
    expect(journey.arrivalTime).toBe("00:02");
    expect(journey.durationMinutes).toBe(7);
  });

  it("returns nothing for a station the file does not serve", () => {
    expect(
      buildSeoulJourneys(timetable, {
        origin: "Seoul Station",
        destination: "Chungjeongno",
        date: "2026-08-01",
      }),
    ).toEqual([]);
  });
});
