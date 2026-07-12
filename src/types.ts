// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Core type definitions for the transit rail application

export type Country = "japan" | "korea" | "hong_kong" | "united_kingdom" | "united_states" | "singapore" | "malaysia" | "thailand" | "germany" | "france" | "china" | "switzerland" | "belgium" | "norway";

export type AppView = "search" | "results" | "stations" | "history" | "saved" | "alerts" | "workflow" | "legend" | "feedback";

export type CurrencyDisplayMode = "original" | "converted" | "both";

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
  lineColor?: string;
  legs?: JourneyLeg[];
  transferStations?: string[];
}

export interface SearchResponse {
  results: TransitResult[];
  source?: string;
  message?: string;
  dataStatus?: SearchDataStatus;
}

export type SearchDataKind = "provider" | "snapshot" | "catalog";

/** Describes how a search result was produced without overstating its freshness. */
export interface SearchDataStatus {
  kind: SearchDataKind;
  source: string;
  /** The upstream or snapshot timestamp, when the source exposes one. */
  updatedAt?: string;
  /** When TransitRail queried an upstream provider. */
  checkedAt?: string;
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
}

export interface SavedTrip extends TransitResult {
  savedAt: string;
  date?: string;
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
