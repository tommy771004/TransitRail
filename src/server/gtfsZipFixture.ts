/**
 * Shared GTFS fixture for the France suites: a minimal but real .zip, built in
 * memory so no binary blob lives in the repository.
 *
 * The feed deliberately covers the awkward cases — a service crossing midnight
 * (25:15), a trip cancelled for the date by calendar_dates, and a trip added
 * for the date that the weekly calendar excludes — because those are what the
 * parser has to get right.
 *
 * Not named *.test.ts on purpose: vitest.config.ts only collects that pattern.
 */
export function zipFixture(files: Record<string, string>): Uint8Array {
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

export const franceGtfsFixture = zipFixture({
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
