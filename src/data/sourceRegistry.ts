/**
 * The register of official timetable sources, and the shape every stored route
 * carries to prove which one it came from.
 *
 * This module exists so that "where did this departure time come from?" has
 * exactly one answer per route file, written by the code that fetched it rather
 * than inferred afterwards from a free-text label. The previous design guessed
 * provenance by regex-matching the `source` string (`/curated|snapshot/i`),
 * which meant a file could be relabelled into looking official without anything
 * about its contents changing.
 *
 * Two rules keep the register honest:
 *
 * 1. **A source descriptor is declared by the scraper kind that produced it.**
 *    A {@link DownloadScraper} cannot stamp `official-html`; a
 *    {@link FrequencyScraper} cannot stamp `full-timetable`. The kind and the
 *    claim are the same fact, so they cannot drift.
 * 2. **Anything not in this register is unverified.** There is no "unknown but
 *    probably fine" tier. A route whose `sourceId` is absent from
 *    {@link officialSources} is rejected by the searchability policy and
 *    reported as `No verified timetable available.`
 */
import type { Country } from "../types";

/**
 * Source grades, per the data-source policy.
 *
 * - `A` — machine-readable official data: GTFS, GTFS-RT, CSV, XML, JSON, or an
 *   official download. Highest confidence: the operator publishes it for reuse.
 * - `B` — an official public query page driven with a browser (journey planner,
 *   train search, timetable search). Real operator data, obtained by automating
 *   the same page a passenger would use.
 * - `C` — official HTML or PDF: first train, last train, a timetable page.
 * - `D` — first train, last train and headway only. **A `D` source may never be
 *   expanded into individual departures.** It can say when service starts and
 *   ends and how often trains run; deriving a departure list from a headway is
 *   exactly the synthetic data this register exists to prevent.
 */
export type SourceTier = "A" | "B" | "C" | "D";

/** The concrete artifact a source hands over, which implies its tier. */
export type SourceType =
  | "official-gtfs"
  | "official-gtfs-rt"
  | "official-csv"
  | "official-xml"
  | "official-json"
  | "official-download"
  | "official-browser"
  | "official-html"
  | "official-pdf";

/**
 * How much of a service day the source can substantiate.
 *
 * `frequency-only` and `service-hours` are honest, useful answers — they are
 * what an operator that publishes no departure list actually knows. They are
 * not a lesser form of `full-timetable` to be topped up with estimates.
 */
export type SourceCompleteness =
  | "full-timetable"
  | "frequency-only"
  | "service-hours";

/** Tier implied by the artifact type. Declared once so the two cannot disagree. */
const TIER_BY_TYPE: Record<SourceType, SourceTier> = {
  "official-gtfs": "A",
  "official-gtfs-rt": "A",
  "official-csv": "A",
  "official-xml": "A",
  "official-json": "A",
  "official-download": "A",
  "official-browser": "B",
  "official-html": "C",
  "official-pdf": "C",
};

export function tierForSourceType(type: SourceType): SourceTier {
  return TIER_BY_TYPE[type];
}

/** A registered official source. `id` is what a stored route refers to. */
export interface OfficialSource {
  id: string;
  country: Country;
  /** Operator or publisher, as they name themselves. */
  provider: string;
  /** Human-readable source name, shown to passengers. */
  sourceName: string;
  sourceType: SourceType;
  /** Public URL a passenger can open to verify a departure themselves. */
  sourceUrl: string;
  /** The most this source can ever substantiate, whatever a run returns. */
  maxCompleteness: SourceCompleteness;
  /** Set when the source only answers "now", never a future service day. */
  liveOnly?: boolean;
  /** Licence or attribution the source requires us to carry. */
  attribution?: string;
}

/**
 * Every source TransitRail is allowed to publish timetable data from.
 *
 * Adding an entry here is the act of certifying a source: it says a human
 * checked that the URL is the operator's own, that the data is published for
 * this use, and that the declared completeness is what the source can support.
 * Nothing else in the codebase may introduce a timetable source.
 */
export const officialSources = {
  // --- Japan ---
  "jp-odpt-toei": {
    id: "jp-odpt-toei",
    country: "japan",
    provider: "Tokyo Metropolitan Bureau of Transportation (Toei)",
    sourceName: "ODPT Toei train timetable",
    sourceType: "official-json",
    sourceUrl: "https://developer.odpt.org/en/datasets",
    maxCompleteness: "full-timetable",
    attribution: "ODPT / Toei (CC BY 4.0)",
  },
  "jp-odpt-tokyo-metro": {
    id: "jp-odpt-tokyo-metro",
    country: "japan",
    provider: "Tokyo Metro",
    sourceName: "ODPT Tokyo Metro train timetable",
    sourceType: "official-json",
    sourceUrl: "https://developer.odpt.org/en/datasets",
    maxCompleteness: "full-timetable",
    attribution: "ODPT / Tokyo Metro",
  },
  "jp-jr-central": {
    id: "jp-jr-central",
    country: "japan",
    provider: "Central Japan Railway Company (JR Central)",
    sourceName: "JR Central official journey search",
    sourceType: "official-browser",
    sourceUrl: "https://railway.jr-central.co.jp/timetable/",
    maxCompleteness: "full-timetable",
  },

  // --- Korea ---
  "kr-seoul-metro-csv": {
    id: "kr-seoul-metro-csv",
    country: "korea",
    provider: "Seoul Metro",
    sourceName: "Seoul Metro official timetable CSV",
    sourceType: "official-csv",
    sourceUrl: "https://www.data.go.kr/data/15098251/fileData.do",
    maxCompleteness: "full-timetable",
  },
  "kr-incheon-transit-csv": {
    id: "kr-incheon-transit-csv",
    country: "korea",
    provider: "Incheon Transit Corporation",
    sourceName: "Incheon Transit Corporation official timetable CSV",
    sourceType: "official-csv",
    sourceUrl: "https://www.data.go.kr/data/15044363/fileData.do",
    maxCompleteness: "full-timetable",
  },

  // --- Hong Kong ---
  "hk-mtr-next-train": {
    id: "hk-mtr-next-train",
    country: "hong_kong",
    provider: "MTR Corporation",
    sourceName: "MTR real-time next train API",
    sourceType: "official-json",
    sourceUrl: "https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data",
    maxCompleteness: "full-timetable",
    liveOnly: true,
  },
  "hk-mtr-service-hours": {
    id: "hk-mtr-service-hours",
    country: "hong_kong",
    provider: "MTR Corporation",
    sourceName: "MTR official first and last train times",
    sourceType: "official-html",
    sourceUrl: "https://www.mtr.com.hk/en/customer/services/first_last_train_index.html",
    maxCompleteness: "service-hours",
  },

  // --- United Kingdom ---
  "uk-tfl-journey-planner": {
    id: "uk-tfl-journey-planner",
    country: "united_kingdom",
    provider: "Transport for London",
    sourceName: "TfL Unified API journey planner",
    sourceType: "official-json",
    sourceUrl: "https://api.tfl.gov.uk",
    maxCompleteness: "full-timetable",
    attribution: "Powered by TfL Open Data",
  },

  // --- United States ---
  "us-mbta-v3": {
    id: "us-mbta-v3",
    country: "united_states",
    provider: "Massachusetts Bay Transportation Authority",
    sourceName: "MBTA V3 API schedules",
    sourceType: "official-json",
    sourceUrl: "https://api-v3.mbta.com",
    maxCompleteness: "full-timetable",
  },

  // --- Germany ---
  "de-gtfs": {
    id: "de-gtfs",
    country: "germany",
    provider: "gtfs.de",
    sourceName: "gtfs.de Long Distance Rail Germany GTFS",
    sourceType: "official-gtfs",
    sourceUrl: "https://gtfs.de/en/feeds/de_fv/",
    maxCompleteness: "full-timetable",
  },

  // --- France ---
  "fr-sncf-gtfs": {
    id: "fr-sncf-gtfs",
    country: "france",
    provider: "SNCF Voyageurs",
    sourceName: "SNCF Open Data GTFS",
    sourceType: "official-gtfs",
    sourceUrl: "https://ressources.data.sncf.com/explore/dataset/horaires-des-train-voyages-tgvinouiouigo/",
    maxCompleteness: "full-timetable",
  },

  // --- Switzerland ---
  "ch-opentransportdata-gtfs": {
    id: "ch-opentransportdata-gtfs",
    country: "switzerland",
    provider: "Swiss Federal Railways / opentransportdata.swiss",
    sourceName: "OpenTransportData Swiss GTFS Static",
    sourceType: "official-gtfs",
    sourceUrl: "https://opentransportdata.swiss/en/dataset/timetable-2025-gtfs2020",
    maxCompleteness: "full-timetable",
  },
  "ch-ojp": {
    id: "ch-ojp",
    country: "switzerland",
    provider: "opentransportdata.swiss",
    sourceName: "OpenTransportData Swiss OJP 2.0 journey API",
    sourceType: "official-xml",
    sourceUrl: "https://opentransportdata.swiss/en/cookbook/open-journey-planner-ojp/",
    maxCompleteness: "full-timetable",
  },

  // --- Belgium ---
  "be-irail": {
    id: "be-irail",
    country: "belgium",
    provider: "NMBS/SNCB (via iRail)",
    sourceName: "iRail official NMBS/SNCB connections API",
    sourceType: "official-json",
    sourceUrl: "https://api.irail.be",
    maxCompleteness: "full-timetable",
  },

  // --- Norway ---
  "no-entur": {
    id: "no-entur",
    country: "norway",
    provider: "Entur AS",
    sourceName: "Entur Journey Planner v3",
    sourceType: "official-json",
    sourceUrl: "https://api.entur.io/journey-planner/v3/graphql",
    maxCompleteness: "full-timetable",
  },

  // --- Singapore ---
  "sg-smrt-service-hours": {
    id: "sg-smrt-service-hours",
    country: "singapore",
    provider: "SMRT Corporation",
    sourceName: "SMRT official station information",
    sourceType: "official-json",
    sourceUrl: "https://journey.smrt.com.sg/journey/station_info/",
    maxCompleteness: "frequency-only",
  },

  // --- Thailand ---
  "th-bem-service-hours": {
    id: "th-bem-service-hours",
    country: "thailand",
    provider: "Bangkok Expressway and Metro (BEM)",
    sourceName: "BEM MRT official service information",
    sourceType: "official-html",
    sourceUrl: "https://metro.bemplc.co.th/Train-Schedule",
    maxCompleteness: "frequency-only",
  },

  // --- Malaysia ---
  "my-data-gov-catalog": {
    id: "my-data-gov-catalog",
    country: "malaysia",
    provider: "Ministry of Transport Malaysia (data.gov.my)",
    sourceName: "data.gov.my rail ridership station catalog",
    sourceType: "official-csv",
    sourceUrl: "https://data.gov.my/data-catalogue/ridership_headline",
    // Station names only — this source publishes no timetable at all.
    maxCompleteness: "service-hours",
  },
} as const satisfies Record<string, OfficialSource>;

export type OfficialSourceId = keyof typeof officialSources;

/**
 * The registered source behind each live journey planner search calls directly.
 *
 * Search's live path and the nightly scrape reach the same operators, so they
 * have to name the same sources — otherwise a departure would be traceable when
 * it came off disk and untraceable when it came off the wire.
 *
 * Switzerland appears twice on purpose: the nightly job reads the published
 * GTFS archive, while search queries the OJP journey API. They are different
 * artifacts from the same publisher and are graded separately.
 */
export const providerSourceIds = {
  tfl: "uk-tfl-journey-planner",
  mbta: "us-mbta-v3",
  belgium: "be-irail",
  norway: "no-entur",
  swiss: "ch-ojp",
} as const satisfies Record<string, OfficialSourceId>;

export type LiveProviderId = keyof typeof providerSourceIds;

export function sourceIdForProvider(provider: string | undefined): OfficialSourceId | undefined {
  if (!provider) return undefined;
  return (providerSourceIds as Record<string, OfficialSourceId>)[provider];
}

export function findOfficialSource(id: string | undefined): OfficialSource | undefined {
  if (!id) return undefined;
  return (officialSources as Record<string, OfficialSource>)[id];
}

export function isRegisteredSource(id: string | undefined): id is OfficialSourceId {
  return findOfficialSource(id) !== undefined;
}

export function officialSourcesForCountry(country: Country): OfficialSource[] {
  return Object.values(officialSources as Record<string, OfficialSource>)
    .filter((source) => source.country === country);
}

/**
 * The bump-on-shape-change version stored with every route file.
 *
 * A file written under an older version is not wrong, but it predates a
 * guarantee the current pipeline makes, so validation reports it rather than
 * silently treating it as current.
 */
export const ARTIFACT_VERSION = 2;

/**
 * The provenance block written into every route file and service-day artifact.
 *
 * `verified` is not a synonym for "we like this source". It is true only when
 * the run actually reached the registered source and parsed its response: a
 * fetch that failed leaves the previous file in place, so a `verified: false`
 * block never reaches disk through the normal pipeline. It exists so that a
 * hand-written or legacy file cannot pass itself off as verified by omission.
 */
export interface TimetableSourceMeta {
  sourceId: OfficialSourceId;
  sourceType: SourceType;
  sourceTier: SourceTier;
  sourceName: string;
  sourceUrl: string;
  provider: string;
  country: Country;
  /** ISO instant the source was read. */
  fetchedAt: string;
  verified: boolean;
  completeness: SourceCompleteness;
  artifactVersion: number;
  attribution?: string;
}

export interface BuildSourceMetaOptions {
  sourceId: OfficialSourceId;
  fetchedAt?: string;
  /** Defaults to the source's declared ceiling; may only narrow it. */
  completeness?: SourceCompleteness;
  verified?: boolean;
}

const COMPLETENESS_RANK: Record<SourceCompleteness, number> = {
  "service-hours": 0,
  "frequency-only": 1,
  "full-timetable": 2,
};

/**
 * Build the provenance block for one fetch.
 *
 * A caller may report *less* than its source's ceiling — a full-timetable feed
 * that only yielded service hours today should say so — but never more. An
 * over-claim is a programming error, not a data condition, so it throws.
 */
export function buildSourceMeta(options: BuildSourceMetaOptions): TimetableSourceMeta {
  const source = findOfficialSource(options.sourceId);
  if (!source) {
    throw new Error(`Unregistered timetable source "${options.sourceId}" — add it to officialSources first.`);
  }
  const completeness = options.completeness ?? source.maxCompleteness;
  if (COMPLETENESS_RANK[completeness] > COMPLETENESS_RANK[source.maxCompleteness]) {
    throw new Error(
      `Source "${source.id}" can substantiate at most ${source.maxCompleteness}, not ${completeness}.`,
    );
  }
  return {
    sourceId: source.id as OfficialSourceId,
    sourceType: source.sourceType,
    sourceTier: tierForSourceType(source.sourceType),
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    provider: source.provider,
    country: source.country,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    verified: options.verified ?? true,
    completeness,
    artifactVersion: ARTIFACT_VERSION,
    ...(source.attribution ? { attribution: source.attribution } : {}),
  };
}

function isSourceCompleteness(value: unknown): value is SourceCompleteness {
  return value === "full-timetable" || value === "frequency-only" || value === "service-hours";
}

/**
 * Validate a provenance block read back from disk.
 *
 * Deliberately strict about the pairing between the stored fields and the
 * register: a file may not claim a tier, URL, or completeness its registered
 * source does not support, because those are the three things a passenger would
 * use to decide whether to trust a departure.
 */
export function isValidSourceMeta(value: unknown): value is TimetableSourceMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  const source = findOfficialSource(typeof meta.sourceId === "string" ? meta.sourceId : undefined);
  if (!source) return false;
  if (meta.sourceType !== source.sourceType) return false;
  if (meta.sourceTier !== tierForSourceType(source.sourceType)) return false;
  if (meta.sourceUrl !== source.sourceUrl) return false;
  if (meta.provider !== source.provider) return false;
  if (meta.country !== source.country) return false;
  if (typeof meta.sourceName !== "string" || meta.sourceName.trim() === "") return false;
  if (typeof meta.fetchedAt !== "string" || !Number.isFinite(Date.parse(meta.fetchedAt))) return false;
  if (meta.verified !== true && meta.verified !== false) return false;
  if (!isSourceCompleteness(meta.completeness)) return false;
  if (COMPLETENESS_RANK[meta.completeness] > COMPLETENESS_RANK[source.maxCompleteness]) return false;
  return typeof meta.artifactVersion === "number" && Number.isFinite(meta.artifactVersion);
}
