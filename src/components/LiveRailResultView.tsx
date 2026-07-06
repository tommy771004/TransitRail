import { AlertTriangle, Bookmark, Check, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";

interface LiveRailResultViewProps {
  market: "london" | "boston";
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

function formatFare(trip: TransitResult) {
  if (trip.price === undefined || !trip.currency) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: trip.currency,
    minimumFractionDigits: 2,
  }).format(trip.price);
}

export function LiveRailResultView({
  market,
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
}: LiveRailResultViewProps) {
  const { t } = useTranslation();
  const isBoston = market === "boston";
  const copyKey = isBoston ? "boston" : "london";
  const country: Country = isBoston ? "united_states" : "united_kingdom";

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
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              {t(`${copyKey}.official_data`)}
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

          {error ? (
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
          ) : results.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t(`${copyKey}.no_journeys`)}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(`${copyKey}.no_journeys_hint`)}</p>
            </motion.div>
          ) : (
            <motion.div
              key="list-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {results.map((trip, index) => {
                  const isSaved = savedIds.has(trip.id);
                  const fare = formatFare(trip);
                  return (
                    <motion.article
                      key={trip.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
                      className="overflow-hidden rounded-3xl border border-slate-100 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300"
                    >
                      <div
                        className="px-5 py-5 sm:px-6"
                        style={{ borderLeft: `4px solid ${trip.lineColor || "#94a3b8"}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {trip.direct
                                ? t("result.direct")
                                : trip.transferStations && trip.transferStations.length > 0
                                  ? t("result.transfer_at", { station: trip.transferStations.join(", ") })
                                  : t("london.transfers")}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/5 dark:bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                              <span className="h-2 w-2 rounded-full bg-emerald-600" />
                            </span>
                            {t(`${copyKey}.current`)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
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
                          <div className="relative flex min-w-[75px] flex-col items-center">
                            <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">
                              {trip.durationMinutes ?? "-"} {t("london.minutes")}
                            </span>
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
                            <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.arrivalTime || "--:--"}</p>
                            <p className="mt-1.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                          </div>
                        </div>
                      </div>

                      <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />

                      {trip.warning ? (
                        <p className="mx-4 sm:mx-6 mb-4 flex items-start gap-1.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {trip.warning}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="min-w-0">
                          {isBoston ? (
                            <p className="truncate font-mono text-xs font-bold text-slate-400 dark:text-slate-500">{trip.trainType || "MBTA Rail"}</p>
                          ) : (
                            <p className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                              {trip.stops.length} {t("result.stops")}
                            </p>
                          )}
                          {fare ? (
                            <p className="mt-1 text-sm font-black text-slate-950 dark:text-emerald-400">
                              {(formatPrice ? formatPrice(trip) : null) || fare}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(isSaved ? "light" : "success");
                            onSave(trip);
                          }}
                          className={`flex h-9 items-center gap-1.5 rounded-2xl border px-4 text-xs font-black transition-all duration-200 ${
                            isSaved
                              ? "border-emerald-200 bg-emerald-50/80 text-emerald-600 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 shadow-2xs"
                          }`}
                        >
                          {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          {isSaved ? t("result.saved") : t("result.save_trip")}
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
