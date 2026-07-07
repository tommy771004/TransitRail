// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Korea transit query results with staggered motion animations

import { AlertTriangle, Bookmark, Check, Edit2, Utensils, Wifi, Zap, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { KoreaFilter, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";

interface KoreaResultViewProps {
  origin: string;
  destination: string;
  date: string;
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
}

const formatLocalPrice = (trip: TransitResult) =>
  trip.price === undefined || !trip.currency ? null : new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: 0,
  }).format(trip.price);

const formatDuration = (minutes?: number) => {
  if (minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export function KoreaResultView({
  origin,
  destination,
  date,
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
      <section className="border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 py-4 dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="truncate">{stationLabel(t, origin, "korea")}</span>
              <span className="shrink-0 text-slate-400">&rarr;</span>
              <span className="truncate">{stationLabel(t, destination, "korea")}</span>
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
          {!error && results.length > 0 && (
            <motion.div
              key="weather"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <WeatherWidget destination={destination} date={date} country="korea" />
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
              className="overflow-hidden rounded-3xl border border-slate-100 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300"
            >
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border border-slate-100 dark:border-slate-800"
                        style={{ borderLeft: `3.5px solid ${trip.lineColor || "#94a3b8"}` }}
                      >
                        {trip.service}
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
                      {(trip.platform || trip.legs?.[0]?.platform) && (
                        <span className="shrink-0 inline-flex items-center rounded-md bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {t("result.plat_label", { defaultValue: "Plat" })} {trip.platform || trip.legs?.[0]?.platform}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="relative flex min-w-[75px] flex-col items-center">
                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      {formatDuration(trip.durationMinutes)}
                    </span>
                    <div className="relative flex w-full items-center justify-between px-1">
                      <div className="absolute left-1 right-1 h-[3px] rounded-full bg-slate-100 dark:bg-slate-800" />
                      <div 
                        className="absolute left-1 right-1 h-[3px] rounded-full"
                        style={{
                          background: `linear-gradient(to right, ${trip.lineColor || "#10b981"}, ${trip.lineColor || "#10b981"}ee)`
                        }}
                      />
                      <span 
                        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs" 
                        style={{ borderColor: trip.lineColor || "#10b981" }} 
                      />
                      {!trip.direct && (
                        <span className="z-10 h-2 w-2 rounded-full bg-amber-400 ring-[2px] ring-white dark:ring-slate-950 shadow-xs" />
                      )}
                      <span 
                        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs" 
                        style={{ borderColor: trip.lineColor || "#10b981" }} 
                      />
                    </div>
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
