import { configuredCountryOptions, countryConfig } from "./countries";
import type { Country, TransitLine } from "../types";
import type { StationCoverage, StationCatalogMessageKey } from "./stationCoverage";

export interface ServiceRegion { id: string; name: string; lines: TransitLine[] }
export interface ServiceRegionCatalog {
  country: Country;
  serviceDate: string;
  regions: ServiceRegion[];
  lines: TransitLine[];
  /** Selectable subset; line arrays retain the complete directory. */
  stations: string[];
  source?: string;
  stationSource?: string;
  coverage: StationCoverage;
  messageKey?: StationCatalogMessageKey;
  /** Exact verified service-day pairs. Absent only for unbounded providers/older artifacts. */
  destinationsByOrigin?: Record<string, string[]>;
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(nonempty) && new Set(v).size === v.length;
export function isCalendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const time = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v;
}

/** One runtime boundary for API consumers, static loaders and publication. */
export function isServiceRegionCatalog(value: unknown, expected: { country?: string; serviceDate?: string; allowStationSubset?: boolean } = {}): value is ServiceRegionCatalog {
  if (!record(value) || !configuredCountryOptions.includes(value.country as Country)
    || !isCalendarDate(value.serviceDate) || (expected.country !== undefined && value.country !== expected.country)
    || (expected.serviceDate !== undefined && value.serviceDate !== expected.serviceDate)
    || !Array.isArray(value.lines) || !Array.isArray(value.regions) || !strings(value.stations)
    || !record(value.coverage)) return false;
  const coverage = value.coverage;
  if (!["scraped", "provider", "catalog_only"].includes(String(coverage.mode)) || coverage.date !== value.serviceDate) return false;
  const search = countryConfig[value.country as Country].search.kind;
  if (coverage.mode === "provider" && search !== "provider" && search !== "provider_then_scraped") return false;
  for (const key of ["source", "stationSource", "messageKey"] as const) if (value[key] !== undefined && !nonempty(value[key])) return false;
  const range = coverage.dateRange;
  if (range !== undefined) {
    if (!record(range) || !isCalendarDate(range.start) || !isCalendarDate(range.end)
      || range.start > value.serviceDate || range.end < value.serviceDate
      || typeof range.liveOnly !== "boolean"
      || range.days !== (Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1) return false;
  }
  const validLine = (line: unknown): line is TransitLine => record(line) && nonempty(line.id) && nonempty(line.name)
    && (line.color === undefined || nonempty(line.color)) && Array.isArray(line.stations)
    && line.stations.every(s => record(s) && nonempty(s.name)
      && (s.localName === undefined || nonempty(s.localName))
      && (s.accessible === undefined || typeof s.accessible === "boolean")
      && (s.interchanges === undefined || strings(s.interchanges)));
  if (!value.lines.every(validLine)) return false;
  const lines = new Map(value.lines.map(line => [line.id, line]));
  if (lines.size !== value.lines.length) return false;
  const regionIds = new Set<string>();
  const assigned = new Set<string>();
  for (const region of value.regions) {
    if (!record(region) || !nonempty(region.id) || !nonempty(region.name) || regionIds.has(region.id) || !Array.isArray(region.lines)) return false;
    regionIds.add(region.id);
    for (const line of region.lines) {
      if (!validLine(line) || assigned.has(line.id)) return false;
      const canonical = lines.get(line.id);
      const identity = (entry: TransitLine) => [entry.id, entry.name, entry.color,
        entry.stations.map(s => [s.name, s.localName, s.accessible, s.interchanges])];
      if (!canonical || JSON.stringify(identity(canonical)) !== JSON.stringify(identity(line))) return false;
      assigned.add(line.id);
    }
  }
  if (assigned.size !== lines.size) return false;
  // Provider directories may include stations outside the browsable line subset.
  const directory = new Set(value.lines.flatMap(line => line.stations.map(s => s.name)));
  if (coverage.mode !== "provider" && value.stations.some(s => !directory.has(s))) return false;
  if (coverage.mode !== "provider" && !expected.allowStationSubset) {
    const selectable = new Set(value.stations);
    if ([...directory].some(station => !selectable.has(station))) return false;
  }
  for (const s of value.stations) directory.add(s);
  for (const key of ["covered", "destinations"] as const) {
    if (coverage[key] !== undefined && (!strings(coverage[key]) || coverage[key].some(s => !directory.has(s)))) return false;
  }
  for (const key of ["messageKey", "sourceUrl", "provenance", "truthMode", "reason"] as const) {
    if (coverage[key] !== undefined && !nonempty(coverage[key])) return false;
  }
  if (value.destinationsByOrigin !== undefined) {
    if (!record(value.destinationsByOrigin)) return false;
    for (const [origin, destinations] of Object.entries(value.destinationsByOrigin)) {
      if (!directory.has(origin) || !strings(destinations) || destinations.some(s => s === origin || !directory.has(s))) return false;
    }
  }
  return true;
}
