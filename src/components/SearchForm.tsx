import { ArrowLeftRight, CalendarDays, DatabaseZap, Star, Search, MapPin, History, ChevronDown, Loader2, Navigation } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions, providerDateValue, countryThemes, countryFlags } from "../data/countries";
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
        // Centers of supported countries
        const countryCenters: Record<Country, { lat: number; lng: number }> = {
          japan: { lat: 36.2048, lng: 138.2529 },
          korea: { lat: 35.9078, lng: 127.7669 },
          hong_kong: { lat: 22.3193, lng: 114.1694 },
          singapore: { lat: 1.3521, lng: 103.8198 },
          thailand: { lat: 15.8700, lng: 100.9925 },
          united_kingdom: { lat: 55.3781, lng: -3.4360 },
          united_states: { lat: 37.0902, lng: -95.7129 },
          germany: { lat: 51.1657, lng: 10.4515 },
          france: { lat: 46.2276, lng: 2.2137 },
          switzerland: { lat: 46.8182, lng: 8.2275 },
          china: { lat: 35.8617, lng: 104.1954 },
        };

        let closestCountry: Country = "japan";
        let minDistance = Infinity;

        for (const [c, center] of Object.entries(countryCenters)) {
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
  ], [t]);

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
              aria-label={t(countryConfig[item].labelKey)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
                country === item
                  ? `${countryThemes[item].buttonBg} text-white ${countryThemes[item].buttonShadow} scale-[1.02]`
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {countryFlags[item] || ""} {t(countryConfig[item].labelKey)}
            </button>
          ))}
        </div>

        {/* Location Detection pill */}
        <div className="flex justify-between items-center px-1 mb-4">
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            {detectError && <span className="text-red-500 font-semibold">{detectError}</span>}
          </div>
          <button
            type="button"
            onClick={handleAutoDetectCountry}
            disabled={isDetectingCountry}
            className={`flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-[11px] font-black tracking-wide text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700/60 transition-all ${
              isDetectingCountry ? "animate-pulse" : ""
            }`}
          >
            {isDetectingCountry ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                <span>{i18n.language === "zh-TW" ? "偵測中..." : "Detecting..."}</span>
              </>
            ) : (
              <>
                <Navigation className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                <span>{i18n.language === "zh-TW" ? "自動偵測國家" : "Auto-Detect Country"}</span>
              </>
            )}
          </button>
        </div>

        {/* Main Search Card */}
        <div className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white/80 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:border-slate-800/80 dark:bg-slate-900/80">
          {/* Top glowing progress bar during network latency */}
          {isSearching && (
            <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-slate-100 dark:bg-slate-800 z-20">
              <div className="absolute top-0 bottom-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-loading-bar" />
            </div>
          )}
          <div className="relative p-6">
            <div className="relative flex items-center justify-between gap-1">
              {/* Animated Journey Connection Path */}
              <div className="absolute left-[18%] right-[18%] top-[35%] h-[2px] bg-slate-100 dark:bg-slate-800/60 -translate-y-1/2 pointer-events-none overflow-hidden rounded-full">
                <div className={`absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-emerald-500 to-transparent dark:via-emerald-400 animate-travel-pulse`} />
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenStations("origin");
                }}
                aria-label={origin ? `${t("search.origin")}: ${stationLabel(t, origin, country)}` : t("search.select_origin", { defaultValue: "Select Departure Station" })}
                className="flex flex-1 flex-col items-center group focus:outline-none py-2 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors z-10"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${theme.textActive} opacity-70`}>
                  <MapPin className="h-3 w-3" />
                  {t("search.origin")}
                </div>
                <div className={`text-2xl font-black tracking-tight ${origin ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-700"} transition-all duration-300 group-hover:scale-[1.02]`}>
                  {origin ? stationLabel(t, origin, country) : t("search.select_origin", { defaultValue: "Select" })}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {origin || "DEP"}
                </div>
              </button>

              <div className="relative z-20 flex shrink-0 items-center justify-center px-1">
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
                aria-label={destination ? `${t("search.destination")}: ${stationLabel(t, destination, country)}` : t("search.select_dest", { defaultValue: "Select Destination Station" })}
                className="flex flex-1 flex-col items-center group focus:outline-none py-2 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors z-10"
              >
                <div className={`mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${theme.textActive} opacity-70`}>
                  <MapPin className="h-3 w-3" />
                  {t("search.destination")}
                </div>
                <div className={`text-2xl font-black tracking-tight ${destination ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-700"} transition-all duration-300 group-hover:scale-[1.02]`}>
                  {destination ? stationLabel(t, destination, country) : t("search.select_dest", { defaultValue: "Select" })}
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
                    const monthStr = i18n.language === "zh-TW" 
                      ? `${String(d.getMonth() + 1).padStart(2, "0")}月`
                      : d.toLocaleString("en-US", { month: "short" });
                    const dayStr = i18n.language === "zh-TW"
                      ? `${String(d.getDate()).padStart(2, "0")}日`
                      : String(d.getDate()).padStart(2, "0");
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
                        className={`flex min-w-[72px] shrink-0 snap-start flex-col items-center justify-center rounded-[20px] p-3 text-center border transition-all ${
                          isSelected
                            ? theme.dateSelected
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

            {formError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50/75 px-4 py-2.5 text-xs font-semibold text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400">
                {formError}
              </p>
            )}

            {isSearching && (
              <div className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 dark:border-blue-950/20 dark:bg-blue-950/10 px-4 py-3.5 text-xs font-semibold text-blue-700 dark:text-blue-400 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400 shrink-0" />
                <span>{t("search.fetching_live_data")}</span>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSearching}
                aria-label={isSearching ? t("search.searching") : t("search.realtime_search")}
                className={`h-12 flex-1 rounded-2xl ${theme.buttonBg} text-sm font-bold text-white ${theme.buttonShadow} hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:hover:translate-y-0 disabled:active:scale-100 disabled:cursor-wait ${isSearching ? "animate-pulse" : ""}`}
              >
                {isSearching ? t("search.searching") : t("search.realtime_search")}
              </button>
              {origin.trim() && destination.trim() && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-label={isFavorited ? "Remove route from Favorites" : "Save route to Favorites"}
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
                      aria-label={`${stationLabel(t, route.origin, country)} to ${stationLabel(t, route.destination, country)}`}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/60 transition-all duration-200"
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
                    <span className={`mt-0.5 block font-mono text-[11px] font-bold ${countryThemes[fav.country]?.textActive || "text-slate-400"}`}>
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
                  onClick={() => {
                    triggerHaptic("medium");
                    onRepeatSearch(item);
                  }}
                  aria-label={`Search recent route ${stationLabel(t, item.origin, item.country)} to ${stationLabel(t, item.destination, item.country)}`}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {stationLabel(t, item.origin, item.country)}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {stationLabel(t, item.destination, item.country)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                      {item.date} · <span className={`font-bold ${countryThemes[item.country]?.textActive || ""}`}>{countryFlags[item.country] || ""} {t(countryConfig[item.country].labelKey)}</span>
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
            <span className="truncate">{t("search.taiwan_rail_link", { defaultValue: "台/鐵/捷運 查詢" })}</span>
          </a>
        </div>

        {/* About Section */}
        <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            {t("search.about_title", { defaultValue: "關於全球鐵道查詢" })}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t("search.about_body", { defaultValue: "TransitRail 是一個免費的跨國鐵道與大眾運輸時刻表查詢工具。本專案整合了全球 10 個國家與地區的主流鐵路與地鐵系統，包括日本（Jorudan）、韓國（Korail）、新加坡（LTA）、泰國（BTS/MRT）、香港（MTR）、英國（TfL 倫敦地鐵）、美國（波士頓 MBTA）、德國（DB）、法國（SNCF）以及中國（12306 鐵路）。無需註冊即可即時查詢站點班次、行車日期、營運商與智慧轉乘資訊，提供極致流暢的跨國自主旅行體驗。" })}
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
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 pl-2 pr-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 mr-3 shrink-0"
                    >
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${routeTheme.badgeBg}`}>
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
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 pl-2 pr-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 mr-3 shrink-0"
                    >
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${routeTheme.badgeBg}`}>
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


