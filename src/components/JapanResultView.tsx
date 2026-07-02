import { Bookmark, Check, ChevronRight, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SortMode, TransitResult } from "../types";

interface JapanResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
  results: TransitResult[];
  sortMode: SortMode;
  savedIds: Set<string>;
  onSortChange: (mode: SortMode) => void;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
}

const formatPrice = (trip: TransitResult) =>
  trip.price === undefined || !trip.currency ? null : new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: 0,
  }).format(trip.price);

const formatDuration = (minutes?: number) => {
  if (minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export function JapanResultView({
  origin,
  destination,
  date,
  error,
  results,
  sortMode,
  savedIds,
  onSortChange,
  onModify,
  onSave,
  onSelectSeat,
}: JapanResultViewProps) {
  const { t } = useTranslation();

  const tabs: Array<{ mode: SortMode; label: string }> = [
    { mode: "fastest", label: t("result.fastest") },
    { mode: "earliest", label: t("result.earliest") },
    { mode: "cheapest", label: t("result.cheapest") },
  ];

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
            <p className="mt-1 font-mono text-xs text-stone-500">{date} · 1 {t("result.adult")}</p>
          </div>
          <button
            onClick={onModify}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t("result.modify")}
          </button>
        </div>
      </section>

      <nav className="sticky top-14 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => onSortChange(tab.mode)}
              className={`flex-1 border-b-2 py-3 text-xs font-semibold ${
                sortMode === tab.mode
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="text-sm font-semibold">{t("result.unable_to_fetch")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!error && results.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-5 text-center">
            <p className="text-sm font-semibold text-stone-900">{t("result.no_results")}</p>
            <p className="mt-1 text-sm text-stone-500">{t("result.no_results_hint")}</p>
          </div>
        )}

        {!error && results.map((trip) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <article key={trip.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate rounded border-l-2 bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-800"
                      style={{ borderLeftColor: trip.lineColor || "#a8a29e" }}
                    >
                      {trip.service}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-stone-500">{formatDuration(trip.durationMinutes)}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-stone-900">
                    {formatPrice(trip) || t("result.fare_unavailable")}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-semibold leading-none tracking-tight text-stone-900">{trip.departureTime}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{trip.origin}</p>
                  </div>
                  <div className="flex min-w-14 items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-900" />
                    <span className="h-px flex-1 bg-stone-300" />
                    <span className="h-1.5 w-1.5 rounded-full border-2 border-stone-900 bg-white" />
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-mono text-2xl font-semibold leading-none tracking-tight text-stone-900">{trip.arrivalTime}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{trip.destination}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-4 py-2.5">
                <span className="truncate font-mono text-xs text-stone-500">
                  {trip.direct ? t("result.direct") : `${trip.stops.length} ${t("result.stops")}`} · {t("result.reserved_seat")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => onSave(trip)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      isSaved ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600"
                    }`}
                    aria-label={isSaved ? t("result.saved") : t("result.save_trip")}
                  >
                    {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => onSelectSeat(trip)}
                    className="flex h-8 items-center gap-1 rounded-lg bg-stone-900 px-3 text-xs font-medium text-white"
                  >
                    {t("result.select_seat")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
