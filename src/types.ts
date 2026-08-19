// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Core type definitions for the transit rail application

export type Country = "japan" | "korea" | "hong_kong" | "united_kingdom" | "united_states" | "singapore" | "malaysia" | "thailand" | "germany" | "france" | "china" | "switzerland" | "belgium" | "norway";

export type AppView = "search" | "results" | "stations" | "history" | "saved" | "alerts" | "workflow" | "legend" | "feedback";

export type CurrencyDisplayMode = "original" | "converted" | "both";

/** Provenance attached when a snapshot contains a non-official advisory value. */
export type TimetableProvenance = "official" | "curated" | "llm-advisory";
/** Truth level carried from the shared searchability policy to every output. */
export type TimetableTruthMode = "verified" | "indicative" | "stale" | "unusable";

export type SortMode = "fastest" | "earliest" | "cheapest";

export type KoreaFilter = "all" | "cheapest" | "direct" | "first_class";

export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  /** Only return departures at or after this local service time. */
  time?: string;
  country: Country;
  preferredTransitTypes?: string[];
}

export interface JourneyLeg {
  lineName: string;
  lineCode?: string;
  color?: string;
  mode?: string;
  origin: string;
  originLat?: number;
  originLng?: number;
  destination: string;
  destLat?: number;
  destLng?: number;
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  platform?: string;
  delayMinutes?: number;
  headsign?: string;
  stopCount?: number;
  stops?: string[];
  upcomingDepartures?: string[];
}

export interface TransitResult {
  id: string;
  country: Country;
  date?: string;
  operator: string;
  service: string;
  trainType?: string;
  durationMinutes?: number;
  departureTime: string;
  arrivalTime?: string;
  origin: string;
  originLat?: number;
  originLng?: number;
  destination: string;
  destLat?: number;
  destLng?: number;
  price?: number;
  currency?: string;
  seatClass?: "reserved" | "economy" | "first";
  direct: boolean;
  stops: string[];
  platform?: string;
  delayMinutes?: number;
  headsign?: string;
  realtime?: boolean;
  amenities?: string[];
  warning?: string;
  tags?: string[];
  provenance?: TimetableProvenance;
  truthMode?: TimetableTruthMode;
  lineColor?: string;
  legs?: JourneyLeg[];
  transferStations?: string[];
}

export interface SearchResponse {
  results: TransitResult[];
  source?: string;
  provenance?: TimetableProvenance | "unknown";
  truthMode?: TimetableTruthMode;
  message?: string;
  dataStatus?: SearchDataStatus;
  serviceDayAdvisory?: ServiceDayAdvisory;
  coverageGap?: CoverageGap;
  noResultReason?: NoResultReason;
  officialSourceUrl?: string;
}

export type NoResultReason =
  | "unsupported_route"
  | "future_date_unavailable"
  | "no_verified_data"
  | "no_service";

/**
 * Why a search found nothing: the station picker offers a country's whole line
 * map, but timetables only cover some of it. Present so the UI can say which
 * end of the trip is missing instead of implying a fetch failure.
 */
export interface CoverageGap {
  /** Requested endpoints with no timetable data (may be one or both). */
  uncovered: string[];
  /** Stations in this country that do have data, for a "try these" prompt. */
  suggestions: string[];
}

export type ServiceDayCoverage = "supported" | "partial" | "stale" | "unavailable";
export type ServiceDayType = "weekday" | "saturday" | "sunday_holiday" | "special";
export type ServiceRisk = "safe" | "approaching" | "critical" | "missed" | "unavailable";

export interface ServiceDayAdvisory {
  coverage: ServiceDayCoverage;
  serviceDate: string;
  timezone: string;
  serviceDayType: ServiceDayType;
  firstDeparture?: string;
  lastDeparture?: string;
  risk: ServiceRisk;
  minutesToLastDeparture?: number;
  source: string;
  sourceUrl?: string;
  checkedAt?: string;
  updatedAt?: string;
  /**
   * Published train frequency for this service day.
   *
   * Kept in the operator's own shape — they split peak from off-peak and quote
   * ranges ("3.5-5"), so reducing it to a single number would mean inventing
   * precision the source does not have. A market with no published frequency
   * simply omits this.
   */
  frequency?: Array<{ label: string; minutes: string }>;
  note?: string;
}

export type SearchDataKind = "provider" | "snapshot" | "catalog";

/**
 * Where a result came from, in the terms a passenger would want before acting
 * on a departure time: who published it, when it was read, where to check it,
 * and how much of the service day it actually covers.
 *
 * `sourceUrl` and `completeness` are the two that change a decision. The link
 * is what makes a departure checkable rather than merely asserted, and the
 * completeness says whether "no later trains" means the day is over or only
 * that this source never publishes a last train.
 */
export interface SearchDataStatus {
  kind: SearchDataKind;
  source: string;
  /** The upstream or snapshot timestamp, when the source exposes one. */
  updatedAt?: string;
  /** When TransitRail queried an upstream provider. */
  checkedAt?: string;
  /** Operator or publisher, as they name themselves. */
  provider?: string;
  /** Public page a passenger can open to check a departure themselves. */
  sourceUrl?: string;
  /** Source grade: A machine-readable, B official query page, C page or PDF. */
  sourceTier?: "A" | "B" | "C" | "D";
  completeness?: "full-timetable" | "frequency-only" | "service-hours";
  /** Whether the returned rows cover a day, samples, or only the next few departures. */
  temporalCoverage?: "full-day" | "sampled-service-day" | "bounded-upcoming";
  /** Licence or attribution the source requires us to display. */
  attribution?: string;
}

export interface LineStation {
  name: string;
  localName?: string;
  interchanges?: string[];
  accessible?: boolean;
}

export interface TransitLine {
  id: string;
  name: string;
  color?: string;
  stations: LineStation[];
}

export interface LinesResponse {
  lines: TransitLine[];
  source?: string;
  message?: string;
  provenance?: TimetableProvenance | "unknown";
  truthMode?: TimetableTruthMode;
}

export interface SavedTrip extends TransitResult {
  savedAt: string;
  date?: string;
  /** Query time retained for service-boundary change notifications. */
  advisoryTime?: string;
  /** Local preference only; it never represents a reservation with an operator. */
  seatPreference?: "standard" | "window" | "aisle" | "first";
  reminderEnabled?: boolean;
  reminderFired?: boolean;
}

export interface SearchHistoryItem extends SearchParams {
  id: string;
  searchedAt: string;
  resultCount: number;
  pinned?: boolean;
}

export interface FavoriteRoute {
  id: string;
  origin: string;
  destination: string;
  country: Country;
  createdAt: string;
}

export interface AppAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Set when this alert is about a specific country's timetable, so it can be
   *  cross-referenced against that country's live service status. */
  country?: Country;
}

export interface TransitSituation {
  id: string;
  country: Country;
  title: string;
  description?: string;
  severity?: "info" | "minor" | "major";
  updatedAt?: string;
  source: string;
}

// --- End of types.ts ---
