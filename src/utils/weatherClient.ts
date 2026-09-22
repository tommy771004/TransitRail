// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The destination forecast behind the result header, fetched once per
// destination and day for the session instead of on every result view.

import { createPromiseCache } from "./requestCache";

export interface DestinationWeather {
  /** Midpoint of the day's high and low, rounded. */
  temp: number;
  /** WMO weather code. */
  code: number;
}

const FORECAST_TTL_MS = 30 * 60 * 1000;
const cache = createPromiseCache<DestinationWeather>(FORECAST_TTL_MS);

async function fetchForecast(destination: string, date: string): Promise<DestinationWeather> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`);
  if (!geoRes.ok) throw new Error("Geocoding failed");
  const geoData = await geoRes.json();
  if (!geoData.results || geoData.results.length === 0) throw new Error("City not found");
  const { latitude, longitude } = geoData.results[0];

  const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${date}&end_date=${date}`);
  if (!weatherRes.ok) throw new Error("Weather fetch failed");
  const weatherJson = await weatherRes.json();
  if (!weatherJson.daily || !weatherJson.daily.weathercode || weatherJson.daily.weathercode.length === 0) {
    throw new Error("No forecast for date");
  }
  const code = weatherJson.daily.weathercode[0];
  const tempMax = weatherJson.daily.temperature_2m_max[0];
  const tempMin = weatherJson.daily.temperature_2m_min[0];
  return { temp: Math.round((tempMax + tempMin) / 2), code };
}

/** The forecast for `destination` on `date` (YYYY-MM-DD); today when omitted. */
export function loadDestinationWeather(destination: string, date?: string): Promise<DestinationWeather> {
  const day = date || new Date().toISOString().split("T")[0];
  return cache.get(`${destination}|${day}`, () => fetchForecast(destination, day));
}

export const resetDestinationWeatherCache = () => cache.clear();

// --- End of weatherClient.ts ---
