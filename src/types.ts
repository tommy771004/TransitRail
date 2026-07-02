export type Country = "japan" | "korea" | "hong_kong";

export type AppView = "search" | "results" | "stations" | "history" | "saved" | "alerts" | "workflow";

export type SortMode = "fastest" | "earliest" | "cheapest";

export type KoreaFilter = "all" | "cheapest" | "direct" | "first_class";

export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  country: Country;
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
  destination: string;
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
}

export interface SearchResponse {
  results: TransitResult[];
  source?: string;
  message?: string;
}

export interface SavedTrip extends TransitResult {
  savedAt: string;
}

export interface SearchHistoryItem extends SearchParams {
  id: string;
  searchedAt: string;
  resultCount: number;
}

export interface AppAlert {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
