// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Japan transit query results with staggered motion animations

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, CoverageGap, NoResultReason, SortMode, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel } from "../utils/stationLabel";
import { TransitIcon, formatPlatform } from "./TransitIcon";
import {
  ResultShellHeader,
  SaveTripButton,
  TimelineBar,
  formatDuration,
  renderEmptyBlock,
  renderMissBlock,
  renderWeatherBlock,
  tripCardClass,
  tripCardMotion,
} from "./ResultShell";

interface JapanResultViewProps {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  error?: string;
  noResultReason?: NoResultReason;
  officialSourceUrl?: string;
  coverageGap?: CoverageGap;
  results: TransitResult[];
  sortMode: SortMode;
  savedIds: Set<string>;
  onSortChange: (mode: SortMode) => void;
  onModify: () => void;
  onRetry?: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
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

export function JapanResultView({
  country,
  origin,
  destination,
  date,
  time,
  error,
  noResultReason,
  officialSourceUrl,
  coverageGap,
  results,
  sortMode,
  savedIds,
  onSortChange,
  onModify,
  onRetry,
  onSave,
  onSelectSeat,
  onOpenLegend,
  formatPrice,
  overview,
}: JapanResultViewProps) {
  const { t } = useTranslation();

  const tabs: Array<{ mode: SortMode; label: string }> = [
    { mode: "fastest", label: t("result.fastest") },
    { mode: "earliest", label: t("result.earliest") },
    { mode: "cheapest", label: t("result.cheapest") },
  ];

  return (
    <main className="min-h-screen bg-transparent pb-nav pt-16">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={<p className="m3-body-small mt-1 font-mono text-slate-500 dark:text-slate-400">{date}{time ? ` · ≥ ${time}` : ""} · 1 {t("result.adult")}</p>}
        onModify={onModify}
        onOpenLegend={onOpenLegend}
      />

      {overview}

      <nav className="sticky top-16 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => {
                triggerHaptic("light");
                onSortChange(tab.mode);
              }}
              className={`m3-state m3-title-small relative min-h-12 flex-1 ${
                sortMode === tab.mode
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {sortMode === tab.mode && (
                <motion.div
                  layoutId="japanActiveTabUnderline"
                  className="absolute bottom-0 left-0 right-0 mx-auto h-[3px] w-16 rounded-t-full bg-emerald-600 dark:bg-emerald-400"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        <AnimatePresence mode="popLayout">
          {!error && results.length > 0 && renderWeatherBlock(destination, date, country)}
          {error && renderMissBlock({
            message: error,
            reason: noResultReason,
            coverageGap,
            country,
            sourceUrl: officialSourceUrl,
            errorTitle: t("result.unable_to_fetch"),
            onModify,
            onRetry,
          })}
          {!error && results.length === 0 && renderEmptyBlock(t("result.no_results"), t("result.no_results_hint"))}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {!error && results.map((trip, index) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <motion.article
              key={trip.id}
              {...tripCardMotion(index)}
              className={tripCardClass}
            >
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="m3-chip m3-label-medium max-w-full truncate border border-slate-100 bg-slate-50 px-3 text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                      style={{ borderLeft: `3.5px solid ${trip.lineColor || "#94a3b8"}` }}
                    >
                      <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                      <span>{trip.service}</span>
                    </span>
                    <span className="m3-chip m3-label-medium min-h-7 shrink-0 bg-emerald-500/5 px-3 font-mono text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                      {formatDuration(t, trip.durationMinutes)}
                    </span>
                  </div>
                  <span className="m3-chip m3-title-small shrink-0 border border-slate-100 bg-slate-50 px-3 text-slate-900 dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-emerald-400">
                    {formatPrice ? formatPrice(trip) : formatLocalPrice(trip) || t("result.fare_unavailable")}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="min-w-0">
                    <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.departureTime}</p>
                    <p className="m3-body-small mt-1.5 flex items-center gap-1.5 truncate text-slate-500 dark:text-slate-400">
                      <span className="truncate">{stationLabel(t, trip.origin, trip.country)}</span>
                      {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t) && (
                        <span className="m3-label-small m3-shape-xs inline-flex shrink-0 items-center bg-slate-100/80 px-1.5 py-0.5 font-mono uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="relative flex min-w-[70px] flex-col items-center">
                    <TimelineBar color={trip.lineColor || "#10b981"} direct={!!trip.direct} />
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.arrivalTime}</p>
                    <p className="m3-body-small mt-1.5 truncate text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                  </div>
                </div>
              </div>
              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/30 px-4 py-3 sm:px-6 dark:border-slate-800/80 dark:bg-slate-900/20">
                <span className="m3-label-medium truncate font-mono text-slate-500 dark:text-slate-400">
                  {trip.direct ? t("result.direct") : `${trip.stops.length} ${t("result.stops")}`} · {t("result.reserved_seat")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <SaveTripButton isSaved={isSaved} onSave={() => onSave(trip)} />
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      onSelectSeat(trip);
                    }}
                    className="m3-button m3-button-small m3-state gap-1 bg-emerald-600 text-white"
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

// --- End of JapanResultView.tsx ---
