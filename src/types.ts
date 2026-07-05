export type Country = "japan" | "korea" | "hong_kong" | "united_kingdom" | "united_states";

export type AppView = "search" | "results" | "stations" | "history" | "saved" | "alerts" | "workflow";

export type SortMode = "fastest" | "earliest" | "cheapest";

export type KoreaFilter = "all" | "cheapest" | "direct" | "first_class";

export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  country: Country;
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
  headsign?: string;
  stopCount?: number;
  /** Live "next train" times at the boarding station of this leg. */
  upcomingDepartures?: string[];
}

export interface TransitResult {
  id: string;
  country: Country;
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
  currency?: "JPY" | "KRW" | "HKD" | "GBP" | "EUR" | "CHF" | "USD" | "SGD" | "MYR";
  seatClass?: "reserved" | "economy" | "first";
  direct: boolean;
  stops: string[];
  platform?: string;
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
}

export interface LineStation {
  name: string;
  /** Native-script name when the catalog name is romanized (e.g. Seoul subway). */
  localName?: string;
  /** Names of other lines that also serve this station. */
  interchanges?: string[];
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
  reminderEnabled?: boolean;
  reminderFired?: boolean;
}

export interface SearchHistoryItem extends SearchParams {
  id: string;
  searchedAt: string;
  resultCount: number;
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
}
