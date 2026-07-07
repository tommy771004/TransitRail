import {
  singaporeMrtLines,
  thailandTransitLines,
  chinaRailLines,
  germanyRailLines,
  franceRailLines,
  switzerlandRailLines,
} from "../data/metroLines";
import { japanRailLines } from "../data/stations";
import { seoulSubwayLines } from "../data/seoulSubway";
import { hongKongMtrLineCatalog, mtrInterchanges } from "../data/hongKongMtr";
import type { TransitLine, LineStation } from "../types";

function getHongKongLines(): TransitLine[] {
  return hongKongMtrLineCatalog.map((line) => ({
    id: line.code,
    name: line.name,
    color: line.color,
    stations: line.stations.map((station) => {
      const others = (mtrInterchanges.get(station.name) || []).filter((code) => code !== line.code);
      const names = others
        .map((code) => hongKongMtrLineCatalog.find((entry) => entry.code === code)?.name)
        .filter((name): name is string => Boolean(name));
      return { name: station.name, interchanges: names.length > 0 ? names : undefined };
    }),
  }));
}

const ALL_METRO_LINES: TransitLine[] = [
  ...singaporeMrtLines,
  ...thailandTransitLines,
  ...chinaRailLines,
  ...germanyRailLines,
  ...franceRailLines,
  ...switzerlandRailLines,
  ...japanRailLines,
  ...seoulSubwayLines,
  ...getHongKongLines(),
];

export function extractPathBetweenStations(
  lineId: string,
  origin: string,
  destination: string
): { stations: LineStation[]; color: string; name: string } | null {
  const normId = (lineId || "").toLowerCase().trim();
  const normOrigin = (origin || "").toLowerCase().trim();
  const normDest = (destination || "").toLowerCase().trim();

  let matchedLine = ALL_METRO_LINES.find(
    (l) => l.id.toLowerCase() === normId || l.name.toLowerCase() === normId
  );

  if (!matchedLine) {
    matchedLine = ALL_METRO_LINES.find(
      (l) =>
        l.id.toLowerCase().includes(normId) ||
        normId.includes(l.id.toLowerCase()) ||
        l.name.toLowerCase().includes(normId) ||
        normId.includes(l.name.toLowerCase())
    );
  }

  if (!matchedLine) {
    matchedLine = ALL_METRO_LINES.find((l) => {
      const hasOrigin = l.stations.some((s) => s.name.toLowerCase().trim() === normOrigin);
      const hasDest = l.stations.some((s) => s.name.toLowerCase().trim() === normDest);
      return hasOrigin && hasDest;
    });
  }

  if (!matchedLine) {
    return null;
  }

  const stations = matchedLine.stations;
  const oIdx = stations.findIndex((s) => s.name.toLowerCase().trim() === normOrigin);
  const dIdx = stations.findIndex((s) => s.name.toLowerCase().trim() === normDest);

  if (oIdx === -1 || dIdx === -1) {
    return null;
  }

  let subset: LineStation[] = [];
  if (oIdx <= dIdx) {
    subset = stations.slice(oIdx, dIdx + 1);
  } else {
    subset = stations.slice(dIdx, oIdx + 1).reverse();
  }

  return {
    stations: subset,
    color: matchedLine.color || "#94a3b8",
    name: matchedLine.name,
  };
}
