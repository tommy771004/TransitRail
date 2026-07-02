export interface MtrStation {
  code: string;
  name: string;
}

export interface MtrLine {
  code: string;
  name: string;
  stations: MtrStation[];
}

function stations(entries: Array<[string, string]>): MtrStation[] {
  return entries.map(([code, name]) => ({ code, name }));
}

export const hongKongMtrLines: MtrLine[] = [
  {
    code: "AEL",
    name: "Airport Express",
    stations: stations([
      ["HOK", "Hong Kong"],
      ["KOW", "Kowloon"],
      ["TSY", "Tsing Yi"],
      ["AIR", "Airport"],
      ["AWE", "AsiaWorld Expo"],
    ]),
  },
  {
    code: "TCL",
    name: "Tung Chung Line",
    stations: stations([
      ["HOK", "Hong Kong"],
      ["KOW", "Kowloon"],
      ["OLY", "Olympic"],
      ["NAC", "Nam Cheong"],
      ["LAK", "Lai King"],
      ["TSY", "Tsing Yi"],
      ["SUN", "Sunny Bay"],
      ["TUC", "Tung Chung"],
    ]),
  },
  {
    code: "TML",
    name: "Tuen Ma Line",
    stations: stations([
      ["WKS", "Wu Kai Sha"],
      ["MOS", "Ma On Shan"],
      ["HEO", "Heng On"],
      ["TSH", "Tai Shui Hang"],
      ["SHM", "Shek Mun"],
      ["CIO", "City One"],
      ["STW", "Sha Tin Wai"],
      ["CKT", "Che Kung Temple"],
      ["TAW", "Tai Wai"],
      ["HIK", "Hin Keng"],
      ["DIH", "Diamond Hill"],
      ["KAT", "Kai Tak"],
      ["SUW", "Sung Wong Toi"],
      ["TKW", "To Kwa Wan"],
      ["HOM", "Ho Man Tin"],
      ["HUH", "Hung Hom"],
      ["ETS", "East Tsim Sha Tsui"],
      ["AUS", "Austin"],
      ["NAC", "Nam Cheong"],
      ["MEF", "Mei Foo"],
      ["TWW", "Tsuen Wan West"],
      ["KSR", "Kam Sheung Road"],
      ["YUL", "Yuen Long"],
      ["LOP", "Long Ping"],
      ["TIS", "Tin Shui Wai"],
      ["SIH", "Siu Hong"],
      ["TUM", "Tuen Mun"],
    ]),
  },
  {
    code: "TKL",
    name: "Tseung Kwan O Line",
    stations: stations([
      ["NOP", "North Point"],
      ["QUB", "Quarry Bay"],
      ["YAT", "Yau Tong"],
      ["TIK", "Tiu Keng Leng"],
      ["TKO", "Tseung Kwan O"],
      ["HAH", "Hang Hau"],
      ["POA", "Po Lam"],
    ]),
  },
  {
    code: "TKL",
    name: "Tseung Kwan O Line",
    stations: stations([
      ["NOP", "North Point"],
      ["QUB", "Quarry Bay"],
      ["YAT", "Yau Tong"],
      ["TIK", "Tiu Keng Leng"],
      ["TKO", "Tseung Kwan O"],
      ["LHP", "LOHAS Park"],
    ]),
  },
  {
    code: "EAL",
    name: "East Rail Line",
    stations: stations([
      ["ADM", "Admiralty"],
      ["EXC", "Exhibition Centre"],
      ["HUH", "Hung Hom"],
      ["MKK", "Mong Kok East"],
      ["KOT", "Kowloon Tong"],
      ["TAW", "Tai Wai"],
      ["SHT", "Sha Tin"],
      ["FOT", "Fo Tan"],
      ["UNI", "University"],
      ["TAP", "Tai Po Market"],
      ["TWO", "Tai Wo"],
      ["FAN", "Fanling"],
      ["SHS", "Sheung Shui"],
      ["LOW", "Lo Wu"],
    ]),
  },
  {
    code: "EAL",
    name: "East Rail Line",
    stations: stations([
      ["ADM", "Admiralty"],
      ["EXC", "Exhibition Centre"],
      ["HUH", "Hung Hom"],
      ["MKK", "Mong Kok East"],
      ["KOT", "Kowloon Tong"],
      ["TAW", "Tai Wai"],
      ["SHT", "Sha Tin"],
      ["FOT", "Fo Tan"],
      ["UNI", "University"],
      ["TAP", "Tai Po Market"],
      ["TWO", "Tai Wo"],
      ["FAN", "Fanling"],
      ["SHS", "Sheung Shui"],
      ["LMC", "Lok Ma Chau"],
    ]),
  },
  {
    code: "EAL",
    name: "East Rail Line via Racecourse",
    stations: stations([
      ["ADM", "Admiralty"],
      ["EXC", "Exhibition Centre"],
      ["HUH", "Hung Hom"],
      ["MKK", "Mong Kok East"],
      ["KOT", "Kowloon Tong"],
      ["TAW", "Tai Wai"],
      ["SHT", "Sha Tin"],
      ["RAC", "Racecourse"],
      ["UNI", "University"],
      ["TAP", "Tai Po Market"],
      ["TWO", "Tai Wo"],
      ["FAN", "Fanling"],
      ["SHS", "Sheung Shui"],
      ["LOW", "Lo Wu"],
    ]),
  },
  {
    code: "EAL",
    name: "East Rail Line via Racecourse",
    stations: stations([
      ["ADM", "Admiralty"],
      ["EXC", "Exhibition Centre"],
      ["HUH", "Hung Hom"],
      ["MKK", "Mong Kok East"],
      ["KOT", "Kowloon Tong"],
      ["TAW", "Tai Wai"],
      ["SHT", "Sha Tin"],
      ["RAC", "Racecourse"],
      ["UNI", "University"],
      ["TAP", "Tai Po Market"],
      ["TWO", "Tai Wo"],
      ["FAN", "Fanling"],
      ["SHS", "Sheung Shui"],
      ["LMC", "Lok Ma Chau"],
    ]),
  },
  {
    code: "SIL",
    name: "South Island Line",
    stations: stations([
      ["ADM", "Admiralty"],
      ["OCP", "Ocean Park"],
      ["WCH", "Wong Chuk Hang"],
      ["LET", "Lei Tung"],
      ["SOH", "South Horizons"],
    ]),
  },
  {
    code: "TWL",
    name: "Tsuen Wan Line",
    stations: stations([
      ["CEN", "Central"],
      ["ADM", "Admiralty"],
      ["TST", "Tsim Sha Tsui"],
      ["JOR", "Jordan"],
      ["YMT", "Yau Ma Tei"],
      ["MOK", "Mong Kok"],
      ["PRE", "Prince Edward"],
      ["SSP", "Sham Shui Po"],
      ["CSW", "Cheung Sha Wan"],
      ["LCK", "Lai Chi Kok"],
      ["MEF", "Mei Foo"],
      ["LAK", "Lai King"],
      ["KWF", "Kwai Fong"],
      ["KWH", "Kwai Hing"],
      ["TWH", "Tai Wo Hau"],
      ["TSW", "Tsuen Wan"],
    ]),
  },
  {
    code: "ISL",
    name: "Island Line",
    stations: stations([
      ["KET", "Kennedy Town"],
      ["HKU", "HKU"],
      ["SYP", "Sai Ying Pun"],
      ["SHW", "Sheung Wan"],
      ["CEN", "Central"],
      ["ADM", "Admiralty"],
      ["WAC", "Wan Chai"],
      ["CAB", "Causeway Bay"],
      ["TIH", "Tin Hau"],
      ["FOH", "Fortress Hill"],
      ["NOP", "North Point"],
      ["QUB", "Quarry Bay"],
      ["TAK", "Tai Koo"],
      ["SWH", "Sai Wan Ho"],
      ["SKW", "Shau Kei Wan"],
      ["HFC", "Heng Fa Chuen"],
      ["CHW", "Chai Wan"],
    ]),
  },
  {
    code: "KTL",
    name: "Kwun Tong Line",
    stations: stations([
      ["WHA", "Whampoa"],
      ["HOM", "Ho Man Tin"],
      ["YMT", "Yau Ma Tei"],
      ["MOK", "Mong Kok"],
      ["PRE", "Prince Edward"],
      ["SKM", "Shek Kip Mei"],
      ["KOT", "Kowloon Tong"],
      ["LOF", "Lok Fu"],
      ["WTS", "Wong Tai Sin"],
      ["DIH", "Diamond Hill"],
      ["CHH", "Choi Hung"],
      ["KOB", "Kowloon Bay"],
      ["NTK", "Ngau Tau Kok"],
      ["KWT", "Kwun Tong"],
      ["LAT", "Lam Tin"],
      ["YAT", "Yau Tong"],
      ["TIK", "Tiu Keng Leng"],
    ]),
  },
  {
    code: "DRL",
    name: "Disneyland Resort Line",
    stations: stations([
      ["SUN", "Sunny Bay"],
      ["DIS", "Disneyland Resort"],
    ]),
  },
];

export const hongKongStations = Array.from(
  new Set(hongKongMtrLines.flatMap((line) => line.stations.map((station) => station.name))),
).sort((a, b) => a.localeCompare(b));

export interface MtrJourney {
  line: MtrLine;
  origin: MtrStation;
  destination: MtrStation;
  originIndex: number;
  destinationIndex: number;
  direction: "UP" | "DOWN";
}

export function findMtrJourney(originName: string, destinationName: string): MtrJourney | null {
  const candidates = hongKongMtrLines.flatMap((line) => {
    const originIndex = line.stations.findIndex((station) => station.name === originName);
    const destinationIndex = line.stations.findIndex((station) => station.name === destinationName);
    if (originIndex < 0 || destinationIndex < 0 || originIndex === destinationIndex) return [];
    return [{
      line,
      origin: line.stations[originIndex],
      destination: line.stations[destinationIndex],
      originIndex,
      destinationIndex,
      direction: line.code === "DRL"
        ? (destinationIndex > originIndex ? "DOWN" as const : "UP" as const)
        : (destinationIndex > originIndex ? "UP" as const : "DOWN" as const),
    }];
  });

  candidates.sort(
    (a, b) =>
      Math.abs(a.destinationIndex - a.originIndex) -
      Math.abs(b.destinationIndex - b.originIndex),
  );
  return candidates[0] || null;
}

export function mtrTerminalReachesDestination(
  journey: MtrJourney,
  terminalCode: string | undefined,
) {
  if (!terminalCode) return false;

  return hongKongMtrLines
    .filter((line) => line.code === journey.line.code)
    .some((line) => {
      const originIndex = line.stations.findIndex((station) => station.code === journey.origin.code);
      const destinationIndex = line.stations.findIndex(
        (station) => station.code === journey.destination.code,
      );
      const terminalIndex = line.stations.findIndex((station) => station.code === terminalCode);
      if (originIndex < 0 || destinationIndex < 0 || terminalIndex < 0) return false;

      return destinationIndex > originIndex
        ? terminalIndex >= destinationIndex
        : terminalIndex <= destinationIndex;
    });
}
