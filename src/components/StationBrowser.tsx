import { ArrowLeft, Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions } from "../data/countries";
import type { Country } from "../types";

interface StationBrowserProps {
  country: Country;
  target: "origin" | "destination";
  onBack: () => void;
  onCountryChange: (country: Country) => void;
  onSelectStation: (station: string) => void;
}

export function StationBrowser({
  country,
  target,
  onBack,
  onCountryChange,
  onSelectStation,
}: StationBrowserProps) {
  const { t } = useTranslation();
  const [stations, setStations] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchStations = async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const res = await fetch(`/api/transit/stations?country=${country}`);
        const data = await res.json();
        if (active && res.ok) {
          setStations(data.stations || []);
        } else if (active) {
          setStations([]);
          setLoadFailed(true);
        }
      } catch {
        if (active) {
          setStations([]);
          setLoadFailed(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchStations();
    return () => {
      active = false;
    };
  }, [country]);

  const filteredStations = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return stations;
    return stations.filter((station) => {
      const translated = t(`station.${station}`, { defaultValue: station }).toLowerCase();
      return station.toLowerCase().includes(value) || translated.includes(value);
    });
  }, [query, stations, t]);

  const featured = countryConfig[country].featuredStations;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
      <section className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white sm:h-[80vh] sm:max-w-md shadow-2xl">
        <div className="shrink-0 p-4 border-b border-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-black text-orange-600">{t("stations.title")}</h1>
              <p className="text-xs font-semibold text-slate-500">
                {target === "origin" ? t("stations.pick_origin") : t("stations.pick_destination")}
              </p>
            </div>
            <div className="h-10 w-10" />
          </div>

          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {countryOptions.map((item) => (
              <button
                key={item}
                onClick={() => {
                  onCountryChange(item);
                  setQuery("");
                }}
                className={`rounded-xl py-2 text-sm font-bold ${
                  country === item ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"
                }`}
              >
                {t(countryConfig[item].labelKey)}
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-slate-500">
            <Search className="h-5 w-5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("stations.search_placeholder")}
              className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-12">
          {featured.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {featured.map((station) => (
                <button
                  key={station}
                  onClick={() => onSelectStation(station)}
                  className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"
                >
                  {t(`station.${station}`, { defaultValue: station })}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 divide-y divide-slate-100">
            {isLoading ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-500">{t("stations.loading")}</p>
            ) : loadFailed ? (
              <p className="py-8 text-center text-sm font-semibold text-red-600">{t("stations.unavailable")}</p>
            ) : filteredStations.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-500">{t("stations.none")}</p>
            ) : (
              filteredStations.map((station) => (
                <button
                  key={station}
                  onClick={() => onSelectStation(station)}
                  className="flex w-full items-center justify-between py-3 text-left hover:bg-slate-50"
                >
                  <span className="truncate pr-2">
                    <span className="block text-base font-black text-slate-950 truncate">
                      {t(`station.${station}`, { defaultValue: station })}
                    </span>
                    <span className="block text-xs text-slate-400">{countryConfig[country].provider}</span>
                  </span>
                  <Check className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
