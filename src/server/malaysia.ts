import { readFileSync } from "fs";
import { resolve } from "path";

const MALAYSIA_CATALOG_PATH = resolve(process.cwd(), "src/data/catalog/malaysia.json");

interface MalaysiaCatalogFile {
  stations?: unknown;
}

/** A station directory derived from official historical ridership downloads, never a timetable feed. */
export function getMalaysiaStations(): string[] {
  try {
    const catalog = JSON.parse(readFileSync(MALAYSIA_CATALOG_PATH, "utf8")) as MalaysiaCatalogFile;
    if (!Array.isArray(catalog.stations)) return [];
    return catalog.stations.filter((station): station is string => typeof station === "string" && station.trim().length > 0);
  } catch (error) {
    console.warn("[malaysia] Could not load station catalog:", error);
    return [];
  }
}

export const MALAYSIA_STATION_CATALOG_SOURCE = "https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily";
