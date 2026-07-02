import { AlertTriangle, Bookmark, Check, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransitResult } from "../types";
import { TripDetails } from "./TripDetails";

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
  const hasTransferResults = results.some((trip) => !trip.direct);

  return (
    <main className="min-h-screen bg-stone-100 pb-28 pt-14">
      <section className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-stone-900">
              <span className="truncate">{origin}</span>
              <span className="shrink-0 text-stone-400">&rarr;</span>
              <span className="truncate">{destination}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {t("metro.live_mtr")}
              <span className="font-mono text-stone-400">{date}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onModify}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t("result.modify")}
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-md space-y-3 px-4 py-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="text-sm font-semibold">{t("result.unable_to_fetch")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 text-center">
            <p className="text-sm font-semibold text-stone-900">{t("metro.no_departures")}</p>
            <p className="mt-1 text-sm text-stone-500">{t("metro.no_departures_hint")}</p>
          </div>
        ) : (
          <>
            {hasTransferResults && (
              <p className="rounded-lg bg-stone-200/60 px-3 py-2 text-xs leading-relaxed text-stone-600">
                {t("metro.transfer_hint")}
              </p>
            )}
            {results.map((trip) => {
              const isSaved = savedIds.has(trip.id);
              return (
                <article key={trip.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div
                    className="border-l-4 px-4 py-3"
                    style={{ borderLeftColor: trip.lineColor || "#a8a29e" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">{trip.service}</p>
                        <p className="truncate text-xs text-stone-500">
                          {t("metro.towards", { destination: trip.headsign || destination })}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        {t("metro.realtime")}
                      </span>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                          {t("metro.next_departure")}
                        </p>
                        <p className="font-mono text-4xl font-semibold leading-none tracking-tight text-stone-900">
                          {trip.departureTime}
                        </p>
                      </div>
                      <div className="rounded-lg bg-stone-100 px-3 py-1.5 text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{t("metro.platform")}</p>
                        <p className="font-mono text-lg font-semibold text-stone-900">{trip.platform || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <TripDetails trip={trip} />

                  {trip.warning ? (
                    <p className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {trip.warning}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-2.5">
                    <p className="font-mono text-xs text-stone-500">
                      {trip.direct
                        ? `${trip.stops.length} ${t("result.stops")}`
                        : `${t("result.transfer")} · ${trip.transferStations?.join(", ") || ""}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSave(trip)}
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
                        isSaved
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      {isSaved ? t("result.saved") : t("metro.save_departure")}
                    </button>
                  </div>
                </article>
              );
            })}
          </>
        )}
      </section>
    </main>
  );
}
