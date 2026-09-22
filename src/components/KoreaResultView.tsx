// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Korea result view — the shared result list with the KTX filter rail in the
// sticky bar, amenities on each card and seat preference as the primary action.

import { Utensils, Wifi, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { CoverageGap, NoResultReason, KoreaFilter, SearchFailureKind, SortMode, TransitResult } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { ResultShellHeader } from "./ResultShell";
import { ResultList } from "./ResultList";

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
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
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
  sortMode,
  onSortChange,
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

  const filterRail = (
    <div className="no-scrollbar min-w-0 overflow-x-auto px-4 pt-3">
      <div
        data-korea-filter-control="true"
        className="m3-shape-full flex w-max min-w-full overflow-hidden divide-x divide-slate-300 border border-slate-300 dark:divide-slate-600 dark:border-slate-600"
        role="group"
        aria-label={t("result.filter", { defaultValue: "篩選車次" })}
      >
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
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
  );

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

      <ResultList
        country="korea"
        results={results}
        time={time}
        error={error}
        noResultReason={noResultReason}
        failureKind={failureKind}
        coverageGap={coverageGap}
        officialSourceUrl={officialSourceUrl}
        emptyTitle={t("result.no_results")}
        emptyHint={t("result.no_results_hint")}
        onModify={onModify}
        onRetry={onRetry}
        recovery={recovery}
        sortMode={sortMode}
        onSortChange={onSortChange}
        priceEmphasis={filter === "cheapest" || sortMode === "cheapest"}
        savedIds={savedIds}
        onSave={onSave}
        onOpenLegend={onOpenLegend}
        formatPrice={formatPrice}
        toolbar={filterRail}
        afterResults={afterResults}
        card={(trip) => ({
          extraMeta: (
            <>
              {(trip.amenities || []).includes("wifi") && <Wifi aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              {(trip.amenities || []).includes("power") && <Zap aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              {(trip.amenities || []).includes("food") && <Utensils aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              {trip.seatClass && (
                <span className="m3-label-small whitespace-nowrap uppercase text-slate-400 dark:text-slate-500">
                  {trip.seatClass === "first" ? t("result.first_class") : t("result.economy_class")}
                </span>
              )}
            </>
          ),
          primaryAction: (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onSelectSeat(trip);
              }}
              className="m3-button m3-button-small m3-state shrink-0 bg-emerald-600 text-white"
            >
              {t("result.select_seat")}
            </button>
          ),
        })}
      />
    </main>
  );
}

// --- End of KoreaResultView.tsx ---
