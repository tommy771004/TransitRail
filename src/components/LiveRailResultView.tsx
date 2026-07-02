import { AlertTriangle, ArrowRight, Bookmark, Check, Clock3, Edit2, Radio, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransitResult } from "../types";

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
}: LiveRailResultViewProps) {
  const { t } = useTranslation();
  const isBoston = market === "boston";
  const copyKey = isBoston ? "boston" : "london";
  const headerColor = isBoston ? "bg-[#da291c]" : "bg-[#0019a8]";
  const headerAccent = isBoston ? "text-red-100" : "text-blue-100";

  return (
    <main className="min-h-screen bg-slate-100 pb-28 pt-12">
      <section className={`border-b border-slate-200 px-4 py-5 text-white ${headerColor}`}>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-lg font-bold">{origin}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-blue-200" />
              <span className="truncate text-lg font-bold">{destination}</span>
            </div>
            <p className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${headerAccent}`}>
              <Radio className="h-3.5 w-3.5" />
              {t(`${copyKey}.official_data`)} / {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onModify}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t("result.modify")}
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-md space-y-3 px-4 py-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-bold">{t("result.unable_to_fetch")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
            <p className="font-bold">{t(`${copyKey}.no_journeys`)}</p>
            <p className="mt-1 text-sm text-slate-600">{t(`${copyKey}.no_journeys_hint`)}</p>
          </div>
        ) : results.map((trip) => {
          const isSaved = savedIds.has(trip.id);
          const fare = formatFare(trip);
          return (
            <article key={trip.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{trip.service}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {trip.direct ? t("result.direct") : t("london.transfers")}
                    {trip.headsign ? ` / ${trip.headsign}` : ""}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <Radio className="h-3 w-3" />
                  {t(`${copyKey}.current`)}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
                <div>
                  <p className="text-3xl font-black leading-none text-slate-950">{trip.departureTime}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{trip.origin}</p>
                </div>
                <div className="flex min-w-20 flex-col items-center">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Clock3 className="h-3 w-3" />
                    {trip.durationMinutes ?? "-"} {t("london.minutes")}
                  </p>
                  <div className="my-2 h-px w-full bg-slate-300" />
                  <Route className="h-4 w-4 text-blue-700" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black leading-none text-slate-950">{trip.arrivalTime || "--:--"}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{trip.destination}</p>
                </div>
              </div>

              {trip.warning ? (
                <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {trip.warning}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                <div>
                  {isBoston ? (
                    <p className="text-xs font-semibold text-slate-500">{trip.trainType || "MBTA Rail"}</p>
                  ) : (
                    <p className="text-xs font-semibold text-slate-500">
                      {trip.stops.length} {t("result.stops")}
                    </p>
                  )}
                  {fare ? <p className="mt-0.5 text-sm font-black text-slate-900">{fare}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onSave(trip)}
                  className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${
                    isSaved
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  {isSaved ? t("result.saved") : t("result.save_trip")}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
