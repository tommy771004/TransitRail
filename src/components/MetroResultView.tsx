import { AlertTriangle, Bookmark, Check, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";
import { extractPathBetweenStations } from "../utils/pathExtractor";

function getAlternatingColor(hex: string): string {
  if (!hex || !hex.startsWith("#")) return "#94a3b8";
  const cleanHex = hex.substring(1);
  if (cleanHex.length !== 6) return hex;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const altR = (r + 128) % 256;
  const altG = (g + 128) % 256;
  const altB = (b + 128) % 256;
  return `#${altR.toString(16).padStart(2, "0")}${altG.toString(16).padStart(2, "0")}${altB.toString(16).padStart(2, "0")}`;
}

interface MetroResultViewProps {
  country: Country;
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
  country,
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
              <span className="truncate">{stationLabel(t, origin, country)}</span>
              <span className="shrink-0 text-slate-400">&rarr;</span>
              <span className="truncate">{stationLabel(t, destination, country)}</span>
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t("metro.no_departures")}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("metro.no_departures_hint")}</p>
            </motion.div>
          ) : (
            <motion.div
              key="list-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {hasTransferResults && (
                <p className="rounded-xl bg-slate-200/60 px-4 py-2.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {t("metro.transfer_hint")}
                </p>
              )}
              <AnimatePresence mode="popLayout">
                {results.map((trip, index) => {
                  const isSaved = savedIds.has(trip.id);
                  const pathData = extractPathBetweenStations(
                    trip.legs?.[0]?.lineCode || trip.service,
                    trip.origin,
                    trip.destination
                  );
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
                        style={{ borderLeft: `4px solid ${trip.lineColor || (pathData ? pathData.color : "#94a3b8")}` }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            <p className="truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {t("metro.towards", { destination: stationLabel(t, trip.headsign || destination, trip.country) })}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/5 dark:bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                              <span className="h-2 w-2 rounded-full bg-emerald-600" />
                            </span>
                            {t("metro.realtime")}
                          </span>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              {t("metro.next_departure")}
                            </p>
                            <p className="font-mono text-4xl font-black leading-none tracking-tight text-slate-950 dark:text-white mt-1">
                              {trip.departureTime}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4.5 py-2 text-center border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800/80">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("metro.platform")}</p>
                            <p className="font-mono text-base font-black text-slate-900 dark:text-white mt-0.5">{trip.platform || trip.legs?.[0]?.platform || "-"}</p>
                          </div>
                        </div>
                      </div>

                      {pathData && (
                        <div className="mx-5 mb-5 sm:mx-6 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100/50 dark:border-slate-800/50">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <span>🗺️</span>
                            {pathData.name} Stops
                          </p>
                          <div className="relative pl-6 space-y-3">
                            <div
                              className="absolute left-[7px] top-1.5 bottom-1.5 w-0.5"
                              style={{
                                background: `linear-gradient(to bottom, ${pathData.color}, ${getAlternatingColor(pathData.color)})`,
                              }}
                            />
                            {pathData.stations.map((station, sIdx) => {
                              const isEven = sIdx % 2 === 0;
                              const dotColor = isEven ? pathData.color : getAlternatingColor(pathData.color);
                              return (
                                <motion.div 
                                  key={sIdx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.05 + sIdx * 0.04 + 0.1 }}
                                  className="relative flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="absolute left-[-23px] h-3 w-3 rounded-full border-2 border-white dark:border-slate-900"
                                      style={{ backgroundColor: dotColor }}
                                    />
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {stationLabel(t, station.name, trip.country)}
                                    </span>
                                  </div>
                                  {station.interchanges && station.interchanges.length > 0 && (
                                    <div className="flex gap-1 flex-wrap justify-end max-w-[40%]">
                                      {station.interchanges.map((ic, icIdx) => (
                                        <span
                                          key={icIdx}
                                          className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium truncate"
                                        >
                                          {ic}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />

                      {trip.warning ? (
                        <p className="mx-4 sm:mx-6 mb-4 flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/10 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          {trip.warning}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                        <p className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
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
                          className={`flex h-9 items-center gap-1.5 rounded-2xl border px-4 text-xs font-black transition-all duration-200 ${
                            isSaved
                              ? "border-emerald-200 bg-emerald-50/80 text-emerald-600 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 shadow-2xs"
                          }`}
                        >
                          {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          {isSaved ? t("result.saved") : t("metro.save_departure")}
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
