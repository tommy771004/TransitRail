// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Interactive search form for transit route selection

import { ArrowLeftRight, CalendarDays, Clock3, DatabaseZap, Star, Search, MapPin, History, ChevronDown, Loader2, Navigation, Pin, Sparkles } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions, providerDateValue, providerDateValues, countryThemes, countryFlags } from "../data/countries";
import type { Country, SearchHistoryItem, SearchParams, FavoriteRoute } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel } from "../utils/stationLabel";

const getDayLabel = (date: Date, offset: number, t: any) => {
  if (offset === 0) return t("search.today", { defaultValue: "今天" });
  if (offset === 1) return t("search.tomorrow", { defaultValue: "明天" });
  if (offset === 2) return t("search.day_after_tomorrow", { defaultValue: "後天" });
  const days = [
    t("days.sun", { defaultValue: "週日" }),
    t("days.mon", { defaultValue: "週一" }),
    t("days.tue", { defaultValue: "週二" }),
    t("days.wed", { defaultValue: "週三" }),
    t("days.thu", { defaultValue: "週四" }),
    t("days.fri", { defaultValue: "週五" }),
    t("days.sat", { defaultValue: "週六" }),
  ];
  return days[date.getUTCDay()];
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
  onSearch: (origin: string, destination: string, date: string, country: Country, time?: string) => Promise<void>;
  onOpenStations: (target: "origin" | "destination") => void;
  onOpenWorkflow: () => void;
  onRepeatSearch: (item: SearchHistoryItem) => void;
  onTogglePinHistory: (id: string) => void;
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
  onTogglePinHistory,
}: SearchFormProps) {
  const { t, i18n } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isDetectingCountry, setIsDetectingCountry] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const handleAutoDetectCountry = () => {
    triggerHaptic("medium");
    if (!navigator.geolocation) {
      setDetectError(t("stations.geolocation_unsupported", { defaultValue: "Geolocation is not supported by your browser." }));
      return;
    }
    setIsDetectingCountry(true);
    setDetectError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const countryCenters: Record<Country, { lat: number; lng: number }> = {
          japan: { lat: 36.2048, lng: 138.2529 },
          korea: { lat: 35.9078, lng: 127.7669 },
          hong_kong: { lat: 22.3193, lng: 114.1694 },
          singapore: { lat: 1.3521, lng: 103.8198 },
          malaysia: { lat: 4.2105, lng: 101.9758 },
          thailand: { lat: 15.8700, lng: 100.9925 },
          united_kingdom: { lat: 55.3781, lng: -3.4360 },
          united_states: { lat: 37.0902, lng: -95.7129 },
          germany: { lat: 51.1657, lng: 10.4515 },
          france: { lat: 46.2276, lng: 2.2137 },
          belgium: { lat: 50.5039, lng: 4.4699 },
          norway: { lat: 60.472, lng: 8.4689 },
          switzerland: { lat: 46.8182, lng: 8.2275 },
          china: { lat: 35.8617, lng: 104.1954 },
        };

        let closestCountry: Country = "japan";
        let minDistance = Infinity;

        for (const c of countryOptions) {
          const center = countryCenters[c];
          const dist = Math.pow(latitude - center.lat, 2) + Math.pow(longitude - center.lng, 2);
          if (dist < minDistance) {
            minDistance = dist;
            closestCountry = c as Country;
          }
        }

        triggerHaptic("success");
        onChange({
          origin: "",
          destination: "",
          date: providerDateValue(closestCountry),
          country: closestCountry,
        });
        setIsDetectingCountry(false);
      },
      (error) => {
        setDetectError(t("stations.location_permission_denied", { defaultValue: "Location access denied or failed." }));
        setIsDetectingCountry(false);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  };

  const hotRoutes = useMemo(() => [
    { country: "japan", origin: "Tokyo", destination: "Shin-Osaka", label: t("hot_routes.tokyo_osaka", { defaultValue: "東京 ➔ 新大阪" }) },
    { country: "korea", origin: "Seoul (SNC)", destination: "Busan (BSN)", label: t("hot_routes.seoul_busan", { defaultValue: "首爾 ➔ 釜山" }) },
    { country: "hong_kong", origin: "Central", destination: "Tsuen Wan", label: t("hot_routes.central_tsuenwan", { defaultValue: "中環 ➔ 荃灣" }) },
    { country: "singapore", origin: "Jurong East", destination: "Raffles Place", label: t("hot_routes.jurong_raffles", { defaultValue: "裕廊東 ➔ 萊佛士坊" }) },
    { country: "china", origin: "Beijing South", destination: "Shanghai Hongqiao", label: t("hot_routes.beijing_shanghai", { defaultValue: "北京南 ➔ 上海虹橋" }) },
    { country: "thailand", origin: "Siam", destination: "Mo Chit", label: t("hot_routes.siam_mochit", { defaultValue: "暹羅 ➔ 蒙奇" }) },
    { country: "united_kingdom", origin: "King's Cross St. Pancras Underground Station", destination: "Oxford Circus Underground Station", label: t("hot_routes.kings_oxford", { defaultValue: "國王十字 ➔ 牛津圓環" }) },
    { country: "united_states", origin: "South Station", destination: "Harvard", label: t("hot_routes.south_harvard", { defaultValue: "南站 ➔ 哈佛" }) },
    { country: "germany", origin: "Berlin Hbf", destination: "Munich Hbf", label: t("hot_routes.berlin_munich", { defaultValue: "柏林 ➔ 慕尼黑" }) },
    { country: "france", origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu", label: t("hot_routes.paris_lyon", { defaultValue: "巴黎 ➔ 里昂" }) },
    { country: "switzerland", origin: "Zürich HB", destination: "Genève", label: t("hot_routes.zurich_geneva", { defaultValue: "蘇黎世 ➔ 日內瓦" }) }
  ].filter((route) => countryOptions.includes(route.country as Country)), [t]);

  const row1 = useMemo(() => hotRoutes.slice(0, 5), [hotRoutes]);
  const row2 = useMemo(() => hotRoutes.slice(5), [hotRoutes]);

  const faqs = useMemo(() => [
    {
      q: t("faqs.q0", { defaultValue: "這個網站是免費的嗎？" }),
      a: t("faqs.a0", { defaultValue: "是的，TransitRail 是一個完全免費的全球大眾運輸查詢平台，旨在提供旅客無廣告、乾淨流暢的即時車次與路線規劃服務。" })
    },
    {
      q: t("faqs.q1", { defaultValue: "可以查詢到當日列車即時狀態嗎？" }),
      a: t("faqs.a1", { defaultValue: "可以。我們針對各國鐵道提供即時的班次查詢，且對於特定地區（如新加坡、倫敦、波士頓等）更支援即時到站狀態，讓您掌握最新行車資訊。" })
    },
    {
      q: t("faqs.q2", { defaultValue: "時刻表與班次資料是從哪裡來的？" }),
      a: t("faqs.a2", { defaultValue: "時刻表與班次資料直接介接自各國主流大眾運輸系統與第三方官方資料庫（如 Jorudan、Korail、LTA、MTR、TfL、MBTA、DB、SNCF 與 12306 等），確保查詢結果的高參考價值。" })
    },
    {
      q: t("faqs.q3", { defaultValue: "為什麼有些國家的日期只能選今天？" }),
      a: t("faqs.a3", { defaultValue: "由於部分大眾運輸系統（如新加坡 MRT）採用即時動態 API，僅提供當日即時班次與到站預估，因此該地區的旅行日期將會自動鎖定為今日。" })
    },
    {
      q: t("faqs.q4", { defaultValue: "可以離線使用或儲存常用路線嗎？" }),
      a: t("faqs.a4", { defaultValue: "支援！您可以將常用的路線加入「最愛路線」（點擊搜尋按鈕旁的星號），這些路線將安全地儲存在您的瀏覽器中，方便下次一鍵快速搜尋。" })
    },
    {
      q: t("faqs.q5", { defaultValue: "如何使用 AI 行程規劃功能？" }),
      a: t("faqs.a5", { defaultValue: "點擊下方的「AI 行程規劃」按鈕，系統將引導您至專屬的智慧行程小幫手，為您量身打造跨城市、跨地區的精緻軌道旅行計畫！" })
    }
  ], [t]);
  const origin = params.origin;
  const destination = params.destination;
  const country = params.country;
  const config = countryConfig[country];
  const canSearchTimetable = config.connected;
  const date = config.liveOnly ? providerDateValue(country) : (params.date || providerDateValue(country));
  const theme = countryThemes[country] || countryThemes.japan;

  /**
   * How many days the picker may offer.
   *
   * `config.dateRangeDays` is the market's contract and it moves with the clock
   * every day, while the committed data only moves when the scrape runs — so
   * the last contracted day can have nothing behind it. The station API reports
   * the range it can actually answer; prefer that, and fall back to the
   * contract whenever it is unavailable so a failed request can never shorten
   * the picker on its own.
   */
  const [answerableDays, setAnswerableDays] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setAnswerableDays(undefined);
    fetch(`/api/transit/stations?country=${encodeURIComponent(country)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const days = body?.coverage?.dateRange?.days;
        if (active && typeof days === "number" && days > 0) setAnswerableDays(days);
      })
      .catch(() => { /* keep the contract length; the picker must still work offline */ });
    return () => { active = false; };
  }, [country]);

  const offeredDays = Math.min(answerableDays ?? config.dateRangeDays, config.dateRangeDays);
  const offeredDates = useMemo(
    () => providerDateValues(country, offeredDays),
    [country, offeredDays],
  );

  // A day that just fell out of the offered range must not stay selected.
  useEffect(() => {
    if (config.liveOnly || !params.date) return;
    if (!offeredDates.includes(params.date)) {
      onChange({ ...params, date: offeredDates[0] });
    }
  }, [offeredDates, params.date, config.liveOnly]);

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

  const sortedHistory = useMemo(() => {
    return [...recentHistory].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [recentHistory]);

  const handleToggleFavorite = () => {
    if (!origin || !destination) return;
    triggerHaptic(isFavorited ? "light" : "success");
    onToggleFavorite(origin, destination, country);
  };

  const isFavorited = favorites.some(
    (f) => f.origin === origin && f.destination === destination && f.country === country
  );

  const updateParam = (key: keyof SearchParams, value: string | undefined) => {
    onChange({ ...params, [key]: value });
  };

  const swapStations = () => {
    triggerHaptic("medium");
    onChange({ ...params, origin: destination, destination: origin });
  };

  const handleSubmit = async () => {
    if (!canSearchTimetable) {
      setFormError(t("search.timetable_unavailable", { defaultValue: "這個地區目前提供站點與轉乘資料，尚未提供可查詢的時刻表。" }));
      return;
    }
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
    await onSearch(origin.trim(), destination.trim(), submitDate, country, params.time);
  };

  const handleAiPlan = () => {
    triggerHaptic("light");
    window.open("https://roam-jelly-web.vercel.app/", "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-transparent px-4 pb-28 pt-20 transition-all duration-500">
      <section className="mx-auto max-w-md">

        {/* Country Selector */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100/70 p-1 pb-2 soft-scrollbar dark:bg-slate-900/60">
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
              aria-label={t(countryConfig[item].labelKey)}
              aria-pressed={country === item}
              className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                country === item
                  ? `${countryThemes[item].buttonBg} text-white`
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {countryFlags[item] || ""} {t(countryConfig[item].labelKey)}
            </button>
          ))}
        </div>

        {/* Location detection */}
        <div className="flex justify-between items-center px-1 mb-4">
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            {detectError && <span className="text-red-500 font-semibold">{detectError}</span>}
          </div>
          <button
            type="button"
            onClick={handleAutoDetectCountry}
            disabled={isDetectingCountry}
            aria-busy={isDetectingCountry}
            className="flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:text-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isDetectingCountry ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                <span>{t("search.detecting_country", { defaultValue: "Detecting country..." })}</span>
              </>
            ) : (
              <>
                <Navigation className={`h-3 w-3 ${theme.textActive}`} />
                <span>{t("search.auto_detect_country", { defaultValue: "Detect country" })}</span>
              </>
            )}
          </button>
        </div>

        {/* Main Search Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {/* Stable progress track during network latency */}
          {isSearching && (
            <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-slate-100 dark:bg-slate-800 z-20">
              <div className={`absolute top-0 bottom-0 ${theme.buttonBg} animate-loading-bar`} />
            </div>
          )}
          <div className="relative p-6">
            <div className="relative flex items-center justify-between gap-1">
              {/* Route relationship line */}
              <div className="absolute left-[18%] right-[18%] top-[35%] h-[2px] bg-slate-100 dark:bg-slate-800/60 -translate-y-1/2 pointer-events-none overflow-hidden rounded-full">
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenStations("origin");
                }}
                aria-label={origin ? `${t("search.origin")}: ${stationLabel(t, origin, country)}` : t("search.select_origin", { defaultValue: "Select Departure Station" })}
                className="group z-10 flex min-h-24 flex-1 flex-col items-center justify-center rounded-xl py-2 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-xs font-semibold ${theme.textActive}`}>
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("search.origin")}
                </div>
                <div className={`max-w-full text-xl font-bold leading-tight ${origin ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                  {origin ? stationLabel(t, origin, country) : t("search.select_origin", { defaultValue: "Select" })}
                </div>
                <div className="mt-1 max-w-full truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {origin || "DEP"}
                </div>
              </button>

              <div className="relative z-20 flex shrink-0 items-center justify-center px-1">
                <button
                  type="button"
                  onClick={swapStations}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 ${theme.textActive}`}
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
                aria-label={destination ? `${t("search.destination")}: ${stationLabel(t, destination, country)}` : t("search.select_dest", { defaultValue: "Select Destination Station" })}
                className="group z-10 flex min-h-24 flex-1 flex-col items-center justify-center rounded-xl py-2 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-xs font-semibold ${theme.textActive}`}>
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("search.destination")}
                </div>
                <div className={`max-w-full text-xl font-bold leading-tight ${destination ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                  {destination ? stationLabel(t, destination, country) : t("search.select_dest", { defaultValue: "Select" })}
                </div>
                <div className="mt-1 max-w-full truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {destination || "ARR"}
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100/80 p-5 dark:border-slate-800/60">
            {!canSearchTimetable ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {t("search.station_directory_only", { defaultValue: "Station directory & transfer guidance" })}
                </span>
                <span className="mt-1 block">{t("search.timetable_unavailable", { defaultValue: "這個地區目前提供站點與轉乘資料，尚未提供可查詢的時刻表。" })}</span>
              </div>
            ) : config.liveOnly ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50/50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-700 dark:bg-emerald-400" />
                <span>{t("search.live_today")}</span>
                <span className="ml-auto tabular-nums text-slate-500 dark:text-slate-400">{date}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t("search.date_of_travel", { defaultValue: "出發日期" })}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{t("search.scroll_dates", { defaultValue: "More dates" })}</span>
                </div>
                
                <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory hide-scrollbar">
                  {offeredDates.map((dateValue, idx) => {
                    const d = new Date(`${dateValue}T12:00:00Z`);
                    const isSelected = date === dateValue;
                    const monthStr = i18n.language === "zh-TW" 
                      ? `${String(d.getUTCMonth() + 1).padStart(2, "0")}月`
                      : new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d);
                    const dayStr = i18n.language === "zh-TW"
                      ? `${String(d.getUTCDate()).padStart(2, "0")}日`
                      : String(d.getUTCDate()).padStart(2, "0");
                    const label = getDayLabel(d, idx, t);
                    
                    return (
                      <button
                        key={dateValue}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          updateParam("date", dateValue);
                        }}
                        aria-label={`${label}, ${monthStr} ${dayStr}`}
                        aria-pressed={isSelected}
                        className={`flex min-h-16 min-w-[72px] shrink-0 snap-start flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors ${
                          isSelected
                            ? theme.badgeBg
                            : "bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span className={`mb-1.5 text-[10px] font-bold ${isSelected ? theme.dateLabelSelected : "text-slate-400 dark:text-slate-400"}`}>{label}</span>
                        <span className="text-[15px] font-black leading-tight tracking-tight">{monthStr}</span>
                        <span className="text-[15px] font-black leading-tight tracking-tight">{dayStr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {canSearchTimetable && !config.liveOnly && (
              <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t("search.depart_after", { defaultValue: "最早出發時間" })}
                    </span>
                    <span className="text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                      {t("search.market_time", { timeZone: config.timeZone, defaultValue: `${config.timeZone} local time` })}
                    </span>
                  </div>
                  <label className="flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span className="sr-only">{t("search.custom_time", { defaultValue: "自訂時間" })}</span>
                    <input
                      type="time"
                      value={params.time || ""}
                      onChange={(event) => updateParam("time", event.target.value || undefined)}
                      className="w-[88px] bg-transparent text-right text-base tabular-nums"
                    />
                  </label>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label={t("search.depart_after", { defaultValue: "最早出發時間" })}>
                  {[
                    { value: undefined, label: t("search.time_any", { defaultValue: "不限" }) },
                    { value: "06:00", label: t("search.time_morning", { defaultValue: "清晨" }) },
                    { value: "09:00", label: "09:00" },
                    { value: "12:00", label: "12:00" },
                    { value: "15:00", label: "15:00" },
                    { value: "18:00", label: t("search.time_evening", { defaultValue: "傍晚" }) },
                  ].map((option) => {
                    const selected = (params.time || undefined) === option.value;
                    return (
                      <button
                        key={option.value || "any"}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          triggerHaptic("light");
                          updateParam("time", option.value);
                        }}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                          selected
                            ? theme.badgeBg
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  {params.time
                    ? t("search.depart_after_hint", { time: params.time, defaultValue: `僅顯示 ${params.time} 起的班次` })
                    : t("search.time_any_hint", { defaultValue: "不限制出發時間，方便比較所有可用班次" })}
                </p>
              </div>
            )}

            {formError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50/75 px-4 py-2.5 text-xs font-semibold text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400">
                {formError}
              </p>
            )}

            {isSearching && (
              <div role="status" className="mt-4 flex items-center justify-center gap-2.5 rounded-xl bg-sky-50 px-4 py-3.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400 shrink-0" />
                <span>{t("search.fetching_live_data")}</span>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSearching || !canSearchTimetable}
                aria-label={isSearching ? t("search.searching") : canSearchTimetable ? t("search.search_timetable", { defaultValue: "查詢時刻表" }) : t("search.timetable_unavailable", { defaultValue: "時刻表尚未提供" })}
                type="button"
                aria-busy={isSearching}
                className={`h-12 flex-1 rounded-lg ${theme.buttonBg} text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-60`}
              >
                {isSearching ? t("search.searching") : canSearchTimetable ? t("search.search_timetable", { defaultValue: "查詢時刻表" }) : t("search.timetable_unavailable_short", { defaultValue: "暫無時刻表" })}
              </button>
              {origin.trim() && destination.trim() && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-pressed={isFavorited}
                  aria-label={isFavorited ? t("favorites.remove", { defaultValue: "Remove route from favorites" }) : t("favorites.save", { defaultValue: "Save route to favorites" })}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-300"
                  title={isFavorited ? t("favorites.remove", { defaultValue: "Remove route from favorites" }) : t("favorites.save", { defaultValue: "Save route to favorites" })}
                >
                  <Star className={`h-5 w-5 ${isFavorited ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""}`} />
                </button>
              )}
            </div>

            {frequentRoutes.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100/80 dark:border-slate-800/60">
                <p className="mb-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("search.quick_access", { defaultValue: "Quick Access" })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {frequentRoutes.map((route, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onChange({ ...params, origin: route.origin, destination: route.destination });
                      }}
                      aria-label={`${stationLabel(t, route.origin, country)} to ${stationLabel(t, route.destination, country)}`}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {stationLabel(t, route.origin, country)}
                      <span className="text-slate-300 dark:text-slate-600">&rarr;</span>
                      {stationLabel(t, route.destination, country)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic, humble credits/attribution under the search form instead of status bar AI-slop */}
        <div className="mt-3.5 text-center">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {t("search.data_source")}: <span className="text-slate-500 dark:text-slate-400">{config.provider}</span>
          </span>
        </div>

        {favorites.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t("favorites.title", { defaultValue: "Favorite Routes" })}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl bg-white dark:divide-slate-800 dark:bg-slate-900">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center justify-between bg-white hover:bg-slate-50 transition-colors dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("medium");
                      onRepeatFavoriteSearch(fav);
                    }}
                    aria-label={`Search favorite route ${stationLabel(t, fav.origin, fav.country)} to ${stationLabel(t, fav.destination, fav.country)}`}
                    className="flex-1 min-w-0 text-left px-5 py-3.5"
                  >
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {stationLabel(t, fav.origin, fav.country)}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {stationLabel(t, fav.destination, fav.country)}
                    </span>
                    <span className={`mt-0.5 block text-[11px] font-semibold ${countryThemes[fav.country]?.textActive || "text-slate-400"}`}>
                      {countryFlags[fav.country] || ""} {t(countryConfig[fav.country].labelKey)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      onRemoveFavorite(fav.id);
                    }}
                    aria-label={`Remove favorite route ${stationLabel(t, fav.origin, fav.country)} to ${stationLabel(t, fav.destination, fav.country)}`}
                    className="flex h-12 w-12 items-center justify-center text-amber-400 hover:text-slate-300 transition-colors shrink-0"
                    title={t("favorites.remove", { defaultValue: "Remove route from favorites" })}
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {sortedHistory.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t("history.recent")}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedHistory.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
                >
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      onRepeatSearch(item);
                    }}
                    aria-label={`Search recent route ${stationLabel(t, item.origin, item.country)} to ${stationLabel(t, item.destination, item.country)}`}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {stationLabel(t, item.origin, item.country)}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {stationLabel(t, item.destination, item.country)}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {item.date} · <span className={`font-bold ${countryThemes[item.country]?.textActive || ""}`}>{countryFlags[item.country] || ""} {t(countryConfig[item.country].labelKey)}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("light");
                        onTogglePinHistory(item.id);
                      }}
                      title={item.pinned ? t("history.unpin") : t("history.pin")}
                      aria-label={item.pinned ? t("history.unpin") : t("history.pin")}
                      className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                        item.pinned
                          ? "text-emerald-500 hover:text-emerald-600 dark:text-emerald-400"
                          : "text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                      }`}
                    >
                      <Pin className={`h-4 w-4 ${item.pinned ? "fill-current rotate-45" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("medium");
                        onRepeatSearch(item);
                      }}
                      aria-label={t("search.search_timetable", { defaultValue: "Search timetable" })}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <a
            href="https://roam-jelly-web.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-3 text-center text-[13px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            <Sparkles aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("search.plan_ai", { defaultValue: "AI 行程規劃" })}</span>
          </a>

          <a
            href="https://taiwanrail.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-50 px-3 py-3 text-center text-[13px] font-semibold text-sky-800 transition-colors hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
          >
            <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("search.taiwan_rail_link", { defaultValue: "台/鐵/捷運 查詢" })}</span>
          </a>
        </div>

        {/* About Section */}
        <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            {t("search.about_title", { defaultValue: "關於全球鐵道查詢" })}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t("search.about_body", { defaultValue: "TransitRail 是一個免費的跨國鐵道與大眾運輸時刻表查詢工具，提供日本、新加坡、泰國、香港、英國、美國、德國、法國、中國等市場的鐵路與地鐵資訊。無需註冊即可查詢站點班次、行車日期、營運商與轉乘資訊。" })}
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {t("search.data_source_detail", { defaultValue: "班次、票價與即時狀態資料來源：各國大眾運輸系統與第三方 API（如 Jorudan, Korail, LTA, MTR, TfL, MBTA, DB, SNCF 等）。" })}
          </p>
        </div>

        {/* Popular Routes Section */}
        <div className="mt-10 overflow-hidden">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            {t("search.popular_routes", { defaultValue: "熱門路線" })}
          </h2>
          
          <div className="space-y-4">
            {/* Row 1: Scroll Right (上面往右) */}
            <div className="relative flex w-full overflow-hidden py-1.5 select-none">
              {/* Blur mask overlay at edges */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950/20 z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950/20 z-10 pointer-events-none" />
              
              <div className="flex shrink-0 animate-marquee-right hover:[animation-play-state:paused] whitespace-nowrap">
                {row1.concat(row1).map((route, idx) => {
                  const routeTheme = countryThemes[route.country as Country] || theme;
                  return (
                    <button
                      key={`r1-${idx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic("medium");
                        onChange({
                          origin: route.origin,
                          destination: route.destination,
                          date: providerDateValue(route.country as Country),
                          country: route.country as Country,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="mr-3 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span className={`text-[10px] font-semibold ${routeTheme.textActive}`}>
                        {countryFlags[route.country] || ""} {t(countryConfig[route.country as Country].labelKey)}
                      </span>
                      <span>{route.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Scroll Left (下面往左) */}
            <div className="relative flex w-full overflow-hidden py-1.5 select-none">
              {/* Blur mask overlay at edges */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950/20 z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950/20 z-10 pointer-events-none" />
              
              <div className="flex shrink-0 animate-marquee-left hover:[animation-play-state:paused] whitespace-nowrap">
                {row2.concat(row2).map((route, idx) => {
                  const routeTheme = countryThemes[route.country as Country] || theme;
                  return (
                    <button
                      key={`r2-${idx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic("medium");
                        onChange({
                          origin: route.origin,
                          destination: route.destination,
                          date: providerDateValue(route.country as Country),
                          country: route.country as Country,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="mr-3 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span className={`text-[10px] font-semibold ${routeTheme.textActive}`}>
                        {countryFlags[route.country] || ""} {t(countryConfig[route.country as Country].labelKey)}
                      </span>
                      <span>{route.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-10 mb-12">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            {t("search.faq_title", { defaultValue: "常見問題 FAQ" })}
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90 transition-all duration-300"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setOpenFaq(isOpen ? null : idx);
                    }}
                    className="flex w-full items-center justify-between px-5 py-4 text-left font-bold text-slate-800 dark:text-slate-200 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4.5 w-4.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-blue-500 dark:text-blue-400" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-350 ease-in-out ${
                      isOpen ? "max-h-48 border-t border-slate-100 dark:border-slate-800/60" : "max-h-0"
                    }`}
                  >
                    <div className="p-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

// --- End of SearchForm.tsx ---
