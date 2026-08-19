import type { SearchResponse, TransitResult } from "../types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ProviderResponse = {
  status: number;
  body: SearchResponse & { error?: string };
};

interface JrCentralProviderOptions {
  fetcher?: Fetcher;
  /** Injection seam for focused tests; production samples 06:00 through 22:00. */
  sampleHours?: number[];
}

interface StationConfig {
  japanese: string;
  eucJp: string;
}

const STATIONS: Record<string, StationConfig> = {
  Tokyo: { japanese: "東京", eucJp: "%c5%ec%b5%fe" },
  Nagoya: { japanese: "名古屋", eucJp: "%cc%be%b8%c5%b2%b0" },
  Kyoto: { japanese: "京都", eucJp: "%b5%fe%c5%d4" },
  "Shin-Osaka": { japanese: "新大阪", eucJp: "%bf%b7%c2%e7%ba%e5" },
  Okayama: { japanese: "岡山", eucJp: "%b2%ac%bb%b3" },
  Hiroshima: { japanese: "広島", eucJp: "%b9%ad%c5%e7" },
  Hakata: { japanese: "博多", eucJp: "%c7%ee%c2%bf" },
};

/**
 * The CGI is the Tokaido *and* San'yō timetable — the two lines through-run, so
 * one search answers Shin-Osaka westward as well.
 *
 * Only Shin-Osaka-anchored San'yō pairs are listed. Tokyo → Hakata is a real
 * through service but each pair costs a full hourly sampling sweep against
 * someone else's CGI, and search chains Tokyo → Shin-Osaka with Shin-Osaka →
 * Hakata from the pairs already here.
 */
const ROUTES = new Set([
  "Tokyo-Shin-Osaka",
  "Tokyo-Kyoto",
  "Tokyo-Nagoya",
  "Shin-Osaka-Tokyo",
  "Nagoya-Shin-Osaka",
  "Shin-Osaka-Okayama",
  "Okayama-Shin-Osaka",
  "Shin-Osaka-Hiroshima",
  "Hiroshima-Shin-Osaka",
  "Shin-Osaka-Hakata",
  "Hakata-Shin-Osaka",
]);

/**
 * San'yō Shinkansen track is JR West's, and the Sakura and Mizuho services on
 * it are JR West/JR Kyushu trains. JR Central publishes the joint timetable, so
 * the source stays `jp-jr-central` while the operator follows the train.
 */
const SANYO_STATIONS = new Set(["Okayama", "Hiroshima", "Hakata"]);

function operatorFor(origin: string, destination: string): string {
  return SANYO_STATIONS.has(origin) || SANYO_STATIONS.has(destination) ? "JR West" : "JR Central";
}

export function isJrCentralRoute(origin: string, destination: string): boolean {
  return ROUTES.has(`${origin}-${destination}`);
}

const DEFAULT_SAMPLE_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);
const JR_CENTRAL_CGI = "https://railway.jr-central.co.jp/cgi-bin/timetable/tokainr.cgi";

function queryUrl(origin: StationConfig, destination: StationConfig, date: string, hour: number): string {
  const requested = new Date(`${date}T12:00:00+09:00`);
  const year = requested.getUTCFullYear() - 1900;
  const month = requested.getUTCMonth();
  const day = requested.getUTCDate();
  return `${JR_CENTRAL_CGI}?MODE=0&YEAR=${year}&MONH=${month}&DATE=${day}&HOUR=${hour}&MINT=0`
    + `&TRCB=277&SEAT=0&TYPE=0&InsPos=0&CSVN=&EKIS=${origin.eucJp}&EKIE=${destination.eucJp}&EKI1=&EKI2=`;
}

async function responseText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("utf-8")) return response.text();
  const bytes = await response.arrayBuffer();
  // The legacy CGI sends EUC-JP HTML and does not consistently include the
  // charset in its HTTP header (the declaration is only inside the document).
  return new TextDecoder("euc-jp").decode(bytes);
}

function yen(value: string | undefined): number | undefined {
  const match = /^(\d+)円$/.exec(value ?? "");
  return match ? Number(match[1]) : undefined;
}

function serviceLabel(value: string): string {
  const withoutEquipment = value.replace(/（.*$/, "").trim();
  const match = /^(のぞみ|ひかり|こだま|みずほ|さくら)(\d+)号$/.exec(withoutEquipment);
  if (!match) return withoutEquipment;
  const names: Record<string, string> = {
    のぞみ: "Nozomi",
    ひかり: "Hikari",
    こだま: "Kodama",
    みずほ: "Mizuho",
    さくら: "Sakura",
  };
  return `${names[match[1]]} ${match[2]}`;
}

function parseResults(
  html: string,
  origin: string,
  destination: string,
  date: string,
): TransitResult[] {
  const originStation = STATIONS[origin];
  const destinationStation = STATIONS[destination];
  if (!originStation || !destinationStation) return [];

  const results: TransitResult[] = [];
  for (const match of html.matchAll(/RouteCsv\[\d+\]\s*=\s*"([^"]*)";/g)) {
    const fields = match[1].split(",");
    if (fields.length < 16 || fields[1] !== "1" || !fields[2].includes("新幹線")) continue;
    if (fields[3] !== originStation.japanese || fields[4] !== destinationStation.japanese) continue;
    const departureTime = fields[12];
    const arrivalTime = fields[13];
    const durationMatch = /^(\d+)分$/.exec(fields[6]);
    if (!/^\d{2}:\d{2}$/.test(departureTime) || !/^\d{2}:\d{2}$/.test(arrivalTime) || !durationMatch) continue;

    const baseFare = yen(fields[7]);
    const surcharge = yen(fields[8]);
    const price = baseFare !== undefined && surcharge !== undefined ? baseFare + surcharge : undefined;
    const service = serviceLabel(fields[15]);
    results.push({
      id: `${date}-jp-jr-central-${service.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${departureTime.replace(":", "")}`,
      country: "japan",
      date,
      operator: operatorFor(origin, destination),
      service,
      departureTime,
      arrivalTime,
      durationMinutes: Number(durationMatch[1]),
      ...(price === undefined ? {} : { price, currency: "JPY" }),
      origin,
      destination,
      direct: true,
      stops: [origin, destination],
    });
  }
  return results;
}

export function createJrCentralTimetableProvider(
  options: JrCentralProviderOptions = {},
): (origin: string, destination: string, date: string) => Promise<ProviderResponse> {
  const fetcher = options.fetcher ?? fetch;
  const sampleHours = options.sampleHours ?? DEFAULT_SAMPLE_HOURS;

  return async (origin, destination, date) => {
    if (!isJrCentralRoute(origin, destination)) {
      return { status: 404, body: { results: [], error: "JR_CENTRAL_ROUTE_NOT_CONFIGURED" } };
    }
    const originStation = STATIONS[origin];
    const destinationStation = STATIONS[destination];
    const unique = new Map<string, TransitResult>();

    try {
      for (const hour of sampleHours) {
        const url = queryUrl(originStation, destinationStation, date, hour);
        const response = await fetcher(url, {
          headers: { "user-agent": "TransitRail scheduled timetable scraper" },
        });
        if (!response.ok) throw new Error(`JR Central returned HTTP ${response.status}.`);
        for (const result of parseResults(await responseText(response), origin, destination, date)) {
          unique.set(`${result.service}|${result.departureTime}`, result);
        }
      }
    } catch (error) {
      return {
        status: 503,
        body: {
          results: [],
          error: "JR_CENTRAL_SOURCE_UNAVAILABLE",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const results = [...unique.values()].sort((left, right) => left.departureTime.localeCompare(right.departureTime));
    if (results.length === 0) {
      return {
        status: 404,
        body: { results: [], error: "JR_CENTRAL_ROUTE_NOT_FOUND" },
      };
    }
    return {
      status: 200,
      body: {
        results,
        source: "JR Central official journey search",
        message: "Official Shinkansen journey results sampled hourly by the scheduled scraper; this is representative rather than every departure.",
      },
    };
  };
}

export const searchJrCentralTimetable = createJrCentralTimetableProvider();
