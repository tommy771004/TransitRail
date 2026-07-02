import { AlertTriangle, ArrowRight, Bookmark, Calendar, Check, Edit2, Utensils, Wifi, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KoreaFilter, TransitResult } from "../types";

interface KoreaResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
  results: TransitResult[];
  filter: KoreaFilter;
  savedIds: Set<string>;
  onFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
}

const formatPrice = (trip: TransitResult) =>
  trip.price === undefined || !trip.currency ? null : new Intl.NumberFormat("ko-KR", {
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

export function KoreaResultView({
  origin,
  destination,
  date,
  error,
  results,
  filter,
  savedIds,
  onFilterChange,
  onModify,
  onSave,
  onSelectSeat,
}: KoreaResultViewProps) {
  const { t } = useTranslation();
  const filters: Array<{ key: KoreaFilter; label: string }> = [
    { key: "all", label: t("result.all_times") },
    { key: "cheapest", label: t("result.cheapest_first") },
    { key: "direct", label: t("result.direct") },
    { key: "first_class", label: t("result.first_class") },
  ];

  return (
    <main className="pb-24 min-h-screen">
      <div className="mt-12 bg-slate-900 text-white px-4 py-6 shadow-md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 font-mono text-xs mb-1">{t("result.origin_label")}</span>
            <span className="text-lg font-bold truncate">{origin}</span>
          </div>
          <div className="px-2 shrink-0">
            <ArrowRight className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex flex-col text-right min-w-0">
            <span className="text-slate-400 font-mono text-xs mb-1">{t("result.destination_label")}</span>
            <span className="text-lg font-bold truncate">{destination}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 bg-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-3 min-w-0">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-300 truncate">{date} • 1 {t("result.adult")}</span>
          </div>
          <button
            onClick={onModify}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-white font-mono text-xs shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            {t("result.modify")}
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-4 overflow-x-auto no-scrollbar bg-slate-50 sticky top-12 z-40">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => onFilterChange(item.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-mono text-xs border ${
              filter === item.key
                ? "bg-slate-900 text-white border-slate-900"
                : "border-slate-300 text-slate-600 bg-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4 mt-2">
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
            <article key={trip.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="bg-orange-50 text-orange-600 font-mono text-[10px] px-2 py-0.5 rounded border border-orange-200 truncate">
                    {trip.service}
                  </span>
                  <span className="text-slate-600 text-sm truncate">{trip.trainType || trip.operator}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-slate-900">
                    {formatPrice(trip) || t("result.fare_unavailable")}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">
                    {trip.seatClass === "first" ? t("result.first_class") : t("result.economy_class")}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center relative py-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">{trip.departureTime}</span>
                  <span className="text-sm text-slate-600 truncate">{trip.origin}</span>
                </div>
                <div className="flex-1 px-4 flex flex-col items-center min-w-16">
                  <span className="text-[11px] font-mono text-slate-500 mb-1">{formatDuration(trip.durationMinutes)}</span>
                  <div className="w-full h-[1px] bg-slate-300 relative">
                    <div className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-slate-900" />
                    {!trip.direct && <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />}
                    <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border-2 border-slate-900 bg-white" />
                  </div>
                  <span className="text-[10px] font-mono text-orange-600 mt-1">
                    {trip.direct ? t("result.non_stop") : `${trip.stops.length} ${t("result.stops")}`}
                  </span>
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">{trip.arrivalTime}</span>
                  <span className="text-sm text-slate-600 truncate">{trip.destination}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {(trip.amenities || []).includes("wifi") && <Wifi className="w-4 h-4 text-slate-400 shrink-0" />}
                  {(trip.amenities || []).includes("power") && <Zap className="w-4 h-4 text-slate-400 shrink-0" />}
                  {(trip.amenities || []).includes("food") && <Utensils className="w-4 h-4 text-slate-400 shrink-0" />}
                  {trip.warning && (
                    <p className="text-[11px] text-red-600 font-medium italic flex items-center gap-1 truncate">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {trip.warning}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSave(trip)}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                      isSaved ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
                    }`}
                    aria-label={isSaved ? t("result.saved") : t("result.save_trip")}
                  >
                    {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onSelectSeat(trip)}
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg font-mono text-xs active:opacity-90"
                  >
                    {t("result.select_seat")}
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
