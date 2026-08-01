import { describe, expect, it } from "vitest";
import rawStations from "./seoulSubwayStations.json";
import { seoulSubwayStationNames } from "./seoulSubway";
import { stationSearchKey } from "./stationKey";
import {
  isAmbiguousSeoulStationCode,
  seoulStationNameFromCode,
  seoulStationNameFromKorean,
} from "./seoulStationNames";

const records = rawStations as {
  STATION_CD: string;
  STATION_NM: string;
  STATION_NM_ENG: string;
}[];

/** The stations the app currently 404s on; see docs/korea-api-registration.md. */
const TARGET_STATIONS = ["시청", "충정로", "청량리", "을지로입구", "서울역"];

describe("seoulStationNameFromKorean", () => {
  it("resolves the stations the Korean dataset is being adopted for", () => {
    expect(seoulStationNameFromKorean("시청")).toBe("City Hall");
    expect(seoulStationNameFromKorean("충정로")).toBe("Chungjeongno");
    expect(seoulStationNameFromKorean("청량리")).toBe("Cheongnyangni");
    expect(seoulStationNameFromKorean("을지로입구")).toBe("Euljiro 1(il)-ga");
    expect(seoulStationNameFromKorean("서울역")).toBe("Seoul Station");
  });

  it("accepts a 역 suffix the station list omits, without mangling 서울역", () => {
    expect(seoulStationNameFromKorean("시청역")).toBe("City Hall");
    expect(seoulStationNameFromKorean("청량리역")).toBe("Cheongnyangni");
    // 서울역 is a real name ending in 역: trimming it would find no station.
    expect(seoulStationNameFromKorean("서울역")).toBe("Seoul Station");
    expect(seoulStationNameFromKorean("서울")).toBeUndefined();
  });

  it("ignores whitespace padding from the extract", () => {
    expect(seoulStationNameFromKorean("  시청  ")).toBe("City Hall");
    expect(seoulStationNameFromKorean("을지로 입구")).toBe("Euljiro 1(il)-ga");
  });

  it("returns undefined for stations outside the 1~9호선 menu", () => {
    expect(seoulStationNameFromKorean("판교")).toBeUndefined();
    expect(seoulStationNameFromKorean("")).toBeUndefined();
    expect(seoulStationNameFromKorean("존재하지않는역")).toBeUndefined();
  });

  it("round-trips every station in the dataset", () => {
    for (const record of records) {
      expect(seoulStationNameFromKorean(record.STATION_NM), record.STATION_NM).toBe(
        record.STATION_NM_ENG,
      );
    }
  });

  it("only ever returns a name the station menu also lists", () => {
    const menu = new Set(seoulSubwayStationNames.map((name: string) => stationSearchKey(name)));
    for (const station of TARGET_STATIONS) {
      const english = seoulStationNameFromKorean(station);
      expect(english, station).toBeDefined();
      expect(menu.has(stationSearchKey(english!)), english).toBe(true);
    }
  });

  it("has no Korean name whose 역-trimmed form is a different station", () => {
    // Guards the suffix fallback above: if the dataset ever gains a pair like
    // 신촌역/신촌, the trim would silently resolve to the wrong station.
    const names = new Set(records.map((r) => r.STATION_NM));
    for (const name of names) {
      if (!name.endsWith("역")) continue;
      expect(names.has(name.slice(0, -1)), name).toBe(false);
    }
  });
});

describe("seoulStationNameFromCode", () => {
  it("resolves 역사코드 exactly as stored, leading zero included", () => {
    expect(seoulStationNameFromCode("0151")).toBe("City Hall");
    expect(seoulStationNameFromCode("0416")).toBe("Seoul Station");
    expect(seoulStationNameFromCode("  0158  ")).toBe("Cheongnyangni");
  });

  it("recovers a leading zero a spreadsheet ate, when that is unambiguous", () => {
    // 151 is not itself a station code, so 0151 is the only reading.
    expect(seoulStationNameFromCode("151")).toBe("City Hall");
  });

  it("prefers the exact code over a padded guess when both exist", () => {
    // 416 is Miasageori's own code; 0416 is Seoul Station.
    expect(seoulStationNameFromCode("416")).toBe("Miasageori");
    expect(seoulStationNameFromCode("0416")).toBe("Seoul Station");
  });

  it("returns undefined for unknown or malformed codes", () => {
    expect(seoulStationNameFromCode("9999")).toBeUndefined();
    expect(seoulStationNameFromCode("")).toBeUndefined();
    expect(seoulStationNameFromCode("K101")).toBeUndefined();
  });

  it("round-trips every code in the dataset", () => {
    for (const record of records) {
      expect(seoulStationNameFromCode(record.STATION_CD), record.STATION_CD).toBe(
        record.STATION_NM_ENG,
      );
    }
  });
});

describe("isAmbiguousSeoulStationCode", () => {
  it("flags codes that a numeric round-trip makes unsafe", () => {
    expect(isAmbiguousSeoulStationCode("416")).toBe(true);
    expect(isAmbiguousSeoulStationCode("319")).toBe(true);
  });

  it("does not flag codes with only one reading", () => {
    expect(isAmbiguousSeoulStationCode("151")).toBe(false);
    expect(isAmbiguousSeoulStationCode("0416")).toBe(false);
    expect(isAmbiguousSeoulStationCode("K101")).toBe(false);
  });

  it("flags exactly the collisions Number() coercion would create", () => {
    const byNumeric = new Map<string, Set<string>>();
    for (const record of records) {
      const key = String(Number(record.STATION_CD));
      const names = byNumeric.get(key) ?? new Set<string>();
      names.add(record.STATION_NM_ENG);
      byNumeric.set(key, names);
    }
    const collisions = [...byNumeric.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([key]) => key);

    expect(collisions.length).toBeGreaterThan(0);
    for (const key of collisions) {
      expect(isAmbiguousSeoulStationCode(key), key).toBe(true);
    }
  });
});
