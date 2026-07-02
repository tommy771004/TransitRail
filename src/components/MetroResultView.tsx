import { AlertTriangle, ArrowRight, Bookmark, Check, Clock3, Edit2, Radio, TrainFront } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransitResult } from "../types";

interface MetroResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
  results: TransitResult[];
  savedIds: Set<string>;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
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
}: MetroResultViewProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-slate-100 pb-28 pt-12">
      <section className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-lg font-bold">{origin}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate text-lg font-bold">{destination}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Radio className="h-3.5 w-3.5" />
              {t("metro.live_mtr")} / {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onModify}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
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
            <p className="font-bold">{t("metro.no_departures")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("metro.no_departures_hint")}</p>
          </div>
        ) : results.map((trip) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <article key={trip.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <TrainFront className="h-5 w-5 shrink-0 text-blue-700" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{trip.service}</p>
                    <p className="truncate text-xs text-slate-500">
                      {t("metro.towards", { destination: trip.headsign || destination })}
                    </p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <Radio className="h-3 w-3" />
                  {t("metro.realtime")}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {t("metro.next_departure")}
                  </p>
                  <p className="mt-1 text-4xl font-black leading-none text-slate-950">{trip.departureTime}</p>
                </div>
                <div className="min-w-20 rounded-lg bg-blue-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase text-blue-600">{t("metro.platform")}</p>
                  <p className="text-xl font-black text-blue-900">{trip.platform || "-"}</p>
                </div>
              </div>

              {trip.warning ? (
                <p className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {trip.warning}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  {trip.stops.length} {t("result.stops")}
                </p>
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
                  {isSaved ? t("result.saved") : t("metro.save_departure")}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
