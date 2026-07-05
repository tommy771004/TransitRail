import { AlertTriangle, Bookmark, Check, Edit2, Utensils, Wifi, Zap, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { KoreaFilter, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";

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

      <div className="sticky top-14 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                triggerHaptic("light");
                onFilterChange(item.key);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filter === item.key
                  ? "bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

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
              className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    style={{ borderLeft: `3px solid ${trip.lineColor || "#94a3b8"}` }}
                  >
                    {trip.service}
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">{trip.trainType || trip.operator}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatPrice ? formatPrice(trip) : formatLocalPrice(trip) || t("result.fare_unavailable")}
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {trip.seatClass === "first" ? t("result.first_class") : t("result.economy_class")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
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
                <div className="flex min-w-16 flex-col items-center">
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatDuration(trip.durationMinutes)}</span>
                  <div className="mt-1 flex w-full items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                    <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
                    {!trip.direct && <span className="h-1.5 w-1.5 rounded-full border border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900" />}
                    {!trip.direct && <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />}
                    <span className="h-1.5 w-1.5 rounded-full border-2 border-slate-900 bg-white dark:border-slate-100 dark:bg-slate-900" />
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {trip.direct ? t("result.non_stop") : `${trip.stops.length} ${t("result.stops")}`}
                  </span>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-mono text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{trip.arrivalTime}</p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{trip.destination}</p>
                </div>
              </div>
              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
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
                    className="flex h-8 items-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-[0_2px_6px_rgba(16,185,129,0.2)] hover:bg-emerald-500 transition-all"
                  >
                    {t("result.select_seat")}
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
