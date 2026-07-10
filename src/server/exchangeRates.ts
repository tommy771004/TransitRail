/**
 * Cache the secondary exchange-rate provider independently of the CBC source.
 * A serverless instance can disappear at any time, so the API response also
 * carries CDN cache headers in server.ts. This module prevents duplicate fetches
 * while an instance is warm and preserves a last-known-good response during an
 * upstream outage.
 */
export interface ExternalExchangeRates {
  base: string;
  rates: Record<string, number>;
  source: "er-api";
  cacheStatus: "fresh" | "stale";
  cacheAgeSeconds: number;
}

interface CachedExternalRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const FRESH_TTL_MS = 30 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const cache = new Map<string, CachedExternalRates>();
const inFlight = new Map<string, Promise<CachedExternalRates | null>>();

function now() {
  return Date.now();
}

function withMetadata(snapshot: CachedExternalRates, cacheStatus: ExternalExchangeRates["cacheStatus"]): ExternalExchangeRates {
  return {
    base: snapshot.base,
    rates: snapshot.rates,
    source: "er-api",
    cacheStatus,
    cacheAgeSeconds: Math.floor((now() - snapshot.fetchedAt) / 1000),
  };
}

async function fetchRates(base: string): Promise<CachedExternalRates | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("rates" in data) || !data.rates || typeof data.rates !== "object") {
      return null;
    }

    const rates = Object.fromEntries(
      Object.entries(data.rates).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value > 0),
    );
    if (Object.keys(rates).length === 0) return null;

    return { base, rates, fetchedAt: now() };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getExternalExchangeRates(base: string): Promise<ExternalExchangeRates | null> {
  const existing = cache.get(base);
  if (existing && now() - existing.fetchedAt < FRESH_TTL_MS) {
    return withMetadata(existing, "fresh");
  }

  let request = inFlight.get(base);
  if (!request) {
    request = fetchRates(base).finally(() => inFlight.delete(base));
    inFlight.set(base, request);
  }

  const refreshed = await request;
  if (refreshed) {
    cache.set(base, refreshed);
    return withMetadata(refreshed, "fresh");
  }

  if (existing && now() - existing.fetchedAt < STALE_TTL_MS) {
    return withMetadata(existing, "stale");
  }
  return null;
}
