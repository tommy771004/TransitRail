// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render UK, US, and Swiss transit query results with staggered motion animations

import { AlertTriangle } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { stationLabel, stationListLabel } from "../utils/stationLabel";
import { TransitIcon, formatPlatform } from "./TransitIcon";
import {
  ResultShellHeader,
  SaveTripButton,
  TimelineBar,
  renderEmptyBlock,
  renderMissBlock,
  renderWeatherBlock,
  tripCardClass,
  tripCardMotion,
  formatDuration,
} from "./ResultShell";

interface LiveRailResultViewProps {
  market: "london" | "boston" | "switzerland" | "belgium" | "norway";
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

function formatFare(trip: TransitResult) {
  if (trip.price === undefined || !trip.currency) return null;
  return new Intl.NumberFormat(trip.country === "switzerland" ? "de-CH" : "en-GB", {
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
}: LiveRailResultViewProps) {
  const { t } = useTranslation();
  const isBoston = market === "boston";
  const isSwiss = market === "switzerland";
  const isBelgium = market === "belgium";
  const isNorway = market === "norway";
  const copyKey = isBoston ? "boston" : isSwiss ? "switzerland" : isBelgium ? "belgium" : isNorway ? "norway" : "london";
  const country: Country = isBoston ? "united_states" : isSwiss ? "switzerland" : isBelgium ? "belgium" : isNorway ? "norway" : "united_kingdom";
  const fallbackAccent = isSwiss ? "#D52B1E" : isBelgium ? "#E2001A" : isNorway ? "#8B1D3D" : country === "united_kingdom" ? "#2563EB" : "#10B981";

  return (
    <main className="min-h-screen bg-transparent pb-nav pt-16">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        sectionClassName={`border-b px-4 py-4 backdrop-blur-sm ${isSwiss ? "border-rose-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,246,246,0.98)_72%,rgba(255,237,237,0.98)_100%)] dark:border-rose-900/40 dark:bg-[linear-gradient(135deg,rgba(12,12,12,0.96)_0%,rgba(44,10,14,0.96)_100%)]" : "border-slate-200/80 bg-white/95 dark:border-slate-700/50 dark:bg-slate-900/95"}`}
        meta={
          <p className={`m3-body-small mt-1 flex flex-wrap items-center gap-1.5 ${isSwiss ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute h-full w-full animate-ping rounded-full opacity-60 ${isSwiss ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span className={`h-2 w-2 rounded-full ${isSwiss ? "bg-rose-600" : "bg-emerald-600"}`} />
            </span>
            {t(`${copyKey}.official_data`, { defaultValue: isBelgium ? "Official iRail timetable data" : "Official timetable data" })}
            <span className="font-mono text-slate-400 dark:text-slate-500">{date}</span>
            {time ? <span className="font-mono text-slate-400 dark:text-slate-500">≥ {time}</span> : null}
            {isSwiss ? <span className="m3-chip m3-label-small m3-shape-full min-h-6 bg-rose-700 px-3 uppercase tracking-[0.18em] text-white dark:bg-rose-500 dark:text-slate-950">OJP 2.0</span> : null}
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
            renderEmptyBlock(t(`${copyKey}.no_journeys`), t(`${copyKey}.no_journeys_hint`))
          ) : (
            <motion.div
              key="list-container"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {results.map((trip, index) => {
                  const isSaved = savedIds.has(trip.id);
                  const fare = formatFare(trip);
                  return (
                    <Fragment key={trip.id}>
                    <motion.article
                      {...tripCardMotion(index, true)}
                      className={tripCardClass}
                    >
                      <div
                        className="px-5 py-5 sm:px-6"
                        style={{ borderLeft: `4px solid ${trip.lineColor || "#94a3b8"}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="m3-shape-sm shrink-0 bg-slate-100 p-1 dark:bg-slate-800">
                                <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                              </span>
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            </div>
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {trip.direct
                                ? t("result.direct")
                                : trip.transferStations && trip.transferStations.length > 0
                                  ? t("result.transfer_at", { station: stationListLabel(t, trip.transferStations, country) })
                                  : t("london.transfers")}
                            </p>
                          </div>
                          <span className={`m3-chip m3-label-small min-h-7 shrink-0 gap-1.5 px-3 ${isSwiss ? "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300" : "bg-emerald-500/5 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"}`}>
                            <span className="relative flex h-2 w-2">
                              <span className={`absolute h-full w-full animate-ping rounded-full opacity-60 ${isSwiss ? "bg-rose-500" : "bg-emerald-500"}`} />
                              <span className={`h-2 w-2 rounded-full ${isSwiss ? "bg-rose-600" : "bg-emerald-600"}`} />
                            </span>
                            {t(`${copyKey}.current`)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                          <div className="min-w-0">
                            <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.departureTime}</p>
                            {trip.realtime && typeof trip.delayMinutes === "number" && (
                              <p className={`m3-label-medium mt-1 font-mono ${trip.delayMinutes > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {trip.delayMinutes > 0
                                  ? `+${trip.delayMinutes} ${t("result.delay_min", { defaultValue: "min" })}`
                                  : t("result.on_time", { defaultValue: "On time" })}
                              </p>
                            )}
                            <p className="m3-body-small mt-1.5 flex items-center gap-1.5 truncate text-slate-500 dark:text-slate-400">
                              <span className="truncate">{stationLabel(t, trip.origin, trip.country)}</span>
                              {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t) && (
                                <span className="m3-label-small m3-shape-xs inline-flex shrink-0 items-center bg-slate-100/80 px-1.5 py-0.5 font-mono uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {formatPlatform(trip.platform || trip.legs?.[0]?.platform, t)}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="relative flex min-w-[75px] flex-col items-center">
                            <span className="m3-label-small mb-1 font-mono text-slate-400 dark:text-slate-500">
                              {formatDuration(t, trip.durationMinutes) ?? "-"}
                            </span>
                            <TimelineBar color={trip.lineColor || fallbackAccent} direct={!!trip.direct} />
                          </div>

                          <div className="min-w-0 text-right">
                            <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.arrivalTime || "--:--"}</p>
                            <p className="m3-body-small mt-1.5 truncate text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                          </div>
                        </div>
                      </div>

                      <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />

                      {trip.warning ? (
                        <p className="mx-4 sm:mx-6 m3-card m3-body-small mb-4 flex items-start gap-1.5 border border-amber-100/50 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {trip.warning}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="min-w-0">
                          {isBoston ? (
                            <p className="truncate font-mono text-xs font-bold text-slate-400 dark:text-slate-500">{trip.trainType || "MBTA Rail"}</p>
                          ) : (
                            // A source that publishes no intermediate stops leaves
                            // `stops` empty. Printing its length said "0 stops",
                            // which reads as a claim about the train rather than
                            // about the data — Entur, Swiss GTFS and KTMB all
                            // answer without a stop list.
                            trip.stops.length > 0 ? (
                            <p className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                              {trip.stops.length} {t("result.stops")}
                            </p>
                            ) : trip.direct ? (
                            <p className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                              {t("result.direct")}
                            </p>
                            ) : null
                          )}
                          {fare ? (
                            <p className={`m3-title-medium mt-1 ${isSwiss ? "text-rose-700 dark:text-rose-300" : "text-slate-950 dark:text-emerald-400"}`}>
                              {(formatPrice ? formatPrice(trip) : null) || fare}
                            </p>
                          ) : null}
                        </div>
                        <SaveTripButton isSaved={isSaved} onSave={() => onSave(trip)} labeled />
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

// --- End of LiveRailResultView.tsx ---
