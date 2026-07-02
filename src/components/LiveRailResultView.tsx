import { AlertTriangle, Bookmark, Check, Edit2 } from "lucide-react";
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
              {t(`${copyKey}.official_data`)}
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
            <p className="text-sm font-semibold text-stone-900">{t(`${copyKey}.no_journeys`)}</p>
            <p className="mt-1 text-sm text-stone-500">{t(`${copyKey}.no_journeys_hint`)}</p>
          </div>
        ) : results.map((trip) => {
          const isSaved = savedIds.has(trip.id);
          const fare = formatFare(trip);
          return (
            <article key={trip.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div
                className="border-l-4 px-4 py-3"
                style={{ borderLeftColor: trip.lineColor || "#a8a29e" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">{trip.service}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {trip.direct
                        ? t("result.direct")
                        : trip.transferStations && trip.transferStations.length > 0
                          ? t("result.transfer_at", { station: trip.transferStations.join(", ") })
                          : t("london.transfers")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    {t(`${copyKey}.current`)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-semibold leading-none tracking-tight text-stone-900">{trip.departureTime}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{trip.origin}</p>
                  </div>
                  <div className="flex min-w-16 flex-col items-center">
                    <p className="font-mono text-[11px] text-stone-500">
                      {trip.durationMinutes ?? "-"} {t("london.minutes")}
                    </p>
                    <div className="mt-1.5 flex w-full items-center gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-900" />
                      <span className="h-px flex-1 bg-stone-300" />
                      {!trip.direct && <span className="h-1.5 w-1.5 rounded-full border border-stone-400 bg-white" />}
                      {!trip.direct && <span className="h-px flex-1 bg-stone-300" />}
                      <span className="h-1.5 w-1.5 rounded-full border-2 border-stone-900 bg-white" />
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-mono text-2xl font-semibold leading-none tracking-tight text-stone-900">{trip.arrivalTime || "--:--"}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{trip.destination}</p>
                  </div>
                </div>
              </div>

              {trip.legs && trip.legs.length > 1 && (
                <div className="border-t border-stone-100 px-4 py-3">
                  <ol className="flex flex-wrap items-center gap-y-1">
                    {trip.legs.map((leg, index) => (
                      <li key={`${trip.id}-leg-${index}`} className="flex items-center text-xs">
                        {index > 0 && <span className="mx-2 text-stone-300">&rarr;</span>}
                        <span className="flex items-center gap-1.5 font-medium text-stone-700">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: leg.color || "#a8a29e" }}
                          />
                          {leg.lineName}
                          {typeof leg.stopCount === "number" ? (
                            <span className="font-mono text-[11px] font-normal text-stone-400">
                              {leg.stopCount} {t("result.stops")}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {trip.warning ? (
                <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {trip.warning}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-2.5">
                <div className="min-w-0">
                  {isBoston ? (
                    <p className="truncate font-mono text-xs text-stone-500">{trip.trainType || "MBTA Rail"}</p>
                  ) : (
                    <p className="font-mono text-xs text-stone-500">
                      {trip.stops.length} {t("result.stops")}
                    </p>
                  )}
                  {fare ? <p className="mt-0.5 text-sm font-semibold text-stone-900">{fare}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onSave(trip)}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
                    isSaved
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
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
