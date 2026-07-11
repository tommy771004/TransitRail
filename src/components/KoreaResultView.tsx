// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Korea transit query results with staggered motion animations

import { AlertTriangle, Utensils, Wifi, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { KoreaFilter, TransitResult } from "../types";
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
  renderErrorBlock,
  renderWeatherBlock,
  tripCardClass,
  tripCardMotion,
} from "./ResultShell";

interface KoreaResultViewProps {
  origin: string;
  destination: string;
  date: string;
  time?: string;
  error?: string;
  results: TransitResult[];
  filter: KoreaFilter;
  savedIds: Set<string>;
  onFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
}

const formatLocalPrice = (trip: TransitResult) =>
  trip.price === undefined || !trip.currency ? null : new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: 0,
  }).format(trip.price);

export function KoreaResultView({
  origin,
  destination,
  date,
  time,
  error,
  results,
  filter,
  savedIds,
  onFilterChange,
  onModify,
  onSave,
  onSelectSeat,
  onOpenLegend,
  formatPrice,
  overview,
}: KoreaResultViewProps) {
  const { t } = useTranslation();
  const filters: Array<{ key: KoreaFilter; label: string }> = [
    { key: "all", label: t("result.all_times") },
    { key: "cheapest", label: t("result.cheapest_first") },
    { key: "direct", label: t("result.direct") },
    { key: "first_class", label: t("result.first_class") },
  ];

  return (
    <main className="min-h-screen bg-transparent pb-28 pt-14">
      <ResultShellHeader
        country="korea"
        origin={origin}
        destination={destination}
        meta={<p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{date}{time ? ` · ≥ ${time}` : ""} · 1 {t("result.adult")}</p>}
        onModify={onModify}
        onOpenLegend={onOpenLegend}
      />

      {overview}

      <div className="sticky top-14 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                triggerHaptic("light");
                onFilterChange(item.key);
              }}
              className={`relative shrink-0 whitespace-nowrap px-4 py-1.5 text-xs font-bold transition-colors rounded-full ${
                filter === item.key
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
              }`}
            >
              <span className="relative z-10">{item.label}</span>
              {filter === item.key && (
                <motion.div
                  layoutId="koreaActiveFilterBg"
                  className="absolute inset-0 rounded-full bg-emerald-600 shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        <AnimatePresence mode="popLayout">
          {!error && results.length > 0 && renderWeatherBlock(destination, date, "korea")}
          {error && renderErrorBlock(t("result.unable_to_fetch"), error)}
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 truncate rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border border-slate-100 dark:border-slate-800"
                        style={{ borderLeft: `3.5px solid ${trip.lineColor || "#94a3b8"}` }}
                      >
                        <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                        <span>{trip.service}</span>
                      </span>
                      <span className="truncate font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">{trip.trainType || trip.operator}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-1 text-sm font-black text-slate-900 dark:text-emerald-400 shadow-xs border border-slate-100 dark:border-slate-700/50">
                      {formatPrice ? formatPrice(trip) : formatLocalPrice(trip) || t("result.fare_unavailable")}
                    </span>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {trip.seatClass === "first" ? t("result.first_class") : t("result.economy_class")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-1">
                  <div className="min-w-0">
                    <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.departureTime}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span className="truncate">{stationLabel(t, trip.origin, trip.country)}</span>
                      {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t) && (
                        <span className="shrink-0 inline-flex items-center rounded-md bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="relative flex min-w-[75px] flex-col items-center">
                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      {formatDuration(trip.durationMinutes)}
                    </span>
                    <TimelineBar color={trip.lineColor || "#10b981"} direct={!!trip.direct} />
                    <span className="mt-1 font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {trip.direct ? t("result.non_stop") : `${trip.stops.length} ${t("result.stops")}`}
                    </span>
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.arrivalTime}</p>
                    <p className="mt-1.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                  </div>
                </div>
              </div>
              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                <div className="flex min-w-0 items-center gap-2">
                  {(trip.amenities || []).includes("wifi") && <Wifi className="h-4 w-4 shrink-0 text-slate-400" />}
                  {(trip.amenities || []).includes("power") && <Zap className="h-4 w-4 shrink-0 text-slate-400" />}
                  {(trip.amenities || []).includes("food") && <Utensils className="h-4 w-4 shrink-0 text-slate-400" />}
                  {trip.warning && (
                    <p className="flex items-center gap-1 truncate text-[11px] font-medium text-amber-800 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {trip.warning}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SaveTripButton isSaved={isSaved} onSave={() => onSave(trip)} />
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      onSelectSeat(trip);
                    }}
                    className="flex h-9 items-center gap-1 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white shadow-[0_3px_10px_rgba(16,185,129,0.25)] hover:bg-emerald-500 hover:shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-95 transition-all duration-200"
                  >
                    {t("result.select_seat")}
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

// --- End of KoreaResultView.tsx ---
