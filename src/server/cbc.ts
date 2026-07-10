const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/csv, */*",
  "Accept-Language": "zh-TW,zh-CN;q=0.9,zh;q=0.8,en;q=0.7",
  Referer: "https://www.cbc.gov.tw/",
};

export interface CbcRates {
  base: "TWD";
  rates: Record<string, number>;
  updatedAt: string;
  /** Whether the response was fetched during this request or is a last-known-good value. */
  cacheStatus: "fresh" | "stale";
  /** The age of the gateway cache, rounded down to seconds. */
  cacheAgeSeconds: number;
}

interface CachedCbcRates {
  base: "TWD";
  rates: Record<string, number>;
  updatedAt: string;
  fetchedAt: number;
}

let cached: CachedCbcRates | null = null;
let inFlightFetch: Promise<CachedCbcRates | null> | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

function now(): number {
  return Date.now();
}

export async function getCbcRates(): Promise<CbcRates | null> {
  if (cached && now() - cached.fetchedAt < CACHE_TTL_MS) {
    return withCacheMetadata(cached, "fresh");
  }

  if (!inFlightFetch) {
    inFlightFetch = refreshCbcRates().finally(() => {
      inFlightFetch = null;
    });
  }

  const refreshed = await inFlightFetch;
  if (refreshed) {
    cached = refreshed;
    return withCacheMetadata(refreshed, "fresh");
  }

  // An upstream outage must not make price conversion disappear. Returning the
  // last successful snapshot is safer than silently substituting made-up rates.
  if (cached && now() - cached.fetchedAt < STALE_CACHE_TTL_MS) {
    return withCacheMetadata(cached, "stale");
  }

  return null;
}

function withCacheMetadata(snapshot: CachedCbcRates, cacheStatus: CbcRates["cacheStatus"]): CbcRates {
  return {
    base: snapshot.base,
    rates: snapshot.rates,
    updatedAt: snapshot.updatedAt,
    cacheStatus,
    cacheAgeSeconds: Math.floor((now() - snapshot.fetchedAt) / 1000),
  };
}

async function refreshCbcRates(): Promise<CachedCbcRates | null> {
  try {
    const result = await tryJsonApi();
    if (result) {
      return result;
    }
  } catch { /* fall through */ }

  try {
    return await tryCsvSource();
  } catch { /* fall through */ }

  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function tryJsonApi(): Promise<CachedCbcRates | null> {
  const url = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BP01D01en";
  const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
  if (!res.ok) return null;

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  const series = data?.DataSet?.Series ?? data?.dataset?.series ?? data?.series;
  if (!Array.isArray(series) || series.length === 0) return null;

  const latest = series[0];
  const values: (string | number)[] = latest?.values ?? latest?.VALUES ?? latest?.Value ?? [];
  if (!Array.isArray(values) || values.length < 2) return null;

  const dateStr = String(values[0]);

  const columnLabels: string[] = series.map((s: any) => {
    const id = s?.seriesCode ?? s?.id ?? s?.ID ?? "";
    return String(id);
  });

  const usdToTwd = parseFloat(String(values[1]));
  if (isNaN(usdToTwd) || usdToTwd <= 0) return null;

  const rates: Record<string, number> = { TWD: 1 };

  const currencyMap: Record<string, string> = {
    "USD/TWD": "USD",
    "JPY/USD": "JPY",
    "USD/GBP": "GBP",
    "HKD/USD": "HKD",
    "KRW/USD": "KRW",
    "SGD/USD": "SGD",
    "CNY/USD": "CNY",
    "EUR/USD": "EUR",
    "USD/EUR": "EUR",
    "THB/USD": "THB",
    "MYR/USD": "MYR",
    "CHF/USD": "CHF",
    "AUD/USD": "AUD",
    "USD/AUD": "AUD",
    "CAD/USD": "CAD",
    "USD/CAD": "CAD",
    "NZD/USD": "NZD",
    "USD/NZD": "NZD",
    "PHP/USD": "PHP",
    "IDR/USD": "IDR",
    "VND/USD": "VND",
    "SEK/USD": "SEK",
    "USD/SEK": "SEK",
    "NOK/USD": "NOK",
    "USD/NOK": "NOK",
    "DKK/USD": "DKK",
    "USD/DKK": "DKK",
    "PLN/USD": "PLN",
    "USD/PLN": "PLN",
    "TRY/USD": "TRY",
    "USD/TRY": "TRY",
    "ZAR/USD": "ZAR",
    "USD/ZAR": "ZAR",
    "BRL/USD": "BRL",
    "USD/BRL": "BRL",
    "MXN/USD": "MXN",
    "USD/MXN": "MXN",
    "RUB/USD": "RUB",
    "USD/RUB": "RUB",
    "INR/USD": "INR",
    "USD/INR": "INR",
    "SAR/USD": "SAR",
    "USD/SAR": "SAR",
    "AED/USD": "AED",
    "USD/AED": "AED",
    "ILS/USD": "ILS",
    "USD/ILS": "ILS",
    "CZK/USD": "CZK",
    "USD/CZK": "CZK",
    "HUF/USD": "HUF",
    "USD/HUF": "HUF",
    "RON/USD": "RON",
    "USD/RON": "RON",
  };

  for (let i = 0; i < values.length && i < columnLabels.length; i++) {
    const label = columnLabels[i];
    const raw = parseFloat(String(values[i]));
    if (isNaN(raw) || raw <= 0) continue;

    let targetCurrency: string | undefined;

    if (label.includes("NTD/USD") || label.includes("TWD/USD")) {
      rates.USD = 1 / usdToTwd;
      continue;
    }

    for (const [pattern, currency] of Object.entries(currencyMap)) {
      if (label.includes(pattern)) {
        targetCurrency = currency;
        break;
      }
    }

    if (targetCurrency) {
      if (label.startsWith("USD/") || label.includes("USD/")) {
        rates[targetCurrency] = usdToTwd / raw;
      } else if (label.includes("/USD")) {
        const perUsd = raw;
        const perTwd = perUsd / usdToTwd;
        rates[targetCurrency] = 1 / perTwd;
      }
    }
  }

  if (Object.keys(rates).length <= 1) return null;

  return { base: "TWD", rates, updatedAt: dateStr, fetchedAt: now() };
}

async function tryCsvSource(): Promise<CachedCbcRates | null> {
  const urls = [
    "https://www.cbc.gov.tw/public/data/foreign_exchange.csv",
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;

      const csv = await res.text();
      const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const rates: Record<string, number> = { TWD: 1 };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 5) continue;

        const currencyCode = cols[1]?.replace(/"/g, "").trim().toUpperCase();
        const spotBuying = parseFloat(cols[3]?.replace(/"/g, "").trim());
        const spotSelling = parseFloat(cols[4]?.replace(/"/g, "").trim());

        if (isNaN(spotBuying) || isNaN(spotSelling) || spotBuying <= 0) continue;

        const midRate = (spotBuying + spotSelling) / 2;

        const currencyMap: Record<string, string> = {
          USD: "USD", JPY: "JPY", HKD: "HKD", GBP: "GBP",
          EUR: "EUR", KRW: "KRW", SGD: "SGD", THB: "THB",
          CHF: "CHF", CNY: "CNY", AUD: "AUD", CAD: "CAD",
          NZD: "NZD", MYR: "MYR", IDR: "IDR", PHP: "PHP",
          VND: "VND", SEK: "SEK", NOK: "NOK", DKK: "DKK",
          PLN: "PLN", TRY: "TRY", ZAR: "ZAR", BRL: "BRL",
          MXN: "MXN", RUB: "RUB", INR: "INR", SAR: "SAR",
          AED: "AED", ILS: "ILS", CZK: "CZK", HUF: "HUF",
          RON: "RON",
        };

        const mapped = currencyMap[currencyCode];
        if (mapped) {
          rates[mapped] = 1 / midRate;
        }
      }

      if (Object.keys(rates).length <= 1) continue;

      const dateMatch = csv.match(/(\d{4})[/-]?(\d{2})[/-]?(\d{2})/);
      const updatedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString();

      return { base: "TWD", rates, updatedAt, fetchedAt: now() };
    } catch {
      continue;
    }
  }

  return null;
}

export function clearCbcCache() {
  cached = null;
  inFlightFetch = null;
}
