import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, Sun, CloudRain, Snowflake, Loader2 } from "lucide-react";
import type { Country } from "../types";
import { stationLabel } from "../utils/stationLabel";

interface WeatherWidgetProps {
  destination: string;
  date: string;
  country?: Country;
}

interface WeatherData {
  temp: number;
  description: string;
  code: number;
}

export function WeatherWidget({ destination, date, country }: WeatherWidgetProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchWeather() {
      try {
        setLoading(true);
        setError(false);

        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          throw new Error("City not found");
        }
        
        const { latitude, longitude } = geoData.results[0];
        
        let targetDate = date;
        if (!targetDate) {
          targetDate = new Date().toISOString().split("T")[0];
        }

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${targetDate}&end_date=${targetDate}`);
        if (!weatherRes.ok) throw new Error("Weather fetch failed");
        
        const weatherJson = await weatherRes.json();
        
        if (!weatherJson.daily || !weatherJson.daily.weathercode || weatherJson.daily.weathercode.length === 0) {
          throw new Error("No forecast for date");
        }

        const code = weatherJson.daily.weathercode[0];
        const tempMax = weatherJson.daily.temperature_2m_max[0];
        const tempMin = weatherJson.daily.temperature_2m_min[0];
        const avgTemp = (tempMax + tempMin) / 2;

        if (active) {
          setData({
            temp: Math.round(avgTemp),
            description: getWeatherDesc(code),
            code: code,
          });
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchWeather();

    return () => {
      active = false;
    };
  }, [destination, date]);

  const getWeatherDesc = (code: number) => {
    if (code === 0) return "Clear";
    if (code === 1 || code === 2 || code === 3) return "Partly Cloudy";
    if (code === 45 || code === 48) return "Fog";
    if (code >= 51 && code <= 67) return "Rain";
    if (code >= 71 && code <= 77) return "Snow";
    if (code >= 80 && code <= 82) return "Showers";
    if (code >= 85 && code <= 86) return "Snow Showers";
    if (code >= 95) return "Storm";
    return "Unknown";
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="h-5 w-5 text-amber-500" />;
    if (code === 1 || code === 2 || code === 3) return <Cloud className="h-5 w-5 text-slate-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="h-5 w-5 text-blue-500" />;
    if (code >= 71 && code <= 77) return <Snowflake className="h-5 w-5 text-sky-400" />;
    if (code >= 80 && code <= 82) return <CloudRain className="h-5 w-5 text-blue-500" />;
    if (code >= 85 && code <= 86) return <Snowflake className="h-5 w-5 text-sky-400" />;
    if (code >= 95) return <CloudRain className="h-5 w-5 text-purple-500" />;
    return <Cloud className="h-5 w-5 text-slate-400" />;
  };

  if (error) return null;

  const weatherDescription = data
    ? t(`weather.${data.description.toLowerCase().replace(" ", "_")}`, { defaultValue: data.description })
    : null;

  return (
    <div
      data-weather-compact="true"
      role="status"
      aria-label={data
        ? `${stationLabel(t, destination, country)} ${data.temp}°C, ${weatherDescription}`
        : t("result.forecast_loading", { defaultValue: "Forecast..." })}
      className="m3-label-large flex min-h-10 shrink-0 items-center justify-center gap-1.5 px-1.5 text-slate-700 dark:text-slate-200"
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-slate-400" />
      ) : data ? (
        <>
          <span aria-hidden="true">{getWeatherIcon(data.code)}</span>
          <span>{data.temp}°C</span>
        </>
      ) : null}
    </div>
  );
}
