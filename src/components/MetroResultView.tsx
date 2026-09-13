// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Subway and Metro transit query results with staggered motion animations

import { AlertTriangle } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { stationLabel, stationListLabel } from "../utils/stationLabel";
import { extractPathBetweenStations } from "../utils/pathExtractor";
import { TransitIcon, formatPlatform } from "./TransitIcon";
import {
  ResultShellHeader,
  SaveTripButton,
  renderEmptyBlock,
  renderMissBlock,
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
  noResultReason?: NoResultReason;
  failureKind?: SearchFailureKind;
  officialSourceUrl?: string;
  coverageGap?: CoverageGap;
  results: TransitResult[];
  savedIds: Set<string>;
  onModify: () => void;
  onRetry?: () => void;
  onSave: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
  afterFirstResult?: ReactNode;
}

export function MetroResultView({
  country,
  origin,
  destination,
  date,
  time,
  error,
  noResultReason,
  failureKind,
  officialSourceUrl,
  coverageGap,
  results,
  savedIds,
  onModify,
  onRetry,
  onSave,
  onOpenLegend,
  formatPrice,
  overview,
  afterFirstResult,
}: MetroResultViewProps) {
  const { t } = useTranslation();
  const hasTransferResults = results.some((trip) => !trip.direct);

  return (
    <main className="min-h-screen bg-transparent pb-nav pt-16">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={
          <p className="m3-body-small mt-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
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
          {error ? (
            renderMissBlock({
              message: error,
              reason: noResultReason,
              failureKind,
              coverageGap,
              country,
              sourceUrl: officialSourceUrl,
              errorTitle: t("result.unable_to_fetch"),
              onModify,
              onRetry,
            })
          ) : results.length === 0 ? (
            renderEmptyBlock(t("metro.no_departures"), t("metro.no_departures_hint"))
          ) : (
            <motion.div
              key="list-container"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {hasTransferResults && (
                <p className="m3-card m3-body-small bg-slate-200/60 px-4 py-3 leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-400">
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
                    <Fragment key={trip.id}>
                    <motion.article
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
                              <span className="m3-shape-sm shrink-0 bg-slate-100 p-1 dark:bg-slate-800">
                                <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                              </span>
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            </div>
                            <p className="truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {t("metro.towards", { destination: stationLabel(t, trip.headsign || destination, trip.country) })}
                            </p>
                          </div>
                          {trip.realtime ? (
                            <span className="m3-chip m3-label-small min-h-7 shrink-0 gap-1.5 bg-emerald-500/5 px-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
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
                            <p className="m3-label-small uppercase text-slate-400 dark:text-slate-500">
                              {t("metro.next_departure")}
                            </p>
                            <p className="m3-headline-large mt-1 font-mono font-bold text-slate-950 dark:text-white">
                              {trip.departureTime}
                            </p>
                          </div>
                          {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t) && (
                            <div className="m3-card border border-slate-100 bg-slate-50 px-4.5 py-2 text-center dark:border-slate-800/80 dark:bg-slate-800/60">
                              <p className="m3-label-small uppercase text-slate-400 dark:text-slate-500">{t("metro.platform")}</p>
                              <p className="m3-title-medium mt-0.5 font-mono text-slate-900 dark:text-white">
                                {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {pathData && (
                        <div className="m3-card mx-5 mb-5 border border-slate-100/50 bg-slate-50/50 p-4 sm:mx-6 dark:border-slate-800/50 dark:bg-slate-800/20">
                          <p className="m3-label-small mb-3 flex items-center gap-1.5 uppercase text-slate-400 dark:text-slate-500">
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
                                  initial={false}
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
                                          className="m3-label-small m3-shape-xs truncate bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
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
                        <p className="mx-4 sm:mx-6 m3-card m3-body-small mb-4 flex items-center gap-1.5 border border-amber-100/50 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          {trip.warning}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                        <p className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                          {trip.direct
                            ? (trip.stops.length > 0
                              ? `${trip.stops.length} ${t("result.stops")}`
                              // No stop list from the source is not zero stops.
                              : t("result.direct"))
                            : `${t("result.transfer")} · ${stationListLabel(t, trip.transferStations || [], country)}`}
                        </p>
                        <SaveTripButton
                          isSaved={isSaved}
                          onSave={() => onSave(trip)}
                          labeled
                          saveLabel={t("metro.save_departure")}
                        />
                      </div>
                    </motion.article>
                    {index === 0 ? <>{renderWeatherBlock(destination, date, country)}{afterFirstResult}</> : null}
                    </Fragment>
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
