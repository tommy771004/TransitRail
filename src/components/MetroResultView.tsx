// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Subway and Metro transit query results with staggered motion animations

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { stationLabel } from "../utils/stationLabel";
import { extractPathBetweenStations } from "../utils/pathExtractor";
import { TransitIcon, formatPlatform } from "./TransitIcon";
import {
  ResultShellHeader,
  SaveTripButton,
  renderEmptyBlock,
  renderErrorBlock,
  renderWeatherBlock,
  tripCardClass,
  tripCardMotion,
} from "./ResultShell";

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
  time?: string;
  error?: string;
  results: TransitResult[];
  savedIds: Set<string>;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
}

export function MetroResultView({
  country,
  origin,
  destination,
  date,
  time,
  error,
  results,
  savedIds,
  onModify,
  onSave,
  onOpenLegend,
  formatPrice,
  overview,
}: MetroResultViewProps) {
  const { t } = useTranslation();
  const hasTransferResults = results.some((trip) => !trip.direct);

  return (
    <main className="min-h-screen bg-transparent pb-28 pt-14">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="font-mono">{date}</span>
            {time ? <span className="font-mono text-slate-400 dark:text-slate-500">≥ {time}</span> : null}
          </p>
        }
        onModify={onModify}
        onOpenLegend={onOpenLegend}
      />

      {overview}

      <section className="mx-auto max-w-md space-y-3 px-4 py-4">
        <AnimatePresence mode="popLayout">
          {!error && results.length > 0 && renderWeatherBlock(destination, date, country)}

          {error ? (
            renderErrorBlock(t("result.unable_to_fetch"), error)
          ) : results.length === 0 ? (
            renderEmptyBlock(t("metro.no_departures"), t("metro.no_departures_hint"))
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
                      {...tripCardMotion(index, true)}
                      className={tripCardClass}
                    >
                      <div
                        className="px-5 py-5 sm:px-6"
                        style={{ borderLeft: `4px solid ${trip.lineColor || (pathData ? pathData.color : "#94a3b8")}` }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                              </span>
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            </div>
                            <p className="truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {t("metro.towards", { destination: stationLabel(t, trip.headsign || destination, trip.country) })}
                            </p>
                          </div>
                          {trip.realtime ? (
                            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/5 dark:bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                              </span>
                              {t("metro.realtime")}
                            </span>
                          ) : null}
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
                          {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t) && (
                            <div className="rounded-2xl bg-slate-50 px-4.5 py-2 text-center border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800/80">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("metro.platform")}</p>
                              <p className="font-mono text-base font-black text-slate-900 dark:text-white mt-0.5">
                                {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t)}
                              </p>
                            </div>
                          )}
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
                        <SaveTripButton
                          isSaved={isSaved}
                          onSave={() => onSave(trip)}
                          labeled
                          saveLabel={t("metro.save_departure")}
                        />
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

// --- End of MetroResultView.tsx ---
