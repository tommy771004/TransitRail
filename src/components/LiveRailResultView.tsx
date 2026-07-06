import { AlertTriangle, Bookmark, Check, Edit2, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { TransitResult } from "../types";
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
            <p className="text-sm font-bold text-slate-900 dark:text-white">{t(`${copyKey}.no_journeys`)}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(`${copyKey}.no_journeys_hint`)}</p>
          </div>
        ) : results.map((trip, index) => {
          const isSaved = savedIds.has(trip.id);
          const fare = formatFare(trip);
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{trip.service}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {trip.direct
                        ? t("result.direct")
                        : trip.transferStations && trip.transferStations.length > 0
                          ? t("result.transfer_at", { station: trip.transferStations.join(", ") })
                          : t("london.transfers")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    </span>
                    {t(`${copyKey}.current`)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{trip.departureTime}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{stationLabel(t, trip.origin, trip.country)}</span>
                      {(trip.platform || trip.legs?.[0]?.platform) && (
                        <span className="shrink-0 inline-flex items-center rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {t("result.plat_label", { defaultValue: "Plat" })} {trip.platform || trip.legs?.[0]?.platform}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex min-w-16 flex-col items-center">
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {trip.durationMinutes ?? "-"} {t("london.minutes")}
                    </p>
                    <div className="mt-1.5 flex w-full items-center gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                      <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
                      {!trip.direct && <span className="h-1.5 w-1.5 rounded-full border border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900" />}
                      {!trip.direct && <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />}
                      <span className="h-1.5 w-1.5 rounded-full border-2 border-slate-900 bg-white dark:border-slate-100 dark:bg-slate-900" />
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-mono text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{trip.arrivalTime || "--:--"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{stationLabel(t, trip.destination, trip.country)}</p>
                  </div>
                </div>
              </div>

              <TripDetails trip={trip} onOpenLegend={onOpenLegend} formatPrice={formatPrice} />

              {trip.warning ? (
                <p className="mx-4 sm:mx-5 mb-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {trip.warning}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 sm:px-5 py-3 dark:border-slate-800">
                <div className="min-w-0">
                  {isBoston ? (
                    <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{trip.trainType || "MBTA Rail"}</p>
                  ) : (
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {trip.stops.length} {t("result.stops")}
                    </p>
                  )}
                  {fare ? <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{(formatPrice ? formatPrice(trip) : null) || fare}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(isSaved ? "light" : "success");
                    onSave(trip);
                  }}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                    isSaved
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                  {isSaved ? t("result.saved") : t("result.save_trip")}
                </button>
              </div>
            </motion.article>
          );
        })}
      </section>
    </main>
  );
}
