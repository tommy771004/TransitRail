import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { createKorailTimetableSource, korailResults, korailWeekdays, parseKorailEditions, parseKorailWorkbook, selectKorailEdition, withKnownKorailEditions, type KorailDocument } from "./korailTimetable";
import { buildSourceMeta } from "../../src/data/sourceRegistry";
import { findInRoutes, type ScrapedRouteData } from "../../src/data/scraped/timetableDay";
import { committedKorailDocuments, KorailTimetableScraper } from "../scrapers/korailTimetable";
import { getProviderRouteLines } from "../../src/data/providerRouteLines";

const bytes = (family: string, effective = "2026-09-01") => readFileSync(new URL(`./fixtures/korail-${family}-${effective}.xlsx`, import.meta.url));
const names = new Map<string, string>();
const ktx = parseKorailWorkbook(bytes("ktx"), "ktx", names);
const exclusions: string[] = [];
const regular = parseKorailWorkbook(bytes("regular"), "regular", names, (message) => exclusions.push(message));
const document: KorailDocument = { family: "ktx", title: "KTX", url: "https://www.korail.com/example.xlsx", effectiveFrom: "2026-09-01", retrievedAt: "2026-09-09T00:00:00Z", sha256: "fixture", runs: ktx, exclusions: [] };
const route = (results: ScrapedRouteData["results"]): ScrapedRouteData => ({ origin: results[0].origin, destination: results[0].destination, date: "2026-09-09", scrapedAt: document.retrievedAt, source: "Korail", sourceMeta: buildSourceMeta({ sourceId: "kr-korail-timetable-xlsx", fetchedAt: document.retrievedAt }), results });
const board = (month = 9) => ({ strResult: "SUCC", totcnt: 2, boardList: [
  { bdCode: "_ticketTable02", bdTitle: `KTX 시간표(2026. ${month}. 1. 기준)`, fileId: [`jfile/ktx-${month}.xlsx`] },
  { bdCode: "_ticketTable02", bdTitle: `일반열차 시간표(2026. ${month}. 1. 기준)`, fileId: [`jfile/regular-${month}.xlsx`] },
] });

describe("Korail operator XLSX", () => {
  it("reads both complete workbooks, excluding examples and the contradictory regular train", () => {
    expect(ktx).toHaveLength(621);
    expect(regular).toHaveLength(456);
    expect(exclusions).toEqual(["Korail excluded 서해선 1237: stop outside published start/end span"]);
    expect(regular.some((run) => run.line === "서해선" && run.trainNumber === "1237")).toBe(false);
    expect(new Set([...ktx, ...regular].flatMap((run) => run.stops.map((stop) => stop.name))).size).toBe(255);
  });

  it("retains independently published directions and explicit intermediate times", () => {
    const rows = korailResults(document, "2026-09-09");
    expect(rows.find((r) => r.service === "KTX 1")).toMatchObject({ origin: "Seoul", destination: "Busan", departureTime: "05:13", arrivalTime: "07:50" });
    expect(rows.find((r) => r.service === "KTX 2")).toMatchObject({ origin: "Busan", destination: "Seoul", departureTime: "05:09", arrivalTime: "07:53" });
    const one = route([rows.find((r) => r.service === "KTX 1")!]);
    expect(findInRoutes([one], "Daejeon", "Ulsan", "2026-09-09", "korea")?.[0]).toMatchObject({ departureTime: "06:14", arrivalTime: "07:29" });
    expect(findInRoutes([one], "Busan", "Seoul", "2026-09-09", "korea")).toBeNull();
    expect(findInRoutes([one], "Seoul", "Busan", "2026-09-10", "korea")).toBeNull();
  });

  it("uses operating weekdays rather than cloning every train onto every date", () => {
    expect(korailResults(document, "2026-09-09").some((r) => r.service === "KTX 181")).toBe(false);
    expect(korailResults(document, "2026-09-11").some((r) => r.service === "KTX 181")).toBe(true);
    expect(korailWeekdays(undefined, true)).toHaveLength(7);
    expect(() => korailWeekdays(undefined)).toThrow();
    expect(() => korailWeekdays("공휴일")).toThrow();
  });

  it("assigns post-midnight boarding to the next date while preserving through journeys", () => {
    const only81 = { ...document, runs: ktx.filter((run) => run.trainNumber === "81") };
    const today = route(korailResults(only81, "2026-09-09"));
    expect(findInRoutes([today], "Seoul", "Busan", "2026-09-09", "korea")?.[0]).toMatchObject({ departureTime: "21:58", arrivalTime: "24:43" });
    expect(findInRoutes([today], "Ulsan", "Busan", "2026-09-09", "korea")).toBeNull();
    const next = route(korailResults(only81, "2026-09-09", "2026-09-10"));
    expect(findInRoutes([next], "Ulsan", "Busan", "2026-09-10", "korea")?.[0]).toMatchObject({ departureTime: "00:22", arrivalTime: "00:43" });
  });

  it("resolves published edition boundaries, rejects incomplete boards and uncovered dates", () => {
    const editions = parseKorailEditions({ ...board(), totcnt: 4, boardList: [...board().boardList, ...board(10).boardList] });
    expect(selectKorailEdition(editions, "ktx", "2026-09-30").effectiveUntil).toBe("2026-09-30");
    expect(selectKorailEdition(editions, "ktx", "2026-10-01").effectiveFrom).toBe("2026-10-01");
    expect(() => selectKorailEdition(editions, "ktx", "2026-08-31")).toThrow();
    expect(() => parseKorailEditions({ ...board(), totcnt: 3 })).toThrow();
    expect(() => korailResults(document, "2026-08-31")).toThrow();
  });

  it("excludes a KTX train whose published times run backwards, and keeps the rest", () => {
    // 10/1 호남선 row 61: up train 450 (광주송정 20:50 → 용산 22:54) typed into the down block.
    const excluded: string[] = [];
    const october = parseKorailWorkbook(bytes("ktx", "2026-10-01"), "ktx", new Map(), (message) => excluded.push(message));
    expect(excluded).toEqual(["Korail excluded 호남선 450: times run backwards at Gwangmyeong"]);
    expect(october).toHaveLength(620);
    expect(october.some((run) => run.line === "호남선" && run.trainNumber === "450")).toBe(false);
    expect(october.some((run) => run.line === "호남선" && run.trainNumber === "474")).toBe(true);
  });

  it("fails closed on an unrecognized workbook layout", () => {
    const archive = unzipSync(bytes("ktx"));
    archive["xl/sharedStrings.xml"] = strToU8(strFromU8(archive["xl/sharedStrings.xml"]).replaceAll("열차번호", "changed-layout"));
    expect(() => parseKorailWorkbook(zipSync(archive), "ktx")).toThrow("Expected both KTX directions");
  });

  it("keeps a verified edition in force after Korail replaces its board post", async () => {
    // Live board, 2026-09-23: the 9/18 KTX post was edited into the 10/1 edition.
    const live = { strResult: "SUCC", totcnt: 3, boardList: [
      { bdCode: "_ticketTable02", bdTitle: "KTX 시간표(2026. 10. 1. 기준)", fileId: ["jfile/ktx-10.xlsx"] },
      { bdCode: "_ticketTable02", bdTitle: "일반열차 시간표(2026. 9. 1. 기준)", fileId: ["jfile/regular-9.xlsx"] },
      { bdCode: "_ticketTable02", bdTitle: "KTX 시간표(2026. 5. 15. 기준)", fileId: ["jfile/ktx-5.xlsx"] },
    ] };
    const root = "https://www.korail.com/file/cubedata/COMMON/jfile/";
    const verified = { title: "KTX 시간표(2026. 9. 18. 기준)", url: `${root}ktx-9.xlsx`, sha256: "cf69ea35e0b6ad9fb82c0e0b44f60833e34eadab55ea610eaf6784622351e9d0" };
    const board = parseKorailEditions(live);
    expect(selectKorailEdition(board, "ktx", "2026-09-23").effectiveFrom).toBe("2026-05-15");

    const editions = withKnownKorailEditions(board, [
      verified, verified,
      { ...verified, title: "KTX 시간표(2026. 10. 1. 기준)", url: `${root}ktx-10-old.xlsx` },
      { ...verified, title: "KTX 시간표(2026. 9. 20. 기준)", url: "https://example.com/ktx.xlsx" },
    ]);
    expect(selectKorailEdition(editions, "ktx", "2026-09-17")).toMatchObject({ effectiveFrom: "2026-05-15", effectiveUntil: "2026-09-17" });
    expect(selectKorailEdition(editions, "ktx", "2026-09-30")).toMatchObject({ url: verified.url, effectiveUntil: "2026-09-30" });
    expect(selectKorailEdition(editions, "ktx", "2026-10-01").url).toBe(`${root}ktx-10.xlsx`);

    const fetcher = vi.fn(async (url: string | URL | Request) => new Response(String(url).includes("userBoard")
      ? JSON.stringify(live) : bytes(String(url).includes("ktx-") ? "ktx" : "regular")));
    const [ktxDocument] = await createKorailTimetableSource(fetcher as typeof fetch, [verified]).load("2026-09-23");
    expect(ktxDocument).toMatchObject({ title: verified.title, sha256: verified.sha256 });
    await expect(createKorailTimetableSource(fetcher as typeof fetch, [{ ...verified, sha256: "0".repeat(64) }]).load("2026-09-23"))
      .rejects.toThrow("no longer serves the verified KTX 시간표(2026. 9. 18. 기준)");
  });

  it("reads the documents committed Korea snapshots were verified against", () => {
    const dir = mkdtempSync(join(tmpdir(), "korail-"));
    const sourceDocument = { title: "KTX 시간표(2026. 9. 18. 기준)", url: "https://www.korail.com/file/cubedata/COMMON/jfile/x.xlsx", sha256: "a".repeat(64), retrievedAt: "2026-09-22T00:00:00Z", effectiveFrom: "2026-09-18" };
    writeFileSync(join(dir, "seoul-busan.json"), JSON.stringify({ sourceDocuments: [sourceDocument] }));
    writeFileSync(join(dir, "subway.json"), JSON.stringify({ results: [] }));
    writeFileSync(join(dir, "broken.json"), "{");
    expect(committedKorailDocuments(dir)).toEqual([sourceDocument]);
    expect(committedKorailDocuments(join(dir, "missing"))).toEqual([]);
  });

  it("downloads the board and each edition once for a multi-date scrape", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => new Response(String(url).includes("userBoard") ? JSON.stringify(board()) : bytes(String(url).includes("ktx-") ? "ktx" : "regular")));
    const source = createKorailTimetableSource(fetcher as typeof fetch);
    const first = await source.load("2026-09-09");
    await source.load("2026-09-10");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(first[1].exclusions).toEqual(exclusions);
    expect(first[0].sha256).toBe("cf69ea35e0b6ad9fb82c0e0b44f60833e34eadab55ea610eaf6784622351e9d0");
  });

  it("never writes a date when either required document download fails", async () => {
    const source = { load: vi.fn().mockResolvedValueOnce([document]).mockRejectedValueOnce(new Error("offline")) };
    const scraper = new KorailTimetableScraper(source);
    const save = vi.fn();
    (scraper as unknown as { saveRoute: typeof save }).saveRoute = save;
    await expect(scraper.runAll("2026-09-09")).rejects.toThrow("offline");
    expect(save).not.toHaveBeenCalled();
  });

  it("offers all timed Korail stations in official corridor groups", () => {
    const rows = [...korailResults(document, "2026-09-11"), ...korailResults({ ...document, family: "regular", runs: regular }, "2026-09-11")];
    const lines = getProviderRouteLines("korea", [route(rows)], "2026-09-11");
    expect(lines).toHaveLength(19);
    expect(lines.flatMap((line) => line.stations).some((station) => station.name === "Busan")).toBe(true);
    expect(getProviderRouteLines("korea", [route(rows)], "2026-08-31")).toEqual([]);
  });
});
