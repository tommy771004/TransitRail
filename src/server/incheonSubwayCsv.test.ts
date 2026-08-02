import { describe, expect, it } from "vitest";
import {
  decodeKoreanCsv,
  mergeIncheonTimetables,
  parseIncheonStationDictionary,
  parseIncheonTimetable,
} from "./incheonSubwayCsv";

const cp949 = (text: string) => {
  // Node cannot encode cp949, so tests use UTF-8 fixtures and cover the cp949
  // path through decodeKoreanCsv's ordering instead.
  return Buffer.from(text, "utf8");
};

const STATION_CSV = cp949([
  "역번호,역사명,노선번호,노선명,영문역사명,한자역사명,환승역구분",
  "3107,검단호수공원,S2801,인천지하철 1호선,Geomdan Lake Park,黔丹湖水公園,일반역",
  "3110,계양,S2801,인천지하철 1호선,Gyeyang,桂陽,환승역",
  "3120,부평,S2801,인천지하철 1호선,Bupyeong,富平,환승역",
].join("\n"));

const dictionary = () => parseIncheonStationDictionary(STATION_CSV);

const timetable = (rows: string[]) => cp949([
  "시발역,종착역,열차번호,검단호수공원,계양,부평",
  ...rows,
].join("\n"));

describe("Incheon station dictionary", () => {
  it("maps the Korean name the timetable columns use onto the English menu name", () => {
    const dict = dictionary();
    expect(dict.get("계양")).toBe("Gyeyang");
    expect(dict.get("검단호수공원")).toBe("Geomdan Lake Park");
    expect(dict.size).toBe(3);
  });

  it("fails loudly when the operator's columns are missing", () => {
    expect(() => parseIncheonStationDictionary(cp949("역번호,역사명\n3107,계양")))
      .toThrow(/영문역사명/);
  });
});

describe("Incheon wide timetable", () => {
  it("reads one train per row and skips the stations it does not call at", () => {
    const parsed = parseIncheonTimetable(
      timetable(["계양,부평,1001,,05:30:00,05:36:00"]),
      dictionary(),
      { line: "Incheon Line 1", dayType: "weekday", direction: "down" },
    );

    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0]).toMatchObject({
      trainNo: "1001",
      line: "Incheon Line 1",
      dayType: "weekday",
      direction: "down",
    });
    // The blank first column is a station this train does not serve.
    expect(parsed.runs[0].calls).toEqual([
      { station: "Gyeyang", arrival: 330, departure: 330 },
      { station: "Bupyeong", arrival: 336, departure: 336 },
    ]);
  });

  it("counts a station the dictionary does not carry instead of emitting Korean", () => {
    // Search matches on the English menu name, so a Korean name would add a
    // station the picker lists and search can never answer for.
    const withUnknown = cp949([
      "시발역,종착역,열차번호,계양,부평,알수없는역",
      "계양,부평,1001,05:30:00,05:36:00,05:40:00",
    ].join("\n"));
    const parsed = parseIncheonTimetable(withUnknown, dictionary(), {
      line: "Incheon Line 1", dayType: "weekday", direction: "down",
    });

    expect(parsed.runs[0].calls.map((call) => call.station)).toEqual(["Gyeyang", "Bupyeong"]);
    expect(parsed.dropped["station not in dictionary: 알수없는역"]).toBe(1);
  });

  it("keeps after-midnight hours rather than rolling them over", () => {
    // Korean feeds express late service as 24:xx/25:xx, and the duration
    // arithmetic downstream depends on that surviving.
    const parsed = parseIncheonTimetable(
      timetable(["계양,부평,1999,,24:10:00,25:05:00"]),
      dictionary(),
      { line: "Incheon Line 1", dayType: "weekday", direction: "down" },
    );
    expect(parsed.runs[0].calls.map((call) => call.arrival)).toEqual([24 * 60 + 10, 25 * 60 + 5]);
  });

  it("drops a row that cannot form a journey", () => {
    const parsed = parseIncheonTimetable(
      timetable(["계양,부평,1001,,05:30:00,", "계양,부평,,05:30:00,05:36:00,"]),
      dictionary(),
      { line: "Incheon Line 1", dayType: "weekday", direction: "down" },
    );
    expect(parsed.runs).toHaveLength(0);
    expect(parsed.dropped["fewer than two calls"]).toBe(1);
    expect(parsed.dropped["blank 열차번호"]).toBe(1);
  });

  it("accepts either train column the operator uses", () => {
    // Line 1 labels it 열차번호, Line 2 labels it 순번. Assuming one silently
    // produced zero Line 2 runs.
    const line2 = cp949([
      "시발역,종착역,순번,계양,부평",
      "계양,부평,7,05:30:00,05:36:00",
    ].join("\n"));
    const parsed = parseIncheonTimetable(line2, dictionary(), {
      line: "Incheon Line 2", dayType: "weekday", direction: "up",
    });
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].trainNo).toBe("7");
  });

  it("reports a missing train column rather than guessing train identity", () => {
    const parsed = parseIncheonTimetable(
      cp949("시발역,종착역,계양\n계양,부평,05:30:00"),
      dictionary(),
      { line: "Incheon Line 1", dayType: "weekday", direction: "down" },
    );
    expect(parsed.runs).toHaveLength(0);
    expect(parsed.dropped["no 열차번호/순번 column"]).toBe(1);
  });
});

describe("Incheon CSV decoding", () => {
  it("strips a UTF-8 BOM", () => {
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("역사명", "utf8")]);
    expect(decodeKoreanCsv(buffer)).toEqual({ text: "역사명", encoding: "utf-8-bom" });
  });

  it("does not silently accept bytes that are not valid in any expected encoding", () => {
    // A lenient decode would produce replacement characters, every station name
    // would miss the dictionary, and the feed would look empty rather than broken.
    expect(() => decodeKoreanCsv(Buffer.from([0xff, 0xfe, 0xff, 0xfe]))).toThrow(/cp949|EUC-KR/);
  });
});

describe("merging Incheon slices", () => {
  it("combines runs and keeps every drop reason", () => {
    const first = parseIncheonTimetable(
      timetable(["계양,부평,1001,,05:30:00,05:36:00"]),
      dictionary(),
      { line: "Incheon Line 1", dayType: "weekday", direction: "up" },
    );
    const second = parseIncheonTimetable(
      timetable(["계양,부평,,05:30:00,05:36:00,"]),
      dictionary(),
      { line: "Incheon Line 1", dayType: "sunday_holiday", direction: "down" },
    );

    const merged = mergeIncheonTimetables([first, second]);
    expect(merged.runs).toHaveLength(1);
    expect(merged.dropped["blank 열차번호"]).toBe(1);
  });
});
