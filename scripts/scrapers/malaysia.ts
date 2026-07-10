import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const CATALOG_PATH = resolve("src/data/catalog/malaysia.json");
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

interface MalaysiaSource {
  name: string;
  catalogUrl: string;
  downloadUrl: string;
  frequency: "daily";
}

interface DownloadSummary extends MalaysiaSource {
  columns: string[];
  stationCount: number;
  downloadedBytes: number;
  lastModified?: string;
}

interface MalaysiaCatalog {
  country: "malaysia";
  kind: "station_catalog_from_historical_ridership";
  lastUpdated: string;
  license: string;
  sources: Array<MalaysiaSource | DownloadSummary>;
  stations: string[];
}

function malaysiaYear() {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date());
}

function sourcesForYear(year: string): MalaysiaSource[] {
  return [
    {
      name: "Daily Origin-Destination Ridership: Rapid Rail (KV)",
      catalogUrl: "https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily",
      downloadUrl: `https://storage.data.gov.my/transportation/rail/rapidrail_${year}_daily.csv`,
      frequency: "daily",
    },
    {
      name: "Hourly Origin-Destination Ridership: Komuter",
      catalogUrl: "https://data.gov.my/data-catalogue/ridership_od_komuter",
      downloadUrl: `https://storage.data.gov.my/transportation/ktmb/komuter_${year}.csv`,
      frequency: "daily",
    },
  ];
}

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += char;
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

async function downloadStationNames(source: MalaysiaSource): Promise<{ stations: Set<string>; summary: DownloadSummary }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(source.downloadUrl, {
      headers: { "User-Agent": "TransitRail Malaysia station catalog scraper" },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const stations = new Set<string>();
  let buffered = "";
  let downloadedBytes = 0;
  let columns: string[] | undefined;
  let originIndex = -1;
  let destinationIndex = -1;

  const consumeLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, "");
    if (!line) return;
    const values = parseCsvRow(line);

    if (!columns) {
      columns = values.map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase());
      originIndex = columns.indexOf("origin");
      destinationIndex = columns.indexOf("destination");
      if (originIndex < 0 || destinationIndex < 0) {
        throw new Error(`expected origin and destination columns; received ${columns.join(", ")}`);
      }
      return;
    }

    for (const index of [originIndex, destinationIndex]) {
      const station = values[index]?.trim();
      if (station) stations.add(station);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    downloadedBytes += value.byteLength;
    buffered += decoder.decode(value, { stream: true });
    let newlineIndex = buffered.indexOf("\n");
    while (newlineIndex >= 0) {
      consumeLine(buffered.slice(0, newlineIndex));
      buffered = buffered.slice(newlineIndex + 1);
      newlineIndex = buffered.indexOf("\n");
    }
  }
  buffered += decoder.decode();
  if (buffered.trim()) consumeLine(buffered);

  if (!columns || stations.size === 0) {
    throw new Error("download completed without a usable station directory");
  }

    return {
      stations,
      summary: {
        ...source,
        columns,
        stationCount: stations.size,
        downloadedBytes,
        lastModified: response.headers.get("last-modified") || undefined,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readExistingCatalog(): MalaysiaCatalog | undefined {
  if (!existsSync(CATALOG_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as MalaysiaCatalog;
  } catch {
    return undefined;
  }
}

/**
 * Downloads daily historical OD files only to build a station directory.
 * These inputs intentionally never create TransitResult timetable records.
 */
export async function syncMalaysiaStationCatalog(): Promise<{ stationCount: number; sourceCount: number }> {
  const existing = readExistingCatalog();
  const allStations = new Set(existing?.stations || []);
  const summaries: DownloadSummary[] = [];
  const errors: string[] = [];

  for (const source of sourcesForYear(malaysiaYear())) {
    try {
      console.log(`  Malaysia: downloading ${source.name}...`);
      const { stations, summary } = await downloadStationNames(source);
      stations.forEach((station) => allStations.add(station));
      summaries.push(summary);
      console.log(`  Malaysia: ${summary.stationCount} stations from ${summary.downloadedBytes} bytes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${source.name}: ${message}`);
      console.warn(`  Malaysia: ${source.name} skipped (${message})`);
    }
  }

  if (summaries.length === 0) {
    throw new Error(`No Malaysia station source was refreshed. ${errors.join("; ")}`);
  }

  mkdirSync(resolve(CATALOG_PATH, ".."), { recursive: true });
  writeFileSync(CATALOG_PATH, `${JSON.stringify({
    country: "malaysia",
    kind: "station_catalog_from_historical_ridership",
    lastUpdated: new Date().toISOString(),
    license: "https://creativecommons.org/licenses/by/4.0/",
    sources: summaries,
    stations: Array.from(allStations).sort((a, b) => a.localeCompare(b)),
  } satisfies MalaysiaCatalog, null, 2)}\n`, "utf8");

  return { stationCount: allStations.size, sourceCount: summaries.length };
}
