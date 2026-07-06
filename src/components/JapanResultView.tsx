import { Bookmark, Check, ChevronRight, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { SortMode, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";

interface JapanResultViewProps {
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
              <span className="truncate">{origin}</span>
              <span className="shrink-0 text-slate-400">&rarr;</span>
              <span className="truncate">{destination}</span>
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
              className={`flex-1 border-b-2 py-3 text-xs font-bold ${
                sortMode === tab.mode
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-400 dark:text-slate-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {!error && results.length > 0 && (
          <WeatherWidget destination={destination} date={date} />
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <p className="text-sm font-bold">{t("result.unable_to_fetch")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!error && results.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{t("result.no_results")}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("result.no_results_hint")}</p>
          </div>
        )}

        {!error && results.map((trip, index) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <motion.article
              key={trip.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                       className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      style={{ borderLeft: `3px solid ${trip.lineColor || "#94a3b8"}` }}
                    >
                      {trip.service}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">{formatDuration(trip.durationMinutes)}</span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                    {formatPrice ? formatPrice(trip) : formatLocalPrice(trip) || t("result.fare_unavailable")}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{trip.departureTime}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{trip.origin}</span>
                      {(trip.platform || trip.legs?.[0]?.platform) && (
                        <span className="shrink-0 inline-flex items-center rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Plat {trip.platform || trip.legs?.[0]?.platform}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex min-w-14 items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                    <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
                    <span className="h-1.5 w-1.5 rounded-full border-2 border-slate-900 bg-white dark:border-slate-100 dark:bg-slate-900" />
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-mono text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{trip.arrivalTime}</p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{trip.destination}</p>
                  </div>
                </div>
              </div>
              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
                <span className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                  {trip.direct ? t("result.direct") : `${trip.stops.length} ${t("result.stops")}`} · {t("result.reserved_seat")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => {
                      triggerHaptic(isSaved ? "light" : "success");
                      onSave(trip);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                      isSaved ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                    aria-label={isSaved ? t("result.saved") : t("result.save_trip")}
                  >
                    {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      onSelectSeat(trip);
                    }}
                    className="flex h-8 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-[0_2px_6px_rgba(16,185,129,0.2)] hover:bg-emerald-500 transition-all"
                  >
                    {t("result.select_seat")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </main>
  );
}
