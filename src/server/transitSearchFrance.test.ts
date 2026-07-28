import { afterEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";
import { resetFranceGtfsCache, resetFranceGtfsFeedCache } from "./franceGtfs";

function zipFixture(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const write16 = (value: number) => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
  const write32 = (value: number) => Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  let localOffset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const local = [
      Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
      write16(20), write16(0), write16(0), write16(0), write16(0),
      write32(crc32(data)), write32(data.length), write32(data.length),
      write16(nameBytes.length), write16(0), nameBytes, data,
    ];
    localChunks.push(...local);
    centralChunks.push(
      Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
      write16(20), write16(20), write16(0), write16(0), write16(0), write16(0),
      write32(crc32(data)), write32(data.length), write32(data.length),
      write16(nameBytes.length), write16(0), write16(0), write16(0), write16(0),
      write32(0), write32(localOffset), nameBytes,
    );
    localOffset += local.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = [
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    write16(0), write16(0), write16(Object.keys(files).length), write16(Object.keys(files).length),
    write32(centralSize), write32(localOffset), write16(0),
  ];
  const chunks = [...localChunks, ...centralChunks, ...eocd];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

const gtfsFixture = zipFixture({
  "stops.txt": [
    "stop_id,stop_name,parent_station",
    "area-paris,Paris Gare de Lyon Hall 1 - 2,",
    "point-paris,Paris Gare de Lyon Hall 1 - 2,area-paris",
    "area-lyon,Lyon Part Dieu,",
    "point-lyon,Lyon Part Dieu,area-lyon",
  ].join("\n"),
  "trips.txt": [
    "route_id,service_id,trip_id,trip_headsign",
    "route-tgv,weekday,trip-weekday,Lyon Part Dieu",
    "route-tgv,cancelled,trip-cancelled,Lyon Part Dieu",
    "route-tgv,holiday-addition,trip-holiday-addition,Lyon Part Dieu",
  ].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "trip-weekday,23:50:00,23:50:00,point-paris,1",
    "trip-weekday,25:15:00,25:15:00,point-lyon,2",
    "trip-cancelled,08:00:00,08:00:00,point-paris,1",
    "trip-cancelled,09:00:00,09:00:00,point-lyon,2",
    "trip-holiday-addition,08:00:00,08:00:00,point-paris,1",
    "trip-holiday-addition,09:55:00,09:55:00,point-lyon,2",
  ].join("\n"),
  "calendar.txt": [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "weekday,1,1,1,1,1,0,0,20260101,20261231",
    "cancelled,1,1,1,1,1,0,0,20260101,20261231",
    "holiday-addition,0,0,0,0,0,0,0,20260101,20261231",
  ].join("\n"),
  "calendar_dates.txt": [
    "service_id,date,exception_type",
    "weekday,20260803,1",
    "cancelled,20260803,2",
    "holiday-addition,20260803,1",
  ].join("\n"),
  "routes.txt": [
    "route_id,route_short_name,route_long_name",
    "route-tgv,TGV INOUI,Paris - Lyon",
  ].join("\n"),
});

describe("runTransitSearch France GTFS service-day advisory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetFranceGtfsCache();
  });

  it("uses the official GTFS calendar, filters cancelled services, and preserves cross-midnight times", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip") {
        return new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } });
      }
      throw new Error(`Unexpected France fixture request: ${url}`);
    }));

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
      time: "00:00",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.results.length).toBeGreaterThan(0);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "supported",
      serviceDate: "2026-08-03",
      timezone: "Europe/Paris",
      serviceDayType: "special",
      firstDeparture: "08:00",
      lastDeparture: "23:50",
      source: "SNCF Open Data GTFS",
      sourceUrl: "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip",
    }));
  });

  it("labels the last known advisory stale when a later feed download fails", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } });
      throw new Error("fixture SNCF outage secret");
    }));

    const input = {
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france" as const,
      date: "2026-08-03",
      time: "22:00",
    };
    const first = await runTransitSearch(input);
    expect(first.payload.serviceDayAdvisory?.coverage).toBe("supported");

    resetFranceGtfsFeedCache();
    const stale = await runTransitSearch(input);
    expect(stale.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "stale",
      firstDeparture: "08:00",
      lastDeparture: "23:50",
    }));
    expect(stale.payload.message).toBeUndefined();
  });

  it("does not publish a partial or malformed archive as service-day coverage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0x01, 0x02]), {
      status: 200,
      headers: { "content-type": "application/zip" },
    })));

    const result = await runTransitSearch({
      origin: "Paris Gare de Lyon",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(result.payload.message).toBeUndefined();
    expect(result.payload.serviceDayAdvisory?.note).not.toContain("central directory");
  });

  it("returns an explicit unavailable advisory even when the journey result is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip") {
        return new Response(gtfsFixture, { status: 200, headers: { "content-type": "application/zip" } });
      }
      throw new Error(`Unexpected France fixture request: ${input}`);
    }));

    const result = await runTransitSearch({
      origin: "Unknown Station",
      destination: "Lyon Part-Dieu",
      country: "france",
      date: "2026-08-03",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.results).toHaveLength(0);
    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "unavailable",
      serviceDate: "2026-08-03",
      risk: "unavailable",
    }));
  });
});
