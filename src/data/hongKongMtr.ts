export interface MtrStation {
  code: string;
  name: string;
}

export interface MtrLine {
  code: string;
  name: string;
  stations: MtrStation[];
}

export const mtrLineColors: Record<string, string> = {
  AEL: "#00888E",
  TCL: "#F3982D",
  TML: "#9C2E00",
  TKL: "#7E3C93",
  EAL: "#5EB7E8",
  SIL: "#CBD300",
  TWL: "#E2231A",
  ISL: "#0075C2",
  KTL: "#00A040",
  DRL: "#EB6EA5",
};

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
      ["AWE", "AsiaWorld-Expo"],
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

/**
 * One entry per line code, with branch variants merged in service order.
 * `hongKongMtrLines` keeps one entry per branch for routing; this catalog is
 * for display (station lists and interchange lookups).
 */
export interface MtrLineCatalogEntry {
  code: string;
  name: string;
  color?: string;
  stations: MtrStation[];
}

export const hongKongMtrLineCatalog: MtrLineCatalogEntry[] = (() => {
  const byCode = new Map<string, MtrLineCatalogEntry>();
  for (const line of hongKongMtrLines) {
    let entry = byCode.get(line.code);
    if (!entry) {
      entry = { code: line.code, name: line.name, color: mtrLineColors[line.code], stations: [] };
      byCode.set(line.code, entry);
    }
    for (const station of line.stations) {
      if (!entry.stations.some((existing) => existing.code === station.code)) {
        entry.stations.push(station);
      }
    }
  }
  return Array.from(byCode.values());
})();

/** Station name -> line codes serving it. Stations on 2+ lines are interchanges. */
export const mtrInterchanges: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const line of hongKongMtrLineCatalog) {
    for (const station of line.stations) {
      const codes = map.get(station.name) || [];
      if (!codes.includes(line.code)) codes.push(line.code);
      map.set(station.name, codes);
    }
  }
  return map;
})();

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

export interface MtrTransferPlan {
  interchange: string;
  firstLeg: MtrJourney;
  secondLeg: MtrJourney;
}

/**
 * Finds the best single-transfer plan between two stations that no single
 * line connects. Both legs stay on one line each; the interchange must be a
 * station shared by both legs' lines. Returns null when no such plan exists.
 */
export function findMtrTransferPlan(
  originName: string,
  destinationName: string,
): MtrTransferPlan | null {
  const plans: MtrTransferPlan[] = [];
  for (const [station, codes] of mtrInterchanges) {
    if (codes.length < 2 || station === originName || station === destinationName) continue;
    const firstLeg = findMtrJourney(originName, station);
    if (!firstLeg) continue;
    const secondLeg = findMtrJourney(station, destinationName);
    if (!secondLeg || secondLeg.line.code === firstLeg.line.code) continue;
    plans.push({ interchange: station, firstLeg, secondLeg });
  }

  plans.sort((a, b) => {
    const stopsOf = (plan: MtrTransferPlan) =>
      Math.abs(plan.firstLeg.destinationIndex - plan.firstLeg.originIndex) +
      Math.abs(plan.secondLeg.destinationIndex - plan.secondLeg.originIndex);
    return stopsOf(a) - stopsOf(b);
  });
  return plans[0] || null;
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
