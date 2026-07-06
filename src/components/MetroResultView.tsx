import { AlertTriangle, Bookmark, Check, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";

interface MetroResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
  results: TransitResult[];
  savedIds: Set<string>;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
}

export function MetroResultView({
  origin,
  destination,
  date,
  error,
  results,
  savedIds,
  onModify,
  onSave,
  onOpenLegend,
  formatPrice,
}: MetroResultViewProps) {
  const { t } = useTranslation();
  const hasTransferResults = results.some((trip) => !trip.direct);

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
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              {t("metro.live_mtr")}
              <span className="font-mono text-slate-400 dark:text-slate-500">{date}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenLegend && (
              <button
                type="button"
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
              type="button"
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

      <section className="mx-auto max-w-md space-y-3 px-4 py-4">
        {!error && results.length > 0 && (
          <WeatherWidget destination={destination} date={date} />
        )}

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <p className="text-sm font-bold">{t("result.unable_to_fetch")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{t("metro.no_departures")}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("metro.no_departures_hint")}</p>
          </div>
        ) : (
          <>
            {hasTransferResults && (
              <p className="rounded-xl bg-slate-200/60 px-4 py-2.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {t("metro.transfer_hint")}
              </p>
            )}
            {results.map((trip, index) => {
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
                  <div
                    className="px-4 sm:px-5 py-4"
                    style={{ borderLeft: `4px solid ${trip.lineColor || "#94a3b8"}` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {t("metro.towards", { destination: trip.headsign || destination })}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        </span>
                        {t("metro.realtime")}
                      </span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {t("metro.next_departure")}
                        </p>
                        <p className="font-mono text-4xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
                          {trip.departureTime}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-100 px-4 py-2 text-center dark:bg-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("metro.platform")}</p>
                        <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{trip.platform || trip.legs?.[0]?.platform || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />

                  {trip.warning ? (
                    <p className="mx-4 sm:mx-5 mb-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {trip.warning}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 sm:px-5 py-3 dark:border-slate-800">
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {trip.direct
                        ? `${trip.stops.length} ${t("result.stops")}`
                        : `${t("result.transfer")} · ${trip.transferStations?.join(", ") || ""}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(isSaved ? "light" : "success");
                        onSave(trip);
                      }}
                      className={`flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                        isSaved
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      {isSaved ? t("result.saved") : t("metro.save_departure")}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </>
        )}
      </section>
    </main>
  );
}
