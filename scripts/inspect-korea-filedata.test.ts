import { describe, expect, it } from "vitest";
import { classify, decode, inspectFileData, splitRow } from "./inspect-korea-filedata";

/**
 * A 열차운행시각표-shaped extract. Held as text and encoded per test so the
 * UTF-8 and CP949 cases are provably the same content.
 */
const TIMETABLE_CSV = [
  "연번,호선,역사명,열차번호,요일구분,상하행구분,도착시간,출발시간,종착역",
  "1,1호선,서울역,K101,평일,상행,05:31:00,05:31:30,소요산",
  "2,1호선,시청,K101,평일,상행,05:33:00,05:33:30,소요산",
  "3,2호선,을지로입구,2201,평일,내선,05:36:00,05:36:30,성수",
  "4,1호선,청량리,K105,평일,하행,05:40:00,05:40:30,인천",
  "5,5호선,충정로,5011,토요일,하행,05:44:00,05:44:30,방화",
  "6,1호선,서울역,K107,일요일,상행,06:01:00,06:01:30,소요산",
  "",
].join("\n");

/**
 * The same rows encoded CP949 (codepage 949), which is what data.go.kr serves
 * in practice. Base64 rather than a committed .csv because an editor or a git
 * filter that "helpfully" normalises encodings would destroy the only thing
 * this fixture exists to prove.
 */
const TIMETABLE_CP949_BASE64 =
  "v6y5+CzIo7yxLL+qu+e47Sy/rcL3ufjIoyy/5MDPsbi60Cy788fPx+CxuLrQLLW1wvi9w7CjLMPiud+9" +
  "w7CjLMG+wvi/qgoxLDHIo7yxLLytv++/qixLMTAxLMbywM8su/PH4CwwNTozMTowMCwwNTozMTozMCy8" +
  "0r/ku+oKMiwxyKO8sSy9w8O7LEsxMDEsxvLAzyy788fgLDA1OjMzOjAwLDA1OjMzOjMwLLzSv+S76goz" +
  "LDLIo7yxLMC7wfa3zsDUsbgsMjIwMSzG8sDPLLO7vLEsMDU6MzY6MDAsMDU6MzY6MzAsvLq89go0LDHI" +
  "o7yxLMO7t664rixLMTA1LMbywM8sx8/H4CwwNTo0MDowMCwwNTo0MDozMCzAzsO1CjUsNcijvLEsw+bB" +
  "pLfOLDUwMTEsxeS/5MDPLMfPx+AsMDU6NDQ6MDAsMDU6NDQ6MzAsuebIrQo2LDHIo7yxLLytv++/qixL" +
  "MTA3LMDPv+TAzyy788fgLDA2OjAxOjAwLDA2OjAxOjMwLLzSv+S76go=";

/** A 수송/수입 extract: the wrong file, and the one easiest to grab by mistake. */
const STATISTICS_CSV = [
  "연도,월,호선,수송인원,운수수입금액",
  "2025,1,1호선,18234512,9127256000",
  "2025,1,2호선,41235891,20617945500",
  "2025,2,1호선,17998231,8999115500",
  "",
].join("\n");

const utf8 = (text: string) => Buffer.from(text, "utf8");
const cp949 = Buffer.from(TIMETABLE_CP949_BASE64, "base64");

describe("decode", () => {
  it("reads a CP949 file without mojibake", () => {
    const { text, encoding } = decode(cp949);
    expect(encoding).toBe("euc-kr / cp949");
    expect(text).not.toContain("�");
    expect(text).toContain("역사명");
    expect(text).toContain("을지로입구");
  });

  it("recovers the same content from CP949 as from UTF-8", () => {
    // The whole point of detection: both encodings must yield equal rows, or
    // every station comparison downstream silently fails on one of them.
    expect(decode(cp949).text.trim()).toBe(TIMETABLE_CSV.trim());
  });

  it("reads UTF-8, with or without a BOM", () => {
    expect(decode(utf8(TIMETABLE_CSV)).encoding).toBe("utf-8");
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8(TIMETABLE_CSV)]);
    const decoded = decode(withBom);
    expect(decoded.encoding).toBe("utf-8 (BOM)");
    expect(decoded.text.startsWith("연번")).toBe(true);
  });
});

describe("splitRow", () => {
  it("splits on commas and keeps quoted commas intact", () => {
    expect(splitRow("a,b,c")).toEqual(["a", "b", "c"]);
    expect(splitRow('1,"서울역, 1호선",K101')).toEqual(["1", "서울역, 1호선", "K101"]);
    expect(splitRow('a,"say ""hi""",c')).toEqual(["a", 'say "hi"', "c"]);
  });
});

describe("classify", () => {
  it("separates station names from station codes", () => {
    const roles = classify(["역사코드", "역사명", "출발시간"]);
    expect(roles.station).toEqual(["역사명"]);
    expect(roles.stationCode).toEqual(["역사코드"]);
    expect(roles.departure).toEqual(["출발시간"]);
  });
});

describe("inspectFileData on a timetable", () => {
  it("reports the same verdict for CP949 and UTF-8", () => {
    const fromCp949 = inspectFileData(cp949);
    const fromUtf8 = inspectFileData(utf8(TIMETABLE_CSV));
    expect(fromCp949.encoding).toBe("euc-kr / cp949");
    expect(fromUtf8.encoding).toBe("utf-8");
    expect({ ...fromCp949, encoding: "" }).toEqual({ ...fromUtf8, encoding: "" });
  });

  it("finds every column role and marks the file usable", () => {
    const report = inspectFileData(cp949);
    expect(report.usable).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.rowCount).toBe(6);
    expect(Object.keys(report.roles).sort()).toEqual(
      [
        "arrival",
        "dayType",
        "departure",
        "direction",
        "line",
        "station",
        "terminus",
        "trainNo",
      ].sort(),
    );
  });

  it("counts rows, not substring hits, using the station column", () => {
    const report = inspectFileData(cp949);
    expect(report.countedBy).toBe("station column");
    const byStation = Object.fromEntries(report.coverage.map((c) => [c.station, c.rows]));
    // 서울역 is the station of record on two rows. The sibling test below
    // covers the case a whole-row substring count gets wrong.
    expect(byStation["서울역"]).toBe(2);
    expect(byStation["시청"]).toBe(1);
    expect(byStation["청량리"]).toBe(1);
    expect(byStation["을지로입구"]).toBe(1);
    expect(byStation["충정로"]).toBe(1);
  });

  it("does not count a station named only in the 종착역 column", () => {
    const csv = [
      "호선,역사명,출발시간,종착역",
      "1호선,종로3가,05:31:30,서울역",
      "",
    ].join("\n");
    const report = inspectFileData(utf8(csv));
    const seoulStation = report.coverage.find((c) => c.station === "서울역");
    expect(seoulStation?.rows).toBe(0);
  });

  it("reports which rows resolve to a station the menu can reach", () => {
    const report = inspectFileData(cp949);
    expect(report.resolvable).toBeDefined();
    expect(report.resolvable!.rows).toBe(6);
    expect(report.resolvable!.unmatched).toEqual([]);
  });

  it("lists station names outside the 1~9호선 menu instead of counting them", () => {
    const csv = [
      "호선,역사명,출발시간",
      "1호선,시청,05:31:30",
      "신분당선,판교,05:40:00",
      "",
    ].join("\n");
    const report = inspectFileData(utf8(csv));
    expect(report.resolvable!.rows).toBe(1);
    expect(report.resolvable!.unmatched).toEqual(["판교"]);
  });
});

describe("inspectFileData on the wrong file", () => {
  it("marks a statistics extract unusable and names what is missing", () => {
    const report = inspectFileData(utf8(STATISTICS_CSV));
    expect(report.usable).toBe(false);
    expect(report.missing).toEqual(["station name or code", "departure"]);
    expect(report.coverage.every((c) => c.rows === 0)).toBe(true);
  });

  it("accepts a file identified only by 역사코드", () => {
    const csv = ["역사코드,출발시간", "0151,05:31:30", ""].join("\n");
    const report = inspectFileData(utf8(csv));
    expect(report.usable).toBe(true);
    expect(report.missing).toEqual([]);
    // No name column, so per-row resolution is not attempted.
    expect(report.resolvable).toBeUndefined();
    expect(report.countedBy).toBe("whole row");
  });

  it("rejects a station list with no departure time", () => {
    const csv = ["역사코드,역사명", "0151,시청", ""].join("\n");
    const report = inspectFileData(utf8(csv));
    expect(report.usable).toBe(false);
    expect(report.missing).toEqual(["departure"]);
  });

  it("handles an empty file without throwing", () => {
    const report = inspectFileData(utf8(""));
    expect(report.rowCount).toBe(0);
    expect(report.usable).toBe(false);
  });
});
