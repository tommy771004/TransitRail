import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { countryOptions } from "../../src/data/countries";
import type { ScrapedRouteData } from "./types";

const DATA_DIR = resolve("src/data/scraped");

interface MetadataRoute {
  origin: string;
  destination: string;
  resultCount: number;
  date: string;
}

interface ExistingMetadata {
  scraper?: string;
  lastScraped?: string;
}

export interface MetadataSyncSummary {
  country: string;
  routeCount: number;
  resultCount: number;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function loadRouteData(country: string): ScrapedRouteData[] {
  const dir = resolve(DATA_DIR, country);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((file) => file.endsWith(".json") && file !== "metadata.json")
    .map((file) => readJson<ScrapedRouteData>(resolve(dir, file)))
    .filter((data): data is ScrapedRouteData => Boolean(data))
    .sort((a, b) => `${a.origin}-${a.destination}`.localeCompare(`${b.origin}-${b.destination}`));
}

export function syncScrapedMetadata(scraperNames: Record<string, string> = {}): MetadataSyncSummary[] {
  return countryOptions.map((country) => {
    const dir = resolve(DATA_DIR, country);
    mkdirSync(dir, { recursive: true });

    const existing = readJson<ExistingMetadata>(resolve(dir, "metadata.json"));
    const routes = loadRouteData(country);
    const metadataRoutes: MetadataRoute[] = routes.map((route) => ({
      origin: route.origin,
      destination: route.destination,
      resultCount: route.results.length,
      date: route.date,
    }));

    const resultCount = routes.reduce((total, route) => total + route.results.length, 0);
    writeFileSync(
      resolve(dir, "metadata.json"),
      JSON.stringify({
        country,
        scraper: scraperNames[country] || existing?.scraper || "Scraped",
        lastScraped: new Date().toISOString(),
        routeCount: metadataRoutes.length,
        routes: metadataRoutes,
      }, null, 2),
      "utf-8",
    );

    return {
      country,
      routeCount: metadataRoutes.length,
      resultCount,
    };
  });
}
