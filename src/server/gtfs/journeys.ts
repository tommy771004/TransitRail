import type { GtfsFeed, GtfsStop } from "./feed";
import { forEachGtfsCsvRow } from "./feed";

export type GtfsJourney = {
  tripId: string;
  departure: number;
  arrival: number;
  headsign?: string;
  routeId?: string;
  shortName?: string;
};

export type GtfsStationMatchOptions = {
  fillerWords?: readonly string[];
  synonyms?: Readonly<Record<string, string>>;
  aliases?: Readonly<Record<string, readonly string[]>>;
};

function normalizeStation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stationTokens(
  value: string,
  fillerWords: ReadonlySet<string>,
  synonyms: Readonly<Record<string, string>>,
): string[] {
  return normalizeStation(value)
    .split(" ")
    .filter((token) => token && !fillerWords.has(token))
    .map((token) => synonyms[token] ?? token);
}

function stationQueries(query: string, options: GtfsStationMatchOptions): string[] {
  const aliases = options.aliases?.[normalizeStation(query)] || [];
  return [query, ...aliases];
}

function stationStopIds(
  stops: GtfsStop[],
  query: string,
  options: GtfsStationMatchOptions,
): Set<string> {
  const fillerWords = new Set(options.fillerWords || []);
  const synonyms = options.synonyms || {};
  const queries = stationQueries(query, options);
  const queryKeys = queries.map(normalizeStation);
  const exact = stops.filter((stop) => queryKeys.includes(normalizeStation(stop.name)));
  const queryTokenSets = queries
    .map((value) => stationTokens(value, fillerWords, synonyms))
    .filter((tokens) => tokens.length > 0);
  const tokenSubset = exact.length > 0
    ? []
    : stops.filter((stop) => {
      const tokens = new Set(stationTokens(stop.name, fillerWords, synonyms));
      return queryTokenSets.some((queryTokens) => queryTokens.every((token) => tokens.has(token)));
    });
  const candidates = exact.length > 0
    ? exact
    : tokenSubset.length > 0
      ? tokenSubset
      : stops.filter((stop) => {
        const key = normalizeStation(stop.name);
        return queryKeys.some((queryKey) => key.includes(queryKey) || queryKey.includes(key));
      });
  const selected = new Set(candidates.map((stop) => stop.id));
  const selectedParents = new Set(candidates.map((stop) => stop.parentStation).filter(Boolean));
  for (const stop of stops) {
    if (selectedParents.has(stop.parentStation) || selectedParents.has(stop.id)) selected.add(stop.id);
  }
  return selected;
}

export function activeGtfsServices(feed: GtfsFeed, date: string): Set<string> {
  const active = new Set<string>();
  const compactDate = date.replace(/-/g, "");
  if (feed.calendar) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const field = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][weekday];
    forEachGtfsCsvRow(feed.calendar, (row) => {
      if (row.start_date <= compactDate && compactDate <= row.end_date && row[field] === "1") {
        active.add(row.service_id);
      }
    });
  }
  feed.activeDates.get(compactDate)?.forEach((type, serviceId) => {
    if (type === 1) active.add(serviceId);
    if (type === 2) active.delete(serviceId);
  });
  return active;
}

function gtfsMinutes(value: string): number | undefined {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatGtfsExtendedMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatGtfsClock(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function collectGtfsJourneys(
  feed: GtfsFeed,
  origin: string,
  destination: string,
  date: string,
  stationMatch: GtfsStationMatchOptions = {},
): GtfsJourney[] {
  const active = activeGtfsServices(feed, date);
  const originIds = stationStopIds(feed.stops, origin, stationMatch);
  const destinationIds = stationStopIds(feed.stops, destination, stationMatch);
  const journeys: GtfsJourney[] = [];
  const byTrip = new Map<string, {
    origins: Array<{ sequence: number; minutes: number }>;
    destinations: Array<{ sequence: number; minutes: number }>;
  }>();
  forEachGtfsCsvRow(feed.stopTimes, (row) => {
    const isOrigin = originIds.has(row.stop_id);
    const isDestination = destinationIds.has(row.stop_id);
    if (!isOrigin && !isDestination) return;
    const trip = feed.trips.get(row.trip_id);
    if (!trip || !active.has(trip.serviceId)) return;
    const sequence = Number(row.stop_sequence);
    if (!Number.isFinite(sequence)) return;
    const current = byTrip.get(row.trip_id) || { origins: [], destinations: [] };
    if (isOrigin) {
      const departure = gtfsMinutes(row.departure_time || row.arrival_time);
      if (departure !== undefined) current.origins.push({ sequence, minutes: departure });
    }
    if (isDestination) {
      const arrival = gtfsMinutes(row.arrival_time || row.departure_time);
      if (arrival !== undefined) current.destinations.push({ sequence, minutes: arrival });
    }
    byTrip.set(row.trip_id, current);
  });
  for (const [tripId, value] of byTrip) {
    const origins = value.origins.sort((a, b) => a.sequence - b.sequence);
    const destinations = value.destinations.sort((a, b) => a.sequence - b.sequence);
    const originStop = origins.find((candidate) => (
      destinations.some((destinationStop) => destinationStop.sequence > candidate.sequence)
    ));
    const destinationStop = originStop
      && destinations.find((candidate) => candidate.sequence > originStop.sequence);
    if (originStop && destinationStop) {
      const trip = feed.trips.get(tripId);
      journeys.push({
        tripId,
        departure: originStop.minutes,
        arrival: destinationStop.minutes,
        headsign: trip?.headsign,
        routeId: trip?.routeId,
        shortName: trip?.shortName,
      });
    }
  }
  return journeys.sort((a, b) => a.departure - b.departure);
}
