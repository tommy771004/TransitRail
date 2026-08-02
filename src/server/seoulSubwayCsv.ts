import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { SearchResponse, ServiceDayType } from "../types";
import {
  buildKoreanSubwayArtifact,
  decodeKoreanSubwayArtifact,
  encodeKoreanSubwayArtifact,
  type KoreanSubwayArtifact,
} from "../data/koreanSubwayArtifact";
import {
  buildSeoulJourneys,
  parseSeoulSubwayTimetable,
  type SeoulTimetable,
} from "./seoulSubwayTimetable";

export const SEOUL_SUBWAY_DATASET_URL = "https://www.data.go.kr/data/15098251/fileData.do";
export const SEOUL_SUBWAY_SOURCE = "Seoul Metro official timetable CSV";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ProviderResponse = {
  status: number;
  body: SearchResponse & { error?: string };
};

interface SeoulSubwayCsvProviderOptions {
  fetcher?: Fetcher;
  datasetUrl?: string;
  csvUrl?: string;
}

export const SEOUL_SUBWAY_ARTIFACT_PATH = resolve(
  "src/data/scraped/korea/seoul-subway-timetable.json.gz",
);

export interface SeoulSubwayArtifactCollectorOptions extends SeoulSubwayCsvProviderOptions {
  artifactPath?: string;
  allowedDownloadHosts?: string[];
  maximumBytes?: number;
  minimumRuns?: number;
  minimumStations?: number;
}

function decodeHtmlUrl(value: string): string {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&");
}

function latestCsvUrl(html: string): string {
  const match = /["']contentUrl["']\s*:\s*["']([^"']+)["']/i.exec(html);
  if (!match) throw new Error("The Seoul timetable dataset page did not expose a CSV contentUrl.");
  return decodeHtmlUrl(match[1]);
}

async function downloadCsv(options: SeoulSubwayArtifactCollectorOptions): Promise<Buffer> {
  const fetcher = options.fetcher ?? fetch;
  const datasetUrl = options.datasetUrl ?? SEOUL_SUBWAY_DATASET_URL;
  let csvUrl = options.csvUrl ?? (process.env.SEOUL_SUBWAY_CSV_URL?.trim() || undefined);
  if (!csvUrl) {
    const response = await fetcher(datasetUrl, {
      headers: { "user-agent": "TransitRail scheduled timetable scraper" },
    });
    if (!response.ok) throw new Error(`Seoul timetable dataset returned HTTP ${response.status}.`);
    csvUrl = latestCsvUrl(await response.text());
  }

  const parsedUrl = new URL(csvUrl);
  const allowedHosts = options.allowedDownloadHosts ?? ["www.data.go.kr", "data.go.kr"];
  if (parsedUrl.protocol !== "https:" || !allowedHosts.includes(parsedUrl.hostname)) {
    throw new Error(`Seoul timetable download URL is not an approved official host: ${parsedUrl.hostname}`);
  }

  const response = await fetcher(parsedUrl, {
    headers: { "user-agent": "TransitRail scheduled timetable scraper" },
  });
  if (!response.ok) throw new Error(`Seoul timetable CSV returned HTTP ${response.status}.`);
  const maximumBytes = options.maximumBytes ?? 50 * 1024 * 1024;
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
    throw new Error(`Seoul timetable CSV exceeds ${maximumBytes} bytes.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maximumBytes) throw new Error(`Seoul timetable CSV exceeds ${maximumBytes} bytes.`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html") || buffer.subarray(0, 128).toString("utf8").trimStart().startsWith("<")) {
    throw new Error("Seoul timetable download returned HTML instead of CSV.");
  }
  return buffer;
}

/** Scheduled-only collector. Journey requests never call this function. */
export async function collectSeoulSubwayArtifact(
  options: SeoulSubwayArtifactCollectorOptions = {},
): Promise<KoreanSubwayArtifact> {
  const artifactPath = options.artifactPath ?? SEOUL_SUBWAY_ARTIFACT_PATH;
  const csv = await downloadCsv(options);
  const sourceSha256 = createHash("sha256").update(csv).digest("hex");

  if (existsSync(artifactPath)) {
    try {
      const existing = decodeKoreanSubwayArtifact(readFileSync(artifactPath));
      if (existing.sourceSha256 === sourceSha256) return existing;
    } catch {
      // Replace an invalid old artifact only after the new source validates.
    }
  }

  const timetable = parseSeoulSubwayTimetable(csv);
  const stationCount = new Set(timetable.runs.flatMap((run) => run.calls.map((call) => call.station))).size;
  const minimumRuns = options.minimumRuns ?? 10_000;
  const minimumStations = options.minimumStations ?? 250;
  if (timetable.runs.length < minimumRuns || stationCount < minimumStations) {
    throw new Error(
      `Seoul timetable failed completeness checks: ${timetable.runs.length} runs, ${stationCount} stations.`,
    );
  }

  const artifact = buildKoreanSubwayArtifact(timetable, {
    retrievedAt: new Date().toISOString(),
    sourceSha256,
  });
  const encoded = encodeKoreanSubwayArtifact(artifact);
  decodeKoreanSubwayArtifact(encoded);

  mkdirSync(dirname(artifactPath), { recursive: true });
  const temporaryPath = `${artifactPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, encoded);
    renameSync(temporaryPath, artifactPath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  return artifact;
}

function serviceDayType(date: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));
  if (weekday === "Sat") return "saturday";
  if (weekday === "Sun") return "sunday_holiday";
  return "weekday";
}

export function createSeoulSubwayCsvProvider(
  options: SeoulSubwayCsvProviderOptions = {},
): (origin: string, destination: string, date: string) => Promise<ProviderResponse> {
  const fetcher = options.fetcher ?? fetch;
  const datasetUrl = options.datasetUrl ?? SEOUL_SUBWAY_DATASET_URL;
  let timetablePromise: Promise<SeoulTimetable> | undefined;

  const loadTimetable = async () => {
    let csvUrl = options.csvUrl;
    if (!csvUrl) {
      const datasetResponse = await fetcher(datasetUrl, {
        headers: { "user-agent": "TransitRail timetable scraper" },
      });
      if (!datasetResponse.ok) {
        throw new Error(`Seoul timetable dataset returned HTTP ${datasetResponse.status}.`);
      }
      csvUrl = latestCsvUrl(await datasetResponse.text());
    }

    const csvResponse = await fetcher(csvUrl, {
      headers: { "user-agent": "TransitRail timetable scraper" },
    });
    if (!csvResponse.ok) {
      throw new Error(`Seoul timetable CSV returned HTTP ${csvResponse.status}.`);
    }
    return parseSeoulSubwayTimetable(Buffer.from(await csvResponse.arrayBuffer()));
  };

  return async (origin, destination, date) => {
    try {
      timetablePromise ??= loadTimetable();
      const timetable = await timetablePromise;
      const results = buildSeoulJourneys(timetable, {
        origin,
        destination,
        date,
        dayType: serviceDayType(date),
      });
      if (results.length === 0) {
        return {
          status: 404,
          body: {
            results: [],
            source: SEOUL_SUBWAY_SOURCE,
            error: "SEOUL_SUBWAY_ROUTE_NOT_FOUND",
            message: `The official Seoul timetable has no direct ${origin} → ${destination} service.`,
          },
        };
      }
      return {
        status: 200,
        body: { results, source: SEOUL_SUBWAY_SOURCE },
      };
    } catch (error) {
      // A rejected download must be retryable on the next scheduled route/date.
      timetablePromise = undefined;
      return {
        status: 503,
        body: {
          results: [],
          source: SEOUL_SUBWAY_SOURCE,
          error: "SEOUL_SUBWAY_SOURCE_UNAVAILABLE",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  };
}

export const searchSeoulSubwayJourney = createSeoulSubwayCsvProvider({
  csvUrl: process.env.SEOUL_SUBWAY_CSV_URL?.trim() || undefined,
});
