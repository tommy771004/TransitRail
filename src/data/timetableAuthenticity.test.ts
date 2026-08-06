import { describe, expect, it } from "vitest";
import type { TransitResult } from "../types";
import {
  classifyTimetable,
  isSyntheticTimetable,
  normalizeTimetableSource,
  parseClockMinutes,
  type TimetableSnapshot,
} from "./timetableAuthenticity";
import { buildSourceMeta, type OfficialSourceId } from "./sourceRegistry";

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

/** A route as the pipeline writes it: rows plus the source block that vouches for them. */
function snapshot(
  sourceId: OfficialSourceId,
  results: TransitResult[],
): TimetableSnapshot {
  const sourceMeta = buildSourceMeta({ sourceId, fetchedAt: "2026-08-01T08:00:00.000Z" });
  return {
    origin: "Origin",
    destination: "Destination",
    date: "2026-08-01",
    scrapedAt: "2026-08-01T08:00:00.000Z",
    source: sourceMeta.sourceName,
    sourceMeta,
    provenance: "official",
    results,
  };
}

/** A route carrying a label but no registered source — a legacy or hand-made file. */
function unregisteredSnapshot(source: string, results: TransitResult[]): TimetableSnapshot {
  return {
    origin: "Origin",
    destination: "Destination",
    date: "2026-08-01",
    scrapedAt: "2026-08-01T08:00:00.000Z",
    source,
    results,
  };
}

describe("a registered source is the only route to verified", () => {
  it("accepts rows whose source block matches the register", () => {
    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", [result()]),
      "2026-08-01",
    )).toMatchObject({
      provenance: "official",
      serviceDay: "2026-08-01",
      sourceServiceDay: "2026-08-01",
      authenticity: "scraped",
      truthMode: "verified",
      issue: undefined,
    });
  });

  it("rejects a route that only claims to be official", () => {
    expect(normalizeTimetableSource({
      ...unregisteredSnapshot("official timetable", [result()]),
      provenance: "official",
    }, "2026-08-01")).toMatchObject({
      provenance: "unknown",
      authenticity: "none",
      truthMode: "unusable",
      issue: "unknown_provenance",
    });
  });

  it("rejects an official-sounding source label with no source block", () => {
    for (const label of ["ODPT timetable", "https://api.tfl.gov.uk", "mystery provider"]) {
      expect(normalizeTimetableSource(
        unregisteredSnapshot(label, [result()]),
        "2026-08-01",
      )).toMatchObject({ provenance: "unknown", truthMode: "unusable", issue: "unknown_provenance" });
    }
  });

  it("rejects a source block that was edited away from the register", () => {
    const route = snapshot("jp-odpt-toei", [result()]);
    expect(normalizeTimetableSource({
      ...route,
      sourceMeta: { ...route.sourceMeta!, sourceUrl: "https://timetable.example.invalid" },
    }, "2026-08-01")).toMatchObject({ truthMode: "unusable", issue: "malformed" });
  });
});

describe("retired curated and AI-advisory data", () => {
  it("refuses a curated route outright rather than showing it as indicative", () => {
    expect(normalizeTimetableSource({
      ...unregisteredSnapshot("operator curated snapshot", [result()]),
      provenance: "curated",
    }, "2026-08-01")).toMatchObject({
      provenance: "curated",
      authenticity: "none",
      truthMode: "unusable",
      issue: "unverified_source",
    });
  });

  it("refuses an AI-advisory route outright", () => {
    expect(normalizeTimetableSource({
      ...unregisteredSnapshot("llm-advisory", [result({ provenance: "llm-advisory" })]),
      provenance: "llm-advisory",
    }, "2026-08-01")).toMatchObject({
      provenance: "llm-advisory",
      authenticity: "none",
      truthMode: "unusable",
    });
  });

  it("cannot be laundered by bolting a valid source block onto a curated file", () => {
    const route = snapshot("jp-odpt-toei", [result()]);
    expect(normalizeTimetableSource(
      { ...route, provenance: "curated" },
      "2026-08-01",
    )).toMatchObject({ provenance: "curated", authenticity: "none", truthMode: "unusable" });
  });

  it("refuses a route with a single curated row among registered ones", () => {
    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", [result(), result({ id: "curated-1", provenance: "curated" })]),
      "2026-08-01",
    )).toMatchObject({ truthMode: "unusable" });
  });
});

describe("service days", () => {
  it("never answers one service day with rows stored for another", () => {
    expect(normalizeTimetableSource(snapshot("jp-odpt-toei", [result()]), "2026-08-02"))
      .toMatchObject({ truthMode: "unusable", issue: "service_day_mismatch" });
  });

  it("does not accept a dateless canonical day as an answer for a requested day", () => {
    const canonicalRows = [
      result({ id: "canonical-0", date: undefined, departureTime: "08:00" }),
      result({ id: "canonical-1", date: undefined, departureTime: "08:17" }),
    ];

    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", canonicalRows),
      "2026-08-02",
    )).toMatchObject({
      authenticity: "none",
      truthMode: "unusable",
      issue: "service_day_mismatch",
    });
  });

  it("distinguishes an empty source from a service-day mismatch", () => {
    expect(normalizeTimetableSource(snapshot("jp-odpt-toei", []), "2026-08-01"))
      .toMatchObject({ truthMode: "unusable", issue: "empty" });
  });

  it("scopes a rejected row to the day it belongs to", () => {
    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", [
        result({ id: "official-today", date: "2026-08-01" }),
        result({ id: "curated-other-day", date: "2026-08-02", provenance: "curated" }),
      ]),
      "2026-08-01",
    )).toMatchObject({ provenance: "official", truthMode: "verified", authenticity: "scraped" });
  });
});

describe("live sources", () => {
  it("describes a current live source as verified", () => {
    const live = result({ id: "2026-08-01-uk-tfl-2026-08-01T08:37:00-0", country: "united_kingdom", realtime: true });
    expect(normalizeTimetableSource(
      snapshot("uk-tfl-journey-planner", [live]),
      "2026-08-01",
    )).toMatchObject({
      provenance: "official",
      sourceServiceDay: "2026-08-01",
      authenticity: "realtime",
      truthMode: "verified",
    });
  });

  it("accepts a current live source whose provider id carries no date", () => {
    const live = result({ id: "hk-TWL-ADM-08:37:00-0", country: "hong_kong", realtime: true });
    expect(normalizeTimetableSource(
      snapshot("hk-mtr-next-train", [live]),
      "2026-08-01",
      { realtimeTodayOnly: true, today: "2026-08-01" },
    )).toMatchObject({ authenticity: "realtime", truthMode: "verified" });
  });

  it("describes a live row copied onto another date as stale", () => {
    const copied = result({
      id: "2026-08-02-uk-tfl-2026-08-01T08:37:00-0",
      country: "united_kingdom",
      date: "2026-08-02",
      realtime: true,
    });
    expect(normalizeTimetableSource(
      snapshot("uk-tfl-journey-planner", [copied]),
      "2026-08-02",
    )).toMatchObject({
      authenticity: "stale_realtime",
      truthMode: "stale",
      issue: "stale_realtime",
    });
  });

  it("recognizes the space-separated timestamp the MTR adapter emits", () => {
    const rows = [result({ id: "hk-TWL-ADM-2026-08-01 15:25:04-1", country: "hong_kong", realtime: true })];
    expect(classifyTimetable(snapshot("hk-mtr-next-train", rows), "2026-08-01", {
      realtimeTodayOnly: true,
      today: "2026-08-01",
    })).toBe("realtime");
  });
});

describe("structural validation fails closed", () => {
  it.each([
    ["a non-array results field", { results: "not-an-array" }],
    ["a row missing required fields", { results: [{ id: "missing", date: "2026-08-01" }] }],
  ])("rejects %s", (_label, override) => {
    expect(normalizeTimetableSource({
      ...snapshot("jp-odpt-toei", [result()]),
      ...override,
    } as unknown as TimetableSnapshot, "2026-08-01")).toMatchObject({
      provenance: "unknown",
      authenticity: "none",
      truthMode: "unusable",
      issue: "malformed",
    });
  });

  it("rejects a requested service day that is not a calendar date", () => {
    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", [result()]),
      "2026-02-30",
    )).toMatchObject({ serviceDay: "2026-02-30", truthMode: "unusable", issue: "malformed" });
  });

  it.each([
    ["an impossible row date and time", { date: "2026-02-30", departureTime: "not-a-time" }],
    ["an unknown country", { country: "atlantis" as TransitResult["country"] }],
    ["a non-array legs value", { direct: false, legs: {} as TransitResult["legs"] }],
    ["an impossible leg time", {
      direct: false,
      legs: [{ lineName: "Line A", origin: "Origin", destination: "Destination", departureTime: "99:99" }],
    }],
    ["an impossible leg delay and upcoming time", {
      direct: false,
      legs: [{
        lineName: "Line A",
        origin: "Origin",
        destination: "Destination",
        delayMinutes: "late" as unknown as number,
        upcomingDepartures: ["not-a-time"],
      }],
    }],
  ])("rejects %s", (_label, override) => {
    expect(normalizeTimetableSource(
      snapshot("jp-odpt-toei", [result(override)]),
      "2026-08-01",
    )).toMatchObject({ truthMode: "unusable", issue: "malformed" });
  });

  it("rejects a provider row from the wrong country when the adapter supplies context", () => {
    expect(normalizeTimetableSource(
      snapshot("uk-tfl-journey-planner", [result({ country: "japan" })]),
      "2026-08-01",
      { expectedCountry: "united_kingdom" },
    )).toMatchObject({ truthMode: "unusable", issue: "malformed" });
  });

  it("rejects an unparseable scrape timestamp", () => {
    expect(normalizeTimetableSource({
      ...snapshot("jp-odpt-toei", [result()]),
      scrapedAt: "not-a-timestamp",
    }, "2026-08-01")).toMatchObject({ truthMode: "unusable", issue: "malformed" });
  });
});

describe("synthetic timetable detection", () => {
  const fixedHeadway = [0, 10, 20, 30].map((offset, index) =>
    result({ id: `row-${index}`, departureTime: `08:${String(offset).padStart(2, "0")}` }),
  );
  const mixedHeadway = ["08:00", "08:10", "08:25", "08:35"].map((departureTime, index) =>
    result({ id: `mixed-${index}`, departureTime }),
  );

  it("flags an unvarying headway and an explicit curated label", () => {
    expect(isSyntheticTimetable("official", fixedHeadway)).toBe(true);
    expect(isSyntheticTimetable("official snapshot", mixedHeadway)).toBe(true);
    expect(isSyntheticTimetable("official", mixedHeadway)).toBe(false);
  });

  it("flags a row carrying a retired provenance marker", () => {
    expect(isSyntheticTimetable("official", [result({ provenance: "curated" })])).toBe(true);
    expect(isSyntheticTimetable("official", [result({ provenance: "llm-advisory" })])).toBe(true);
  });

  it("needs four departures before an even spacing means anything", () => {
    expect(isSyntheticTimetable("official", fixedHeadway.slice(0, 3))).toBe(false);
  });

  it("is a validation detector, not a classifier — it never downgrades a registered source", () => {
    // A real next-train feed can legitimately return four trains four minutes
    // apart. Wiring the detector into classification would delete that live
    // answer, so classification stays on the register alone.
    expect(classifyTimetable(snapshot("jp-odpt-toei", fixedHeadway), "2026-08-01")).toBe("scraped");
  });
});

describe("classification helpers", () => {
  it("classifies an empty date slice as none", () => {
    expect(classifyTimetable(snapshot("jp-odpt-toei", [result()]), "2026-08-02")).toBe("none");
  });

  it("parses only clock values", () => {
    expect(parseClockMinutes("06:05")).toBe(365);
    expect(parseClockMinutes("25:05")).toBe(1505);
    expect(parseClockMinutes("not-a-time")).toBeUndefined();
  });
});
