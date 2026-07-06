import { Bookmark, Check, ChevronRight, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, SortMode, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";

interface JapanResultViewProps {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  error?: string;
  results: TransitResult[];
  sortMode: SortMode;
  savedIds: Set<string>;
  onSortChange: (mode: SortMode) => void;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
}

const localeForCurrency = (currency?: string) => {
  switch (currency) {
    case "JPY": return "ja-JP";
    case "KRW": return "ko-KR";
    case "HKD": return "zh-HK";
    case "TWD": return "zh-TW";
    case "CNY": return "zh-CN";
    case "EUR": return "de-DE";
    case "GBP": return "en-GB";
    case "THB": return "th-TH";
    case "AUD": return "en-AU";
    case "CAD": return "en-CA";
    case "NZD": return "en-NZ";
    case "PHP": return "en-PH";
    case "IDR": return "id-ID";
    case "VND": return "vi-VN";
    case "SEK": return "sv-SE";
    case "NOK": return "nb-NO";
    case "DKK": return "da-DK";
    case "PLN": return "pl-PL";
    case "TRY": return "tr-TR";
    case "ZAR": return "en-ZA";
    case "BRL": return "pt-BR";
    case "MXN": return "es-MX";
    case "RUB": return "ru-RU";
    case "INR": return "en-IN";
    case "SAR": return "ar-SA";
    case "AED": return "ar-AE";
    case "ILS": return "he-IL";
    case "CZK": return "cs-CZ";
    case "HUF": return "hu-HU";
    case "RON": return "ro-RO";
    default: return "en-US";
  }
};

const fractionDigitsForCurrency = (currency?: string) =>
  currency === "JPY" || currency === "KRW" || currency === "TWD" || currency === "CNY" || currency === "VND" || currency === "IDR" ? 0 : 2;

const formatLocalPrice = (trip: TransitResult) =>
  trip.price === undefined || !trip.currency ? null : new Intl.NumberFormat(localeForCurrency(trip.currency), {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: fractionDigitsForCurrency(trip.currency),
  }).format(trip.price);

const formatDuration = (minutes?: number) => {
  if (minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export function JapanResultView({
  country,
  origin,
  destination,
  date,
  error,
  results,
  sortMode,
  savedIds,
  onSortChange,
  onModify,
  onSave,
  onSelectSeat,
  onOpenLegend,
  formatPrice,
}: JapanResultViewProps) {
  const { t } = useTranslation();

  const tabs: Array<{ mode: SortMode; label: string }> = [
    { mode: "fastest", label: t("result.fastest") },
    { mode: "earliest", label: t("result.earliest") },
    { mode: "cheapest", label: t("result.cheapest") },
  ];

  return (
    <main className="min-h-screen bg-transparent pb-28 pt-14">
      <section className="border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 py-4 dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="truncate">{stationLabel(t, origin, country)}</span>
              <span className="shrink-0 text-slate-400">&rarr;</span>
              <span className="truncate">{stationLabel(t, destination, country)}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{date} · 1 {t("result.adult")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenLegend && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onOpenLegend?.();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                title="View Transit Legend"
                aria-label="Transit Legend"
              >
                <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </button>
            )}
            <button
              onClick={() => {
                triggerHaptic("light");
                onModify();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-3.5 w-3.5" />
              {t("result.modify")}
            </button>
          </div>
        </div>
      </section>

      <nav className="sticky top-14 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => {
                triggerHaptic("light");
                onSortChange(tab.mode);
              }}
              className={`relative flex-1 py-3 text-xs font-bold transition-colors ${
                sortMode === tab.mode
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {sortMode === tab.mode && (
                <motion.div
                  layoutId="japanActiveTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-600 dark:bg-emerald-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        <AnimatePresence mode="popLayout">
          {!error && results.length > 0 && (
            <motion.div
              key="weather"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <WeatherWidget destination={destination} date={date} country={country} />
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
            >
              <p className="text-sm font-bold">{t("result.unable_to_fetch")}</p>
              <p className="mt-1 text-sm">{error}</p>
            </motion.div>
          )}

          {!error && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t("result.no_results")}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("result.no_results_hint")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {!error && results.map((trip, index) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <motion.article
              key={trip.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
              className="overflow-hidden rounded-3xl border border-slate-100 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300"
            >
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border border-slate-100 dark:border-slate-800"
                      style={{ borderLeft: `3.5px solid ${trip.lineColor || "#94a3b8"}` }}
                    >
                      {trip.service}
                    </span>
                    <span className="shrink-0 rounded-lg bg-emerald-500/5 dark:bg-emerald-400/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {formatDuration(trip.durationMinutes)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-1 text-sm font-black text-slate-900 dark:text-emerald-400 shadow-xs border border-slate-100 dark:border-slate-700/50">
                    {formatPrice ? formatPrice(trip) : formatLocalPrice(trip) || t("result.fare_unavailable")}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.departureTime}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span className="truncate">{stationLabel(t, trip.origin, trip.country)}</span>
                      {(trip.platform || trip.legs?.[0]?.platform) && (
                        <span className="shrink-0 inline-flex items-center rounded-md bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {t("result.plat_label", { defaultValue: "Plat" })} {trip.platform || trip.legs?.[0]?.platform}
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Re-imagined SwiftUI style transit progress line */}
                  <div className="relative flex min-w-[70px] flex-col items-center">
                    <div className="relative flex w-full items-center justify-between px-1">
                      {/* Background track */}
                      <div className="absolute left-1 right-1 h-[3px] rounded-full bg-slate-100 dark:bg-slate-800" />
                      {/* Active line with service color */}
                      <div 
                        className="absolute left-1 right-1 h-[3px] rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${trip.lineColor || "#10b981"}, ${trip.lineColor || "#10b981"}ee)`
                        }}
                      />
                      {/* Origin dot */}
                      <span 
                        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs" 
                        style={{ borderColor: trip.lineColor || "#10b981" }} 
                      />
                      {/* Middle transfer indicator */}
                      {!trip.direct && (
                        <span className="z-10 h-2 w-2 rounded-full bg-amber-400 ring-[2px] ring-white dark:ring-slate-950 shadow-xs" />
                      )}
                      {/* Destination dot */}
                      <span 
                        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs" 
                        style={{ borderColor: trip.lineColor || "#10b981" }} 
                      />
                    </div>
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.arrivalTime}</p>
                    <p className="mt-1.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                  </div>
                </div>
              </div>
              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                <span className="truncate font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {trip.direct ? t("result.direct") : `${trip.stops.length} ${t("result.stops")}`} · {t("result.reserved_seat")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => {
                      triggerHaptic(isSaved ? "light" : "success");
                      onSave(trip);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-200 ${
                      isSaved 
                        ? "border-emerald-200 bg-emerald-50/80 text-emerald-600 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400" 
                        : "border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 shadow-2xs"
                    }`}
                    aria-label={isSaved ? t("result.saved") : t("result.save_trip")}
                  >
                    {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      onSelectSeat(trip);
                    }}
                    className="flex h-9 items-center gap-1 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white shadow-[0_3px_10px_rgba(16,185,129,0.25)] hover:bg-emerald-500 hover:shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-95 transition-all duration-200"
                  >
                    {t("result.select_seat")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
        </AnimatePresence>
      </div>
    </main>
  );
}
