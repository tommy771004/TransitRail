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
    // SNCF names these stations the way the operator does, which is not how the
    // route list names them: "Paris Est", not "Paris Gare de l'Est".
    "area-paris-est,Paris Est,",
    "point-paris-est,Paris Est,area-paris-est",
    "area-strasbourg,Strasbourg-Ville,",
    "point-strasbourg,Strasbourg-Ville,area-strasbourg",
    // The feed spells out Saint where the route list abbreviates it to St.
    "area-marseille,Marseille-Saint-Charles,",
    "point-marseille,Marseille-Saint-Charles,area-marseille",
  ].join("\n"),
  // SNCF puts the train number in trip_headsign, not the destination.
  "trips.txt": [
    "route_id,service_id,trip_id,trip_headsign",
    "route-tgv,weekday,trip-weekday,6607",
    "route-tgv,cancelled,trip-cancelled,6609",
    "route-tgv,holiday-addition,trip-holiday-addition,6611",
    "route-ter,weekday,trip-slow,17769",
    "route-est,weekday,trip-est,2401",
    "route-med,weekday,trip-med,6171",
  ].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "trip-weekday,23:50:00,23:50:00,point-paris,1",
    "trip-weekday,25:15:00,25:15:00,point-lyon,2",
    "trip-cancelled,08:00:00,08:00:00,point-paris,1",
    "trip-cancelled,09:00:00,09:00:00,point-lyon,2",
    "trip-holiday-addition,08:00:00,08:00:00,point-paris,1",
    "trip-holiday-addition,09:55:00,09:55:00,point-lyon,2",
    "trip-slow,07:34:00,07:34:00,point-paris,1",
    "trip-slow,12:44:00,12:44:00,point-lyon,2",
    "trip-est,06:55:00,06:55:00,point-paris-est,1",
    "trip-est,08:41:00,08:41:00,point-strasbourg,2",
    "trip-med,07:14:00,07:14:00,point-paris,1",
    "trip-med,11:20:00,11:20:00,point-marseille,2",
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
  // route_short_name is an internal route code in the real feed ("601A"), not a
  // brand; route_type is the field that says what kind of service it is.
  "routes.txt": [
    "route_id,route_short_name,route_long_name,route_type",
    "route-tgv,601A,Paris - Lyon,101",
    "route-ter,K7,Paris - Dijon - Lyon,106",
    "route-est,201A,Paris - Strasbourg,101",
    "route-med,631D,Paris - Marseille,101",
  ].join("\n"),
});

/** Germany profile fixture: gtfs.de uses German station names and relies on a
 * normal weekly calendar without requiring calendar_dates additions. */
export const germanyGtfsFixture = zipFixture({
  "stops.txt": [
    "stop_name,parent_station,stop_id,stop_lat,stop_lon,location_type,platform_code",
    "Berlin Hbf,,berlin,52.52,13.36,,",
    "München Hbf,,munich,48.14,11.55,,",
    "Frankfurt(Main)Hbf,,frankfurt,50.10,8.66,,",
    "Köln Hbf,,cologne,50.94,6.95,,",
  ].join("\n"),
  "trips.txt": [
    "route_id,service_id,trip_id,trip_short_name",
    "ice-100,weekday,berlin-munich,100",
    "ice-200,weekday,frankfurt-cologne,200",
  ].join("\n"),
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "berlin-munich,23:45:00,23:45:00,berlin,1",
    "berlin-munich,28:10:00,28:15:00,munich,2",
    "frankfurt-cologne,07:10:00,07:10:00,frankfurt,1",
    "frankfurt-cologne,08:20:00,08:20:00,cologne,2",
  ].join("\n"),
  "calendar.txt": [
    "monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date,service_id",
    "1,1,1,1,1,0,0,20260101,20261231,weekday",
  ].join("\n"),
  "calendar_dates.txt": "service_id,exception_type,date",
  "routes.txt": [
    "route_long_name,route_short_name,agency_id,route_type,route_id",
    ",ICE 100,1,2,ice-100",
    ",ICE 200,1,2,ice-200",
  ].join("\n"),
});
