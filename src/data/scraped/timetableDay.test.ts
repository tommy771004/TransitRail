import { describe, expect, it } from "vitest";
import type { TransitResult } from "../../types";
import {
  canonicalDay,
  findInRoutes,
  normalizeHeadsigns,
  normalizeResults,
  normalizeTransferLegTimes,
  type ScrapedRouteData,
} from "./timetableDay";

function trip(partial: Partial<TransitResult> & Pick<TransitResult, "id" | "date" | "departureTime">): TransitResult {
  return {
    country: "japan",
    operator: "JR",
    service: "Hikari",
    origin: "Tokyo",
    destination: "Kyoto",
    arrivalTime: "11:16",
    direct: true,
    stops: ["Tokyo", "Kyoto"],
    ...partial,
  };
}

function route(results: TransitResult[], origin = "Tokyo", destination = "Kyoto"): ScrapedRouteData {
  return {
    origin,
    destination,
    date: "2026-07-10..2026-07-12",
    scrapedAt: "2026-07-10T00:00:00.000Z",
    source: "test fixture",
    results,
  };
}

describe("findInRoutes — day slice + exact match", () => {
  it("returns only departures for the requested date on an exact origin→destination route", () => {
    const routes = [
      route([
        trip({ id: "2026-07-10-hikari-1", date: "2026-07-10", departureTime: "08:00", arrivalTime: "10:16" }),
        trip({ id: "2026-07-11-hikari-1", date: "2026-07-11", departureTime: "08:00", arrivalTime: "10:16" }),
        trip({ id: "2026-07-10-hikari-2", date: "2026-07-10", departureTime: "12:00", arrivalTime: "14:16" }),
      ]),
    ];

    const found = findInRoutes(routes, "Tokyo", "Kyoto", "2026-07-10");

    expect(found?.map((r) => r.id)).toEqual([
      "2026-07-10-hikari-1",
      "2026-07-10-hikari-2",
    ]);
  });
});

describe("canonicalDay — collapse multi-date copies", () => {
  it("keeps one dateless departure per base id when the same timetable is stored for many dates", () => {
    const multiDate = [
      trip({ id: "2026-07-10-hikari-1", date: "2026-07-10", departureTime: "08:00" }),
      trip({ id: "2026-07-11-hikari-1", date: "2026-07-11", departureTime: "08:00" }),
      trip({ id: "2026-07-12-hikari-1", date: "2026-07-12", departureTime: "08:00" }),
      trip({ id: "2026-07-10-hikari-2", date: "2026-07-10", departureTime: "12:00", arrivalTime: "14:16" }),
      trip({ id: "2026-07-11-hikari-2", date: "2026-07-11", departureTime: "12:00", arrivalTime: "14:16" }),
    ];

    const day = canonicalDay(multiDate);

    expect(day).toHaveLength(2);
    expect(day.map((r) => r.id).sort()).toEqual(["hikari-1", "hikari-2"]);
    expect(day.every((r) => r.date === undefined)).toBe(true);
  });
});

describe("findInRoutes — result-level destination match", () => {
  it("matches file origin plus result-level destination when the file destination differs", () => {
    // Mixed-destination file: file says Tokyo→Osaka, but one result goes Tokyo→Kyoto.
    const routes = [
      route(
        [
          trip({
            id: "2026-07-10-to-osaka",
            date: "2026-07-10",
            origin: "Tokyo",
            destination: "Osaka",
            departureTime: "07:00",
            arrivalTime: "09:30",
            stops: ["Tokyo", "Osaka"],
          }),
          trip({
            id: "2026-07-10-to-kyoto",
            date: "2026-07-10",
            origin: "Tokyo",
            destination: "Kyoto",
            departureTime: "08:00",
            arrivalTime: "10:16",
            stops: ["Tokyo", "Kyoto"],
          }),
          trip({
            id: "2026-07-11-to-kyoto",
            date: "2026-07-11",
            origin: "Tokyo",
            destination: "Kyoto",
            departureTime: "08:00",
            arrivalTime: "10:16",
            stops: ["Tokyo", "Kyoto"],
          }),
        ],
        "Tokyo",
        "Osaka",
      ),
    ];

    const found = findInRoutes(routes, "Tokyo", "Kyoto", "2026-07-10");

    expect(found?.map((r) => r.id)).toEqual(["2026-07-10-to-kyoto"]);
  });
});

describe("findInRoutes — reverse match", () => {
  it("returns the reverse of a stored route and clears platform and headsign", () => {
    const routes = [
      route([
        trip({
          id: "2026-07-10-hikari-1",
          date: "2026-07-10",
          departureTime: "08:00",
          arrivalTime: "10:16",
          platform: "14",
          headsign: "Shin-Osaka",
        }),
      ]),
    ];

    const found = findInRoutes(routes, "Kyoto", "Tokyo", "2026-07-10");

    expect(found).toHaveLength(1);
    expect(found![0].origin).toBe("Kyoto");
    expect(found![0].destination).toBe("Tokyo");
    expect(found![0].stops).toEqual(["Kyoto", "Tokyo"]);
    expect(found![0].platform).toBeUndefined();
    expect(found![0].headsign).toBeUndefined();
    expect(found![0].id).toBe("rev-2026-07-10-hikari-1");
  });

  it("rebuilds multi-leg reverse times from durations and transfer waits", () => {
    // Forward: Tokyo 08:00 → Nagoya 09:40, wait 10, Nagoya 09:50 → Kyoto 10:40
    const routes = [
      route([
        trip({
          id: "2026-07-10-via-nagoya",
          date: "2026-07-10",
          origin: "Tokyo",
          destination: "Kyoto",
          departureTime: "08:00",
          arrivalTime: "10:40",
          durationMinutes: 160,
          direct: false,
          stops: ["Tokyo", "Nagoya", "Kyoto"],
          transferStations: ["Nagoya"],
          platform: "14",
          headsign: "Kyoto",
          legs: [
            {
              lineName: "Hikari",
              origin: "Tokyo",
              destination: "Nagoya",
              departureTime: "08:00",
              arrivalTime: "09:40",
              durationMinutes: 100,
              platform: "14",
              headsign: "Hakata",
            },
            {
              lineName: "Hikari",
              origin: "Nagoya",
              destination: "Kyoto",
              departureTime: "09:50",
              arrivalTime: "10:40",
              durationMinutes: 50,
              platform: "3",
              headsign: "Kyoto",
            },
          ],
        }),
      ]),
    ];

    const found = findInRoutes(routes, "Kyoto", "Tokyo", "2026-07-10");

    expect(found).toHaveLength(1);
    const rev = found![0];
    expect(rev.origin).toBe("Kyoto");
    expect(rev.destination).toBe("Tokyo");
    expect(rev.stops).toEqual(["Kyoto", "Nagoya", "Tokyo"]);
    expect(rev.transferStations).toEqual(["Nagoya"]);
    expect(rev.platform).toBeUndefined();
    expect(rev.headsign).toBeUndefined();
    // Reverse keeps top departure clock and rebuilds legs from durations + waits:
    // leg Kyoto→Nagoya 50m from 08:00 → 08:50; wait 10; Nagoya→Tokyo 100m → 10:40
    expect(rev.legs).toHaveLength(2);
    expect(rev.legs![0]).toMatchObject({
      origin: "Kyoto",
      destination: "Nagoya",
      departureTime: "08:00",
      arrivalTime: "08:50",
      durationMinutes: 50,
    });
    expect(rev.legs![0].platform).toBeUndefined();
    expect(rev.legs![0].headsign).toBeUndefined();
    expect(rev.legs![1]).toMatchObject({
      origin: "Nagoya",
      destination: "Tokyo",
      departureTime: "09:00",
      arrivalTime: "10:40",
      durationMinutes: 100,
    });
  });
});

describe("findInRoutes — transfer chain", () => {
  it("chains two route edges and keeps only connections with wait between 2 and 120 minutes", () => {
    const routes = [
      route(
        [
          trip({
            id: "2026-07-10-leg1",
            date: "2026-07-10",
            origin: "Tokyo",
            destination: "Nagoya",
            departureTime: "08:00",
            arrivalTime: "09:40",
            durationMinutes: 100,
            stops: ["Tokyo", "Nagoya"],
          }),
        ],
        "Tokyo",
        "Nagoya",
      ),
      route(
        [
          // wait from 09:40 = 1 min — too short
          trip({
            id: "2026-07-10-too-tight",
            date: "2026-07-10",
            origin: "Nagoya",
            destination: "Kyoto",
            departureTime: "09:41",
            arrivalTime: "10:30",
            durationMinutes: 49,
            stops: ["Nagoya", "Kyoto"],
          }),
          // wait = 10 min — keep
          trip({
            id: "2026-07-10-ok",
            date: "2026-07-10",
            origin: "Nagoya",
            destination: "Kyoto",
            departureTime: "09:50",
            arrivalTime: "10:40",
            durationMinutes: 50,
            stops: ["Nagoya", "Kyoto"],
          }),
          // wait = 140 min — too long
          trip({
            id: "2026-07-10-too-long",
            date: "2026-07-10",
            origin: "Nagoya",
            destination: "Kyoto",
            departureTime: "12:00",
            arrivalTime: "12:50",
            durationMinutes: 50,
            stops: ["Nagoya", "Kyoto"],
          }),
        ],
        "Nagoya",
        "Kyoto",
      ),
    ];

    const found = findInRoutes(routes, "Tokyo", "Kyoto", "2026-07-10", "japan");

    expect(found).toHaveLength(1);
    const chain = found![0];
    expect(chain.direct).toBe(false);
    expect(chain.id).toBe("chain-japan-0");
    expect(chain.country).toBe("japan");
    expect(chain.origin).toBe("Tokyo");
    expect(chain.destination).toBe("Kyoto");
    expect(chain.departureTime).toBe("08:00");
    expect(chain.arrivalTime).toBe("10:40");
    expect(chain.transferStations).toEqual(["Nagoya"]);
    expect(chain.durationMinutes).toBe(160);
    expect(chain.legs).toHaveLength(2);
    expect(chain.legs![0]).toMatchObject({
      origin: "Tokyo",
      destination: "Nagoya",
      departureTime: "08:00",
      arrivalTime: "09:40",
    });
    expect(chain.legs![1]).toMatchObject({
      origin: "Nagoya",
      destination: "Kyoto",
      departureTime: "09:50",
      arrivalTime: "10:40",
    });
  });

  it("counts overnight transfer waits when the second leg departs after midnight", () => {
    // Arrive Nagoya 23:50; 00:20 next day is a 30-minute wait (still within 2–120).
    const routes = [
      route(
        [
          trip({
            id: "2026-07-10-late1",
            date: "2026-07-10",
            origin: "Tokyo",
            destination: "Nagoya",
            departureTime: "22:00",
            arrivalTime: "23:50",
            durationMinutes: 110,
            stops: ["Tokyo", "Nagoya"],
          }),
        ],
        "Tokyo",
        "Nagoya",
      ),
      route(
        [
          trip({
            id: "2026-07-10-overnight-ok",
            date: "2026-07-10",
            origin: "Nagoya",
            destination: "Kyoto",
            departureTime: "00:20",
            arrivalTime: "01:10",
            durationMinutes: 50,
            stops: ["Nagoya", "Kyoto"],
          }),
          // wait from 23:50 = 190 min — drop
          trip({
            id: "2026-07-10-overnight-long",
            date: "2026-07-10",
            origin: "Nagoya",
            destination: "Kyoto",
            departureTime: "03:00",
            arrivalTime: "03:50",
            durationMinutes: 50,
            stops: ["Nagoya", "Kyoto"],
          }),
        ],
        "Nagoya",
        "Kyoto",
      ),
    ];

    const found = findInRoutes(routes, "Tokyo", "Kyoto", "2026-07-10");

    expect(found).toHaveLength(1);
    expect(found![0].departureTime).toBe("22:00");
    expect(found![0].arrivalTime).toBe("01:10");
    // 22:00 → 01:10 wraps past midnight: 190 minutes
    expect(found![0].durationMinutes).toBe(190);
    expect(found![0].legs![1].departureTime).toBe("00:20");
  });
});

describe("normalizeTransferLegTimes", () => {
  it("shifts multi-leg times so the first leg matches the top-level departure", () => {
    // Top says 10:00 but legs still show a template starting at 08:00 (+120 min offset).
    const result = trip({
      id: "misaligned",
      date: "2026-07-10",
      departureTime: "10:00",
      arrivalTime: "12:40",
      direct: false,
      stops: ["Tokyo", "Nagoya", "Kyoto"],
      transferStations: ["Nagoya"],
      legs: [
        {
          lineName: "Hikari",
          origin: "Tokyo",
          destination: "Nagoya",
          departureTime: "08:00",
          arrivalTime: "09:40",
          durationMinutes: 100,
          upcomingDepartures: ["08:30", "09:00"],
        },
        {
          lineName: "Hikari",
          origin: "Nagoya",
          destination: "Kyoto",
          departureTime: "09:50",
          arrivalTime: "10:40",
          durationMinutes: 50,
        },
      ],
    });

    const normalized = normalizeTransferLegTimes(result);

    expect(normalized.departureTime).toBe("10:00");
    expect(normalized.legs![0]).toMatchObject({
      departureTime: "10:00",
      arrivalTime: "11:40",
    });
    expect(normalized.legs![0].upcomingDepartures).toEqual(["10:30", "11:00"]);
    expect(normalized.legs![1]).toMatchObject({
      departureTime: "11:50",
      arrivalTime: "12:40",
    });
  });

  it("leaves direct trips and already-aligned legs unchanged", () => {
    const direct = trip({
      id: "direct",
      date: "2026-07-10",
      departureTime: "08:00",
      arrivalTime: "10:16",
      direct: true,
    });
    expect(normalizeTransferLegTimes(direct)).toBe(direct);

    const aligned = trip({
      id: "aligned",
      date: "2026-07-10",
      departureTime: "08:00",
      arrivalTime: "10:40",
      direct: false,
      legs: [
        {
          lineName: "Hikari",
          origin: "Tokyo",
          destination: "Nagoya",
          departureTime: "08:00",
          arrivalTime: "09:40",
        },
      ],
    });
    expect(normalizeTransferLegTimes(aligned)).toBe(aligned);
  });
});

describe("normalizeHeadsigns", () => {
  it("coerces object headsigns to their name string on the trip and each leg", () => {
    const result = trip({
      id: "obj-headsign",
      date: "2026-07-10",
      departureTime: "08:00",
      // Providers sometimes nest headsign as { name }
      headsign: { name: "Hakata" } as unknown as string,
      direct: false,
      legs: [
        {
          lineName: "Hikari",
          origin: "Tokyo",
          destination: "Kyoto",
          departureTime: "08:00",
          arrivalTime: "10:16",
          headsign: { name: "Shin-Osaka" } as unknown as string,
        },
      ],
    });

    const normalized = normalizeHeadsigns(result);

    expect(normalized.headsign).toBe("Hakata");
    expect(normalized.legs![0].headsign).toBe("Shin-Osaka");
  });
});

describe("normalizeResults", () => {
  it("applies headsign cleanup then leg time alignment", () => {
    const results = [
      trip({
        id: "both",
        date: "2026-07-10",
        departureTime: "10:00",
        arrivalTime: "11:40",
        direct: false,
        headsign: { name: "Kyoto" } as unknown as string,
        legs: [
          {
            lineName: "Hikari",
            origin: "Tokyo",
            destination: "Kyoto",
            departureTime: "08:00",
            arrivalTime: "09:40",
            headsign: { name: "Kyoto" } as unknown as string,
          },
        ],
      }),
    ];

    const [normalized] = normalizeResults(results);

    expect(normalized.headsign).toBe("Kyoto");
    expect(normalized.legs![0].headsign).toBe("Kyoto");
    expect(normalized.legs![0].departureTime).toBe("10:00");
    expect(normalized.legs![0].arrivalTime).toBe("11:40");
  });
});
