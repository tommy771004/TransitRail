// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Browser-side loaders for data every screen re-reads but nothing changes
// within a session — the affiliate offers and each market's station catalog.

import type { AffiliateOffer } from "../server/affiliates";
import { createPromiseCache } from "./requestCache";

const OFFERS_TTL_MS = 10 * 60 * 1000;
const offers = createPromiseCache<AffiliateOffer[]>(OFFERS_TTL_MS);

/** The affiliate carousel's offers; one request shared by every carousel on screen. */
export function loadAffiliateOffers(): Promise<AffiliateOffer[]> {
  return offers.get("offers", async () => {
    const response = await fetch("/api/transit/affiliates");
    const payload: { offers?: AffiliateOffer[] } = response.ok ? await response.json() : { offers: [] };
    return Array.isArray(payload.offers) ? payload.offers : [];
  });
}

const CATALOG_TTL_MS = 10 * 60 * 1000;
const catalogs = createPromiseCache<StationCatalogResponse | null>(CATALOG_TTL_MS);

export interface StationCatalogResponse {
  coverage?: { dateRange?: { days?: number; start?: string; end?: string } };
  [key: string]: unknown;
}

/**
 * The station catalog for one market, or null when the API cannot answer.
 * The search form and the result view both read only its coverage range, so
 * a country switch costs one request, not one per screen.
 */
export function loadStationCatalog(country: string): Promise<StationCatalogResponse | null> {
  return catalogs.get(country, async () => {
    const response = await fetch(`/api/transit/stations?country=${encodeURIComponent(country)}`);
    return response.ok ? (await response.json()) as StationCatalogResponse : null;
  });
}

export const resetCatalogClientCaches = () => {
  offers.clear();
  catalogs.clear();
};

// --- End of catalogClient.ts ---
