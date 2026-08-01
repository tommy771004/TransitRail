import { describe, expect, it } from "vitest";
import type { TransitResult } from "../types";
import {
  classifyTimetable,
  isIndicativeTimetable,
  parseClockMinutes,
  type TimetableSnapshot,
} from "./timetableAuthenticity";

function result(partial: Partial<TransitResult> = {}): TransitResult {
  return {
    id: "2026-08-01-official-0",
    country: "japan",
    operator: "Official operator",
    service: "Line A",
    date: "2026-08-01",
    origin: "Origin",
    destination: "Destination",
    departureTime: "08:00",
    arrivalTime: "08:30",
    direct: true,
    stops: ["Origin", "Destination"],
    ...partial,
  };
}

function snapshot(
  source: string,
  results: TransitResult[],
): TimetableSnapshot {
  return {
    origin: "Origin",
    destination: "Destination",
    date: "2026-08-01",
    scrapedAt: "2026-08-01T08:00:00.000Z",
    source,
    results,
  };
}

describe("timetable authenticity", () => {
  it("parses only clock values", () => {
    expect(parseClockMinutes("06:05")).toBe(365);
    expect(parseClockMinutes("25:05")).toBe(1505);
    expect(parseClockMinutes("not-a-time")).toBeUndefined();
  });

  it("keeps the existing indicative backstop semantics", () => {
    const fixedHeadway = [0, 10, 20, 30].map((offset, index) =>
      result({ id: `row-${index}`, departureTime: `08:${String(offset).padStart(2, "0")}` }),
    );
    const mixedHeadway = ["08:00", "08:10", "08:25", "08:35"].map((departureTime, index) =>
      result({ id: `mixed-${index}`, departureTime }),
    );

    expect(isIndicativeTimetable("official snapshot", mixedHeadway)).toBe(true);
    expect(isIndicativeTimetable("official", fixedHeadway)).toBe(true);
    expect(isIndicativeTimetable("official", mixedHeadway)).toBe(false);
  });

  it("classifies an empty date slice as none", () => {
    expect(classifyTimetable(snapshot("official", [result()]), "2026-08-02")).toBe("none");
  });

  it("classifies official scheduled rows as scraped", () => {
    const rows = [
      result({ id: "2026-08-01-official-0", departureTime: "08:00" }),
      result({ id: "2026-08-01-official-1", departureTime: "08:17" }),
    ];
    expect(classifyTimetable(snapshot("official timetable", rows), "2026-08-01")).toBe("scraped");
  });

  it("classifies a current realtime snapshot as realtime", () => {
    const rows = [result({
      id: "2026-08-01-uk-tfl-2026-08-01T08:37:00-0",
      realtime: true,
    })];
    expect(classifyTimetable(snapshot("https://api.tfl.gov.uk", rows), "2026-08-01")).toBe("realtime");
  });

  it("classifies a realtime row copied to another date as stale_realtime", () => {
    const rows = [result({
      id: "2026-08-02-uk-tfl-2026-08-01T08:37:00-0",
      date: "2026-08-02",
      realtime: true,
    })];
    expect(classifyTimetable(snapshot("https://api.tfl.gov.uk", rows), "2026-08-02")).toBe("stale_realtime");
  });

  it("recognizes the space-separated timestamp used by the MTR live adapter", () => {
    const rows = [result({
      id: "hk-TWL-ADM-2026-08-01 15:25:04-1",
      realtime: true,
    })];

    expect(classifyTimetable(snapshot("https://www.mtr.com.hk/nexttrain", rows), "2026-08-01", {
      realtimeTodayOnly: true,
      today: "2026-08-01",
    })).toBe("realtime");
  });

  it("does not let a curated fallback label hide a current live row", () => {
    const rows = [result({
      id: "hk-TWL-ADM-2026-08-01 15:25:04-1",
      realtime: true,
    })];
    const fallback = snapshot("MTR curated snapshot fallback", rows);

    expect(classifyTimetable(fallback, "2026-08-01", {
      realtimeTodayOnly: true,
      today: "2026-08-01",
    })).toBe("realtime");
    expect(classifyTimetable({
      ...fallback,
      results: rows.map((row) => ({ ...row, date: "2026-08-02" })),
    }, "2026-08-02", {
      realtimeTodayOnly: true,
      today: "2026-08-01",
    })).toBe("stale_realtime");
  });

  it("does not treat LLM advisory data as a verified timetable", () => {
    const rows = [
      result({ id: "llm-0", departureTime: "08:00" }),
      result({ id: "llm-1", departureTime: "08:17" }),
    ];
    expect(classifyTimetable(snapshot("llm-advisory", rows), "2026-08-01")).toBe("indicative");
  });

  it("honors a row-level LLM provenance marker even when the source looks official", () => {
    const rows = [
      result({ id: "official-llm-0", provenance: "llm-advisory" }),
      result({ id: "official-llm-1", provenance: "llm-advisory", departureTime: "08:17" }),
    ];
    expect(classifyTimetable(snapshot("official timetable", rows), "2026-08-01")).toBe("indicative");
  });

  it("does not promote a route-level LLM marker when rows are marked realtime", () => {
    const rows = [result({
      id: "2026-08-01-llm-2026-08-01T08:37:00-0",
      realtime: true,
    })];
    expect(classifyTimetable({ ...snapshot("official API", rows), provenance: "llm-advisory" }, "2026-08-01"))
      .toBe("indicative");
  });
});
