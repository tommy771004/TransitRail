// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render UK, US, and Swiss transit query results with staggered motion animations

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { Country, TransitResult } from "../types";
import { TripDetails } from "./TripDetails";
import { stationLabel } from "../utils/stationLabel";
import { TransitIcon, formatPlatform } from "./TransitIcon";
import {
  ResultShellHeader,
  SaveTripButton,
  TimelineBar,
  renderEmptyBlock,
  renderErrorBlock,
  renderWeatherBlock,
  tripCardClass,
  tripCardMotion,
} from "./ResultShell";

interface LiveRailResultViewProps {
  market: "london" | "boston" | "switzerland" | "belgium" | "norway";
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
  results,
  savedIds,
  onModify,
  onSave,
  onOpenLegend,
  formatPrice,
  overview,
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
    <main className="min-h-screen bg-transparent pb-28 pt-14">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        sectionClassName={`border-b px-4 py-4 backdrop-blur-sm ${isSwiss ? "border-rose-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,246,246,0.98)_72%,rgba(255,237,237,0.98)_100%)] dark:border-rose-900/40 dark:bg-[linear-gradient(135deg,rgba(12,12,12,0.96)_0%,rgba(44,10,14,0.96)_100%)]" : "border-slate-200/80 bg-white/95 dark:border-slate-700/50 dark:bg-slate-900/95"}`}
        meta={
          <p className={`mt-1 flex items-center gap-1.5 text-xs font-bold ${isSwiss ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute h-full w-full animate-ping rounded-full opacity-60 ${isSwiss ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span className={`h-2 w-2 rounded-full ${isSwiss ? "bg-rose-600" : "bg-emerald-600"}`} />
            </span>
            {t(`${copyKey}.official_data`, { defaultValue: isBelgium ? "Official iRail timetable data" : "Official timetable data" })}
            <span className="font-mono text-slate-400 dark:text-slate-500">{date}</span>
            {time ? <span className="font-mono text-slate-400 dark:text-slate-500">≥ {time}</span> : null}
            {isSwiss ? <span className="rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white dark:bg-rose-500 dark:text-slate-950">OJP 2.0</span> : null}
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
            renderEmptyBlock(t(`${copyKey}.no_journeys`), t(`${copyKey}.no_journeys_hint`))
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
                              <span className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                              </span>
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                            </div>
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-400 dark:text-slate-500">
                              {trip.direct
                                ? t("result.direct")
                                : trip.transferStations && trip.transferStations.length > 0
                                  ? t("result.transfer_at", { station: trip.transferStations.join(", ") })
                                  : t("london.transfers")}
                            </p>
                          </div>
                          <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${isSwiss ? "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300" : "bg-emerald-500/5 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"}`}>
                            <span className="relative flex h-2 w-2">
                              <span className={`absolute h-full w-full animate-ping rounded-full opacity-60 ${isSwiss ? "bg-rose-500" : "bg-emerald-500"}`} />
                              <span className={`h-2 w-2 rounded-full ${isSwiss ? "bg-rose-600" : "bg-emerald-600"}`} />
                            </span>
                            {t(`${copyKey}.current`)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                          <div className="min-w-0">
                            <p className="font-mono text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{trip.departureTime}</p>
                            {trip.realtime && typeof trip.delayMinutes === "number" && (
                              <p className={`mt-1 font-mono text-[11px] font-black ${trip.delayMinutes > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {trip.delayMinutes > 0
                                  ? `+${trip.delayMinutes} ${t("result.delay_min", { defaultValue: "min" })}`
                                  : t("result.on_time", { defaultValue: "On time" })}
                              </p>
                            )}
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
                            <span className="mb-1 font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              {trip.durationMinutes ?? "-"} {t(`${copyKey}.minutes`, { defaultValue: "min" })}
                            </span>
                            <TimelineBar color={trip.lineColor || fallbackAccent} direct={!!trip.direct} />
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
                            <p className={`mt-1 text-sm font-black ${isSwiss ? "text-rose-700 dark:text-rose-300" : "text-slate-950 dark:text-emerald-400"}`}>
                              {(formatPrice ? formatPrice(trip) : null) || fare}
                            </p>
                          ) : null}
                        </div>
                        <SaveTripButton isSaved={isSaved} onSave={() => onSave(trip)} labeled />
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

// --- End of LiveRailResultView.tsx ---
