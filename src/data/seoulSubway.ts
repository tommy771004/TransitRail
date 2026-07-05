import rawStations from "./seoulSubwayStations.json";
import type { LineStation, TransitLine } from "../types";

interface SeoulSubwayRecord {
  STATION_CD: string;
  STATION_NM: string;
  STATION_NM_ENG: string;
  LINE_NUM: string;
  FR_CODE: string;
}

// Official Seoul Metro line colours (lines 1-9); branch spurs share the
// parent line's colour.
const seoulLineColors: Record<string, string> = {
  "01호선": "#0052A4",
  "02호선": "#00A84D",
  "03호선": "#EF7C1C",
  "04호선": "#00A5DE",
  "05호선": "#996CAC",
  "06호선": "#CD7C2F",
  "07호선": "#747F00",
  "08호선": "#E6186C",
  "09호선": "#BDB092",
  "02호선지선-성수": "#00A84D",
  "02호선지선-신정": "#00A84D",
  "05호선지선-마천": "#996CAC",
};

// English display label per branch spur (LINE_NUM has no clean numeric form).
const branchLabels: Record<string, string> = {
  "02호선지선-성수": "Line 2 (Seongsu Branch)",
  "02호선지선-신정": "Line 2 (Sinjeong Branch)",
  "05호선지선-마천": "Line 5 (Macheon Branch)",
};

function lineLabel(lineNum: string) {
  if (branchLabels[lineNum]) return branchLabels[lineNum];
  const digits = lineNum.replace(/\D/g, "").replace(/^0/, "");
  return digits ? `Line ${digits}` : lineNum;
}

const records = rawStations as SeoulSubwayRecord[];

const linesByNum = new Map<string, SeoulSubwayRecord[]>();
for (const record of records) {
  const list = linesByNum.get(record.LINE_NUM) || [];
  list.push(record);
  linesByNum.set(record.LINE_NUM, list);
}

// English name -> line labels serving it (2+ entries marks a transfer station).
const lineNamesByStation = new Map<string, string[]>();
for (const [lineNum, stations] of linesByNum) {
  const label = lineLabel(lineNum);
  for (const station of stations) {
    const names = lineNamesByStation.get(station.STATION_NM_ENG) || [];
    if (!names.includes(label)) names.push(label);
    lineNamesByStation.set(station.STATION_NM_ENG, names);
  }
}

export const seoulSubwayLines: TransitLine[] = Array.from(linesByNum.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([lineNum, stations]) => {
    const label = lineLabel(lineNum);
    const lineStations: LineStation[] = [...stations]
      .sort((a, b) => Number(a.FR_CODE) - Number(b.FR_CODE))
      .map((station) => {
        const transfers = (lineNamesByStation.get(station.STATION_NM_ENG) || [])
          .filter((name) => name !== label);
        return {
          name: station.STATION_NM_ENG,
          localName: station.STATION_NM,
          interchanges: transfers.length > 0 ? transfers : undefined,
        };
      });
    return {
      id: lineNum,
      name: label,
      color: seoulLineColors[lineNum],
      stations: lineStations,
    };
  });

export const seoulSubwayStationNames = Array.from(
  new Set(records.map((record) => record.STATION_NM_ENG)),
).sort((a, b) => a.localeCompare(b));
