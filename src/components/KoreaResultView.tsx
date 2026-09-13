// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Component to render Korea transit query results with staggered motion animations

import { hasDisplayableFare } from "@/src/utils/fare";
import { AlertTriangle, Utensils, Wifi, Zap } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { CoverageGap, NoResultReason, KoreaFilter, SearchFailureKind, TransitResult } from "../types";
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
  renderMissBlock,
  tripCardClass,
  tripCardMotion,
} from "./ResultShell";

interface KoreaResultViewProps {
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
  filter: KoreaFilter;
  savedIds: Set<string>;
  onFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onRetry?: () => void;
  recovery?: ReactNode;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
  afterResults?: ReactNode;
}

const formatLocalPrice = (trip: TransitResult) =>
  !hasDisplayableFare(trip) ? null : new Intl.NumberFormat("ko-KR", {
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
  noResultReason,
  failureKind,
  officialSourceUrl,
  coverageGap,
  results,
  filter,
  savedIds,
  onFilterChange,
  onModify,
  onRetry,
  recovery,
  onSave,
  onSelectSeat,
  onOpenLegend,
  formatPrice,
  overview,
  afterResults,
}: KoreaResultViewProps) {
  const { t } = useTranslation();
  const filters: Array<{ key: KoreaFilter; label: string }> = [
    { key: "all", label: t("result.all_times") },
    { key: "cheapest", label: t(time ? "journey.secondary_cheapest" : "result.cheapest_first") },
    { key: "direct", label: t("result.direct") },
    { key: "first_class", label: t("result.first_class") },
  ];

  return (
    <main className="min-h-screen bg-transparent pb-nav pt-16">
      <ResultShellHeader
        country="korea"
        origin={origin}
        destination={destination}
        meta={null}
        weatherDate={!error && results.length > 0 ? date : undefined}
        onModify={onModify}
        onOpenLegend={onOpenLegend}
      />

      {overview}

      {!error && results.length > 0 && <div className="sticky top-16 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto max-w-md overflow-x-auto px-4 py-3 no-scrollbar">
          <div
            data-korea-filter-control="true"
            className="m3-shape-full flex w-max min-w-full overflow-hidden divide-x divide-slate-300 border border-slate-300 dark:divide-slate-600 dark:border-slate-600"
            role="group"
            aria-label={t("result.filter", { defaultValue: "篩選車次" })}
          >
            {filters.map((item) => (
              <button
                key={item.key}
                aria-pressed={filter === item.key}
                onClick={() => {
                  triggerHaptic("light");
                  onFilterChange(item.key);
                }}
                className={`m3-state m3-label-large relative flex min-h-12 min-w-24 flex-1 shrink-0 items-center justify-center px-3 py-2 text-center leading-tight ${
                  filter === item.key
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "bg-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span className="relative z-10">{item.label}</span>
                {filter === item.key && (
                  <motion.div
                    layoutId="koreaActiveFilterBg"
                    className="absolute inset-0 bg-emerald-50 dark:bg-emerald-950/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>}
      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        <AnimatePresence mode="popLayout">
          {error && renderMissBlock({
            message: error,
            reason: noResultReason,
            failureKind,
            coverageGap,
            country: "korea",
            sourceUrl: officialSourceUrl,
            errorTitle: t("result.unable_to_fetch"),
            onModify,
            onRetry,
            recovery,
          })}
          {!error && results.length === 0 && renderEmptyBlock(t("result.no_results"), t("result.no_results_hint"))}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {!error && results.map((trip, index) => {
          const isSaved = savedIds.has(trip.id);
          const fare = hasDisplayableFare(trip) ? formatPrice?.(trip) || formatLocalPrice(trip) : null;
          return (
            <Fragment key={trip.id}>
            <motion.article
              {...tripCardMotion(index)}
              className={tripCardClass}
            >
              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="m3-chip m3-label-medium max-w-full truncate border border-slate-100 bg-slate-50 px-3 text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                        style={{ borderLeft: `3.5px solid ${trip.lineColor || "#94a3b8"}` }}
                      >
                        <TransitIcon trip={trip} className="h-3.5 w-3.5" />
                        <span>{trip.service}</span>
                      </span>
                      <span className="m3-label-small truncate font-mono text-slate-400 dark:text-slate-500">{trip.trainType || trip.operator}</span>
                    </div>
                  </div>
                  {(fare || trip.seatClass) && <div className="shrink-0 text-right">
                    {fare && <span className="m3-chip m3-title-small border border-slate-100 bg-slate-50 px-3 text-slate-900 dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-emerald-400">
                      {fare}
                    </span>}
                    {trip.seatClass && <p className="m3-label-small mt-1 uppercase text-slate-400 dark:text-slate-500">
                      {trip.seatClass === "first" ? t("result.first_class") : t("result.economy_class")}
                    </p>}
                  </div>}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-1">
                  <div className="min-w-0">
                    <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.departureTime}</p>
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
                    <span className="m3-label-small mb-1 font-mono text-emerald-600 dark:text-emerald-400">
                      {formatDuration(t, trip.durationMinutes)}
                    </span>
                    <TimelineBar color={trip.lineColor || "#10b981"} direct={!!trip.direct} />
                    <span className="mt-1 font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {trip.direct ? t("result.non_stop") : `${trip.stops.length} ${t("result.stops")}`}
                    </span>
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="m3-headline-medium font-mono font-bold text-slate-950 dark:text-white">{trip.arrivalTime}</p>
                    <p className="m3-body-small mt-1.5 truncate text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
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
                    <p className="m3-body-small flex items-center gap-1 truncate text-amber-800 dark:text-amber-400">
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
                    className="m3-button m3-button-small m3-state gap-1 bg-emerald-600 text-white"
                  >
                    {t("result.select_seat")}
                  </button>
                </div>
              </div>
            </motion.article>
            {index === results.length - 1 ? afterResults : null}
            </Fragment>
          );
        })}
        </AnimatePresence>
      </div>
    </main>
  );
}

// --- End of KoreaResultView.tsx ---
