import { ArrowLeftRight, CalendarDays, DatabaseZap, Star, Search, MapPin, History } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions, providerDateValue, countryThemes } from "../data/countries";
import type { Country, SearchHistoryItem, SearchParams, FavoriteRoute } from "../types";
import { triggerHaptic } from "../utils/haptics";

const getDayLabel = (date: Date, offset: number) => {
  if (offset === 0) return "今天";
  if (offset === 1) return "明天";
  if (offset === 2) return "後天";
  const days = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return days[date.getDay()];
};

const generateDates = (start: Date, count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const formatDateValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

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
  const theme = countryThemes[country] || countryThemes.japan;

  const frequentRoutes = useMemo(() => {
    const routes = recentHistory.filter(h => h.country === country);
    const frequencies = new Map<string, { origin: string; destination: string; count: number }>();
    for (const route of routes) {
      const key = `${route.origin}|${route.destination}`;
      if (!frequencies.has(key)) {
        frequencies.set(key, { origin: route.origin, destination: route.destination, count: 0 });
      }
      frequencies.get(key)!.count++;
    }
    return Array.from(frequencies.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [recentHistory, country]);

  const isFavorited = favorites.some(
    (f) => f.origin === origin && f.destination === destination && f.country === country
  );

  const handleToggleFavorite = () => {
    if (!origin || !destination) return;
    triggerHaptic(isFavorited ? "light" : "success");
    onToggleFavorite(origin, destination, country);
  };

  const updateParam = (key: keyof SearchParams, value: string) => {
    onChange({ ...params, [key]: value });
  };

  const swapStations = () => {
    triggerHaptic("medium");
    onChange({ ...params, origin: destination, destination: origin });
  };

  const handleSubmit = async () => {
    if (!origin.trim() || !destination.trim()) {
      triggerHaptic("error");
      setFormError(t("search.validation_required"));
      return;
    }
    if (origin.trim() === destination.trim()) {
      triggerHaptic("error");
      setFormError(t("search.validation_same_station"));
      return;
    }
    triggerHaptic("medium");
    setFormError(null);
    const submitDate = config.liveOnly ? providerDateValue(country) : date;
    await onSearch(origin.trim(), destination.trim(), submitDate, country);
  };

  const handleAiPlan = () => {
    triggerHaptic("light");
    window.open("https://roam-jelly-web.vercel.app/", "_blank", "noopener,noreferrer");
  };

  return (
    <main className={`min-h-screen bg-slate-50/40 bg-gradient-to-tr ${theme.primaryBgLight} px-4 pb-28 pt-20 transition-all duration-500 dark:bg-[#0b1220] ${theme.primaryBgDark}`}>
      <section className="mx-auto max-w-md">

        {/* Country Selector */}
        <div className="flex gap-1.5 overflow-x-auto soft-scrollbar pb-2 mb-4 p-1 bg-slate-100/50 rounded-2xl border border-slate-200/40 dark:bg-slate-900/40 dark:border-slate-800/60">
          {countryOptions.map((item) => (
            <button
              key={item}
              onClick={() => {
                triggerHaptic("light");
                onChange({
                  origin: "",
                  destination: "",
                  date: providerDateValue(item),
                  country: item,
                });
                setFormError(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                country === item
                  ? `${countryThemes[item].buttonBg} text-white ${countryThemes[item].buttonShadow} scale-[1.02]`
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t(countryConfig[item].labelKey)}
            </button>
          ))}
        </div>

        {/* Main Search Card */}
        <div className="rounded-[28px] border border-slate-100 bg-white/80 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:border-slate-800/80 dark:bg-slate-900/80">
          <div className="relative p-6">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenStations("origin");
                }}
                className="flex flex-1 flex-col items-center group focus:outline-none py-2 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${theme.textActive} opacity-70`}>
                  <MapPin className="h-3 w-3" />
                  {t("search.origin")}
                </div>
                <div className={`text-2xl font-black tracking-tight ${origin ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-700"} transition-all duration-300 group-hover:scale-[1.02]`}>
                  {origin ? t(`station.${origin}`, { defaultValue: origin }) : t("search.select_origin", { defaultValue: "Select" })}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {origin || "DEP"}
                </div>
              </button>

              <div className="relative z-10 flex shrink-0 items-center justify-center px-1">
                <button
                  type="button"
                  onClick={swapStations}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:scale-110 active:scale-95 dark:border-slate-800 dark:bg-slate-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${theme.textActive}`}
                  aria-label={t("search.swap")}
                >
                  <ArrowLeftRight className="h-4.5 w-4.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenStations("destination");
                }}
                className="flex flex-1 flex-col items-center group focus:outline-none py-2 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${theme.textActive} opacity-70`}>
                  <MapPin className="h-3 w-3" />
                  {t("search.destination")}
                </div>
                <div className={`text-2xl font-black tracking-tight ${destination ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-700"} transition-all duration-300 group-hover:scale-[1.02]`}>
                  {destination ? t(`station.${destination}`, { defaultValue: destination }) : t("search.select_dest", { defaultValue: "Select" })}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {destination || "ARR"}
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100/80 p-5 dark:border-slate-800/60">
            {config.liveOnly ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50/50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                <span>{t("search.live_today")}</span>
                <span className="ml-auto font-mono text-slate-400 dark:text-slate-500">{date}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t("search.date_of_travel", { defaultValue: "出發日期" })}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">SCROLL &rarr;</span>
                </div>
                
                <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory hide-scrollbar">
                  {generateDates(new Date(), 14).map((d, idx) => {
                    const dateValue = formatDateValue(d);
                    const isSelected = date === dateValue;
                    const monthStr = `${String(d.getMonth() + 1).padStart(2, "0")}月`;
                    const dayStr = `${String(d.getDate()).padStart(2, "0")}日`;
                    const label = getDayLabel(d, idx);
                    
                    return (
                      <button
                        key={dateValue}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          updateParam("date", dateValue);
                        }}
                        className={`flex min-w-[72px] shrink-0 snap-start flex-col items-center justify-center rounded-[20px] p-3 text-center transition-all ${
                          isSelected
                            ? "bg-[#2563eb] text-white shadow-md"
                            : "bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span className={`mb-1.5 text-[10px] font-bold ${isSelected ? "text-blue-100" : "text-slate-400 dark:text-slate-400"}`}>{label}</span>
                        <span className="text-[15px] font-black leading-tight tracking-tight">{monthStr}</span>
                        <span className="text-[15px] font-black leading-tight tracking-tight">{dayStr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {formError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50/75 px-4 py-2.5 text-xs font-semibold text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400">
                {formError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSearching}
                className={`h-12 flex-1 rounded-2xl ${theme.buttonBg} text-sm font-bold text-white ${theme.buttonShadow} hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 disabled:cursor-not-allowed`}
              >
                {isSearching ? t("search.searching") : t("search.realtime_search")}
              </button>
              {origin.trim() && destination.trim() && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50 active:scale-95 transition-all dark:border-slate-800 dark:bg-slate-800 dark:hover:text-amber-400 dark:hover:border-amber-700 dark:hover:bg-amber-900/20"
                  title={isFavorited ? "Remove from Favorites" : "Save to Favorites"}
                >
                  <Star className={`h-5 w-5 ${isFavorited ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""}`} />
                </button>
              )}
            </div>

            {frequentRoutes.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                  {t("search.quick_access", { defaultValue: "Quick Access" })}
                </label>
                <div className="flex flex-wrap gap-2">
                  {frequentRoutes.map((route, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onChange({ ...params, origin: route.origin, destination: route.destination });
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/60 transition-all duration-200"
                    >
                      {t(`station.${route.origin}`, { defaultValue: route.origin })}
                      <span className="text-slate-300 dark:text-slate-600">&rarr;</span>
                      {t(`station.${route.destination}`, { defaultValue: route.destination })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic, humble credits/attribution under the search form instead of status bar AI-slop */}
        <div className="mt-3.5 text-center">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500">
            {t("search.data_source")}: <span className="text-slate-500 dark:text-slate-400">{config.provider}</span>
          </span>
        </div>

        {favorites.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
              {t("favorites.title", { defaultValue: "Favorite Routes" })}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white overflow-hidden dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
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
                    <span className={`mt-0.5 block font-mono text-[11px] font-bold ${countryThemes[fav.country]?.textActive || "text-slate-400"}`}>
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
            <div className="mt-3 divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
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
                      {item.date} · <span className={`font-bold ${countryThemes[item.country]?.textActive || ""}`}>{t(countryConfig[item.country].labelKey)}</span>
                    </span>
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <a
            href="https://roam-jelly-web.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-3xl py-3 px-3 text-center text-[13px] font-bold bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-200/50 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400 shadow-sm transition-all"
          >
            {/* Cute SVG Roam Jelly Ghost Icon */}
            <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 rounded-md shadow-sm">
              <defs>
                <linearGradient id="jelly-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF71A4" />
                  <stop offset="50%" stopColor="#E254EC" />
                  <stop offset="100%" stopColor="#5D5CFF" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="28" fill="url(#jelly-grad)" />
              <path d="M 23 35 Q 23 38 20 38 Q 23 38 23 41 Q 23 38 26 38 Q 23 38 23 35 Z" fill="#FFFFFF" />
              <path d="M 20 73 Q 20 75 18 75 Q 20 75 20 77 Q 20 75 22 75 Q 20 75 20 73 Z" fill="#FFFFFF" opacity="0.8" />
              <path d="M 30 70 C 30 46, 70 46, 70 70 C 70 73, 66 75, 63 71 C 60 67.5, 56 67.5, 53 71 C 50 74.5, 46 74.5, 43 71 C 40 67.5, 36 67.5, 33 71 C 31 73, 30 72, 30 70 Z" fill="#FFFFFF" />
              <ellipse cx="38" cy="62" rx="4.5" ry="3" fill="#FF8DA1" opacity="0.8" />
              <ellipse cx="62" cy="62" rx="4.5" ry="3" fill="#FF8DA1" opacity="0.8" />
              <circle cx="44" cy="57" r="3" fill="#2E3A59" />
              <circle cx="56" cy="57" r="3" fill="#2E3A59" />
              <circle cx="45" cy="56" r="0.9" fill="#FFFFFF" />
              <circle cx="57" cy="56" r="0.9" fill="#FFFFFF" />
              <path d="M 48 61.5 Q 50 63 52 61.5" stroke="#2E3A59" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 72 23 C 68.5 23, 66 25.5, 66 29 C 66 33.5, 72 40, 72 40 C 72 40, 78 33.5, 78 29 C 78 25.5, 75.5 23, 72 23 Z" fill="#FF5E7E" />
              <circle cx="72" cy="29" r="2.2" fill="#FFFFFF" />
            </svg>
            <span className="truncate">{t("search.plan_ai", { defaultValue: "AI 行程規劃" })}</span>
          </a>

          <a
            href="https://taiwanrail.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-3xl py-3 px-3 text-center text-[13px] font-bold bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-200/50 text-blue-700 dark:border-blue-500/30 dark:text-blue-400 shadow-sm transition-all"
          >
            <MapPin className="h-5 w-5 shrink-0" />
            <span className="truncate">台/鐵/捷運 查詢</span>
          </a>
        </div>
      </section>
    </main>
  );
}


