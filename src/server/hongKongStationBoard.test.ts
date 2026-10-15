import { afterEach, describe, expect, it, vi } from "vitest";
import { hongKongStationBoard, mtrStationLines } from "./hongKongMtr";

const train = (dest: string, plat: string, time: string, valid = "Y") => ({ dest, plat, time: `2026-10-15 ${time}`, valid });

function stubFeed(byLine: Record<string, unknown | Error>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const line = new URL(url).searchParams.get("line") || "";
    const body = byLine[line];
    if (body instanceof Error) throw body;
    return { ok: true, json: async () => body } as Response;
  }));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("Hong Kong station board", () => {
  it("finds every line through an interchange", () => {
    expect(mtrStationLines("Central").map(({ line }) => line.code).sort()).toEqual(["ISL", "TWL"]);
    expect(mtrStationLines("Nowhere")).toEqual([]);
  });

  it("groups each line's trains by direction and terminus", async () => {
    stubFeed({
      TWL: { status: 1, isdelay: "N", data: { "TWL-CEN": { UP: [train("TSW", "2", "14:05:00"), train("TSW", "1", "14:02:00")] } } },
      ISL: {
        status: 1,
        isdelay: "Y",
        data: { "ISL-CEN": {
          UP: [train("CHW", "2", "14:03:00"), train("CHW", "2", "14:09:00", "N")],
          DOWN: [train("KET", "1", "14:04:00")],
        } },
      },
    });

    const board = await hongKongStationBoard("Central");
    expect(board?.station).toBe("Central");
    const twl = board?.lines.find((line) => line.code === "TWL");
    expect(twl).toMatchObject({ delayed: false, unavailable: false });
    // Central is the terminus: trains alternate platforms, and stay one row.
    expect(twl?.groups).toEqual([{
      direction: "UP", destination: "Tsuen Wan",
      departures: [
        { at: "2026-10-15T14:02:00+08:00", platform: "1" },
        { at: "2026-10-15T14:05:00+08:00", platform: "2" },
      ],
    }]);
    const isl = board?.lines.find((line) => line.code === "ISL");
    expect(isl?.delayed).toBe(true);
    expect(isl?.groups.map((group) => [group.destination, group.departures.length])).toEqual([["Chai Wan", 1], ["Kennedy Town", 1]]);
  });

  it("marks a failing line unavailable and keeps the others", async () => {
    stubFeed({
      TWL: new Error("timeout"),
      ISL: { status: 1, data: { "ISL-CEN": { DOWN: [train("KET", "1", "14:04:00")] } } },
    });
    const board = await hongKongStationBoard("Central");
    expect(board?.lines.find((line) => line.code === "TWL")).toMatchObject({ unavailable: true, groups: [] });
    expect(board?.lines.find((line) => line.code === "ISL")?.groups).toHaveLength(1);
  });

  it("treats an MTR service alert as no live data, not as no trains", async () => {
    stubFeed({ TWL: { status: 0, message: "Special arrangement" }, ISL: { status: 0 } });
    const board = await hongKongStationBoard("Central");
    expect(board?.lines.every((line) => line.unavailable)).toBe(true);
  });

  it("returns nothing for a station outside the live feed", async () => {
    expect(await hongKongStationBoard("Nowhere")).toBeNull();
  });
});
