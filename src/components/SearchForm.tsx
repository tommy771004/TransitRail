import { ArrowUpDown, CalendarDays, DatabaseZap, Star, Search, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions, providerDateValue } from "../data/countries";
import type { Country, SearchHistoryItem, SearchParams, FavoriteRoute } from "../types";

interface SearchFormProps {
  params: SearchParams;
  isSearching: boolean;
  recentHistory: SearchHistoryItem[];
  favorites: FavoriteRoute[];
  onToggleFavorite: (origin: string, destination: string, country: Country) => void;
  onRemoveFavorite: (id: string) => void;
  onRepeatFavoriteSearch: (fav: FavoriteRoute) => void;
  onChange: (params: SearchParams) => void;
  onSearch: (origin: string, destination: string, date: string, country: Country) => Promise<void>;
  onOpenStations: (target: "origin" | "destination") => void;
  onOpenWorkflow: () => void;
  onRepeatSearch: (item: SearchHistoryItem) => void;
}

export function SearchForm({
  params,
  isSearching,
  recentHistory,
  favorites,
  onToggleFavorite,
  onRemoveFavorite,
  onRepeatFavoriteSearch,
  onChange,
  onSearch,
  onOpenStations,
  onOpenWorkflow,
  onRepeatSearch,
}: SearchFormProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const origin = params.origin;
  const destination = params.destination;
  const country = params.country;
  const config = countryConfig[country];
  const date = config.liveOnly ? providerDateValue(country) : (params.date || providerDateValue(country));

  const isFavorited = favorites.some(
    (f) => f.origin === origin && f.destination === destination && f.country === country
  );

  const handleToggleFavorite = () => {
    if (!origin || !destination) return;
    onToggleFavorite(origin, destination, country);
  };

  const updateParam = (key: keyof SearchParams, value: string) => {
    onChange({ ...params, [key]: value });
  };

  const swapStations = () => {
    onChange({ ...params, origin: destination, destination: origin });
  };

  const handleSubmit = async () => {
    if (!origin.trim() || !destination.trim()) {
      setFormError(t("search.validation_required"));
      return;
    }
    if (origin.trim() === destination.trim()) {
      setFormError(t("search.validation_same_station"));
      return;
    }
    setFormError(null);
    const submitDate = config.liveOnly ? providerDateValue(country) : date;
    await onSearch(origin.trim(), destination.trim(), submitDate, country);
  };

  const handleAiPlan = async () => {
    if (!origin.trim() || !destination.trim()) {
      setFormError(t("search.validation_required"));
      return;
    }
    setIsAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `請用繁體中文規劃${config.promptName}鐵路旅程：${origin} 到 ${destination}，日期 ${date}。請說明建議路線、轉乘提醒與查詢即時班次時需要的資料欄位。`,
        }),
      });
      const data = await res.json();
      setAiResult(res.ok ? data.result : data.error || t("search.ai_failed"));
    } catch {
      setAiResult(t("alerts.network_error_body"));
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-20 dark:bg-[#0b1220]">
      <section className="mx-auto max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("search.title")}</h1>
            <p className="text-[11px] font-medium text-slate-400">{t("search.subtitle", { defaultValue: "Real-time transit schedules" })}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {countryOptions.map((item) => (
            <button
              key={item}
              onClick={() => {
                onChange({
                  origin: "",
                  destination: "",
                  date: providerDateValue(item),
                  country: item,
                });
                setFormError(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all ${
                country === item
                  ? "bg-emerald-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
              }`}
            >
              {t(countryConfig[item].labelKey)}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="relative p-4 sm:p-5">
            <div className="grid grid-cols-[14px_1fr] gap-x-3">
              <div className="flex flex-col items-center pt-3.5">
                <span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-emerald-500 bg-white dark:bg-slate-900" />
                <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              </div>
              <div>
                <StationField
                  label={t("search.origin")}
                  value={origin}
                  placeholder={config.originPlaceholder}
                  onChange={(val) => updateParam("origin", val)}
                  onSelect={(val) => updateParam("origin", val)}
                  country={country}
                  onBrowse={() => onOpenStations("origin")}
                />
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <StationField
                  label={t("search.destination")}
                  value={destination}
                  placeholder={config.destinationPlaceholder}
                  onChange={(val) => updateParam("destination", val)}
                  onSelect={(val) => updateParam("destination", val)}
                  country={country}
                  onBrowse={() => onOpenStations("destination")}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={swapStations}
              className="absolute right-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-emerald-400 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
              aria-label={t("search.swap")}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          <div className="border-t border-slate-100 p-4 sm:p-5 dark:border-slate-800">
            {config.liveOnly ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{t("search.live_today")}</span>
                <span className="ml-auto font-mono text-xs text-slate-400">{date}</span>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => updateParam("date", event.target.value)}
                  className="w-full bg-transparent font-bold text-slate-900 outline-none dark:text-white"
                />
              </label>
            )}

            {formError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {formError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSearching}
                className="h-12 flex-1 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 disabled:cursor-not-allowed dark:shadow-[0_4px_14px_rgba(16,185,129,0.15)]"
              >
                {isSearching ? t("search.searching") : t("search.realtime_search")}
              </button>
              {origin.trim() && destination.trim() && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50 active:scale-95 transition-all dark:border-slate-700 dark:bg-slate-800 dark:hover:text-amber-400 dark:hover:border-amber-700 dark:hover:bg-amber-900/20"
                  title={isFavorited ? "Remove from Favorites" : "Save to Favorites"}
                >
                  <Star className={`h-5 w-5 ${isFavorited ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenWorkflow}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-left dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <DatabaseZap className="h-4 w-4 text-slate-400" />
            <span>
              {t("search.data_source")}{" "}
              <span className="font-bold text-slate-900 dark:text-white">{config.provider}</span>
            </span>
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-bold ${
            config.connected ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${config.connected ? "bg-emerald-600" : "bg-amber-500"}`} />
            {config.connected ? t("search.connected") : t("search.adapter_pending")}
          </span>
        </button>

        {favorites.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
              {t("favorites.title", { defaultValue: "Favorite Routes" })}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center justify-between bg-white hover:bg-slate-50 transition-colors dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => onRepeatFavoriteSearch(fav)}
                    className="flex-1 min-w-0 text-left px-5 py-3.5"
                  >
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {t(`station.${fav.origin}`, { defaultValue: fav.origin })}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {t(`station.${fav.destination}`, { defaultValue: fav.destination })}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                      {t(countryConfig[fav.country].labelKey)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFavorite(fav.id)}
                    className="flex h-12 w-12 items-center justify-center text-amber-400 hover:text-slate-300 transition-colors shrink-0"
                    title="Remove from Favorites"
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {recentHistory.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
              {t("history.recent")}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {recentHistory.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onRepeatSearch(item)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {t(`station.${item.origin}`, { defaultValue: item.origin })}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {t(`station.${item.destination}`, { defaultValue: item.destination })}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                      {item.date} · {t(countryConfig[item.country].labelKey)}
                    </span>
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          onClick={handleAiPlan}
          disabled={isAiLoading}
          className="mt-6 w-full rounded-2xl py-3 text-center text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-emerald-600 hover:decoration-emerald-300 disabled:opacity-50 transition-colors dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-emerald-400"
        >
          {isAiLoading ? t("search.thinking") : t("search.plan_ai")}
        </button>

        {aiResult && (
          <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {aiResult}
          </div>
        )}
      </section>
    </main>
  );
}

interface StationFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  onSelect: (val: string) => void;
  country: Country;
  onBrowse: () => void;
}

function StationField({
  label,
  value,
  placeholder,
  onChange,
  onSelect,
  country,
  onBrowse,
}: StationFieldProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/transit/stations?country=${country}&q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          const matching = (data.stations || []).filter((station: string) => {
            const translated = t(`station.${station}`, { defaultValue: station }).toLowerCase();
            const valLower = value.toLowerCase();
            return station.toLowerCase().includes(valLower) || translated.includes(valLower);
          });
          setSuggestions(matching.slice(0, 10));
        }
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, country, t]);

  return (
    <div className="relative py-2 pr-12 w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</label>
        <button
          type="button"
          onClick={onBrowse}
          className="text-xs font-bold text-slate-500 hover:text-emerald-600 hover:underline flex items-center gap-1 focus:outline-none dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <Search className="h-3 w-3" />
          {t("stations.browse", { defaultValue: "Browse" })}
        </button>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        placeholder={placeholder}
        className="block w-full bg-transparent text-lg font-black tracking-tight text-slate-900 outline-none placeholder:text-slate-300 border-b-2 border-transparent focus:border-emerald-500 pb-0.5 dark:text-white dark:placeholder:text-slate-600"
      />
      {showSuggestions && (suggestions.length > 0 || isLoading) && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl py-1 dark:border-slate-700 dark:bg-slate-900">
          {isLoading && (
            <div className="px-5 py-3 text-xs text-slate-400 font-bold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
              {t("search.searching", { defaultValue: "Searching..." })}
            </div>
          )}
          {!isLoading && suggestions.map((station) => (
            <button
              key={station}
              type="button"
              onMouseDown={() => {
                onSelect(station);
                setShowSuggestions(false);
              }}
              className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
            >
              <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold truncate">{t(`station.${station}`, { defaultValue: station })}</div>
                {station !== t(`station.${station}`, { defaultValue: station }) && (
                  <div className="text-[10px] text-slate-400 font-mono truncate">{station}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
