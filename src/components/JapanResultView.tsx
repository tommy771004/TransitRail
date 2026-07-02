import { ArrowRight, Bookmark, Check, ChevronRight, Edit2, Train } from "lucide-react";
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
    <main className="pt-12 pb-24">
      <section className="bg-white px-4 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center gap-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg font-semibold text-slate-900 truncate">{origin}</span>
              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-lg font-semibold text-slate-900 truncate">{destination}</span>
            </div>
            <p className="text-sm text-slate-600">{date} • 1 {t("result.adult")}</p>
          </div>
          <button
            onClick={onModify}
            className="flex items-center gap-1 px-3 py-2 bg-blue-50 rounded-xl text-slate-900 font-mono text-xs active:scale-95 transition-transform border border-slate-200 shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            {t("result.modify")}
          </button>
        </div>
      </section>

      <nav className="flex w-full bg-white border-b border-slate-200 sticky top-12 z-40">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => onSortChange(tab.mode)}
            className={`flex-1 py-3 font-mono text-xs border-b-2 ${
              sortMode === tab.mode
                ? "text-slate-900 border-slate-900"
                : "text-slate-500 border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
            <p className="font-semibold mb-1">{t("result.unable_to_fetch")}</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!error && results.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className="font-semibold text-slate-900">{t("result.no_results")}</p>
            <p className="text-sm text-slate-600 mt-1">{t("result.no_results_hint")}</p>
          </div>
        )}

        {!error && results.map((trip) => {
          const isSaved = savedIds.has(trip.id);
          return (
            <article key={trip.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-colors duration-150">
              <div className="p-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 bg-orange-600 text-white font-mono text-[10px] rounded uppercase truncate">
                      {trip.service}
                    </span>
                    <span className="text-sm text-slate-600 shrink-0">{formatDuration(trip.durationMinutes)}</span>
                  </div>
                  <span className="text-base font-bold text-slate-900 shrink-0">
                    {formatPrice(trip) || t("result.fare_unavailable")}
                  </span>
                </div>
                <div className="flex justify-between items-center relative">
                  <div className="flex flex-col min-w-0">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">{trip.departureTime}</span>
                    <span className="text-sm text-slate-600 truncate">{trip.origin}</span>
                  </div>
                  <div className="flex-1 mx-4 flex flex-col items-center min-w-12">
                    <div className="w-full h-[1px] journey-line relative">
                      <div className="absolute -top-1 left-0 w-2 h-2 rounded-full border border-slate-300 bg-white" />
                      <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border border-slate-300 bg-white" />
                    </div>
                    <Train className="w-4 h-4 text-slate-400 mt-1" />
                  </div>
                  <div className="flex flex-col items-end min-w-0">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">{trip.arrivalTime}</span>
                    <span className="text-sm text-slate-600 truncate">{trip.destination}</span>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 px-4 py-2 flex justify-between items-center border-t border-slate-200 gap-2">
                <span className="font-mono text-[10px] text-orange-700 truncate">
                  {trip.direct ? t("result.direct") : `${trip.stops.length} ${t("result.stops")}`} • {t("result.reserved_seat")}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSave(trip)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                      isSaved ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                    }`}
                    aria-label={isSaved ? t("result.saved") : t("result.save_trip")}
                  >
                    {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onSelectSeat(trip)}
                    className="h-8 px-3 rounded-lg bg-slate-900 text-white font-mono text-xs flex items-center gap-1"
                  >
                    {t("result.select_seat")}
                    <ChevronRight className="w-4 h-4" />
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
