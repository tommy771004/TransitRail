// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Korea result view — the shared result list with direct / first-class filter
// chips on the sort row, amenities on each card and seat preference as the primary action.

import { Utensils, Wifi, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CoverageGap, NoResultReason, KoreaFilter, SearchFailureKind, SortMode, TransitResult } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { effectiveSortMode } from "../utils/searchConditions";
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
  formatRowPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
  afterResults?: ReactNode;
  /** Injectable wall clock for the countdown; tests pin it. */
  now?: () => Date;
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
  formatRowPrice,
  overview,
  afterResults,
  now,
}: KoreaResultViewProps) {
  const { t } = useTranslation();
  // Direct and first class are filter chips on the one sort row every market
  // uses. A chip appears only when it would change the list (some rows match,
  // some do not) or while it is on, so it can be turned off; cheapest is the
  // sort chip's job, not a filter's.
  const splits = (matches: (trip: TransitResult) => boolean) =>
    results.some(matches) && results.some((trip) => !matches(trip));
  const filterChips: Array<{ key: KoreaFilter; label: string }> = [
    { key: "direct" as const, label: t("result.direct"), matches: (trip: TransitResult) => trip.direct },
    { key: "first_class" as const, label: t("result.first_class"), matches: (trip: TransitResult) => trip.seatClass === "first" },
  ].filter((chip) => filter === chip.key || splits(chip.matches));

  const filterRow = filterChips.length > 0 ? (
    <div role="group" aria-label={t("result.filter", { defaultValue: "篩選車次" })} data-korea-filter-control="true" className="flex shrink-0 gap-2">
      {filterChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={filter === chip.key}
          onClick={() => {
            triggerHaptic("light");
            onFilterChange(filter === chip.key ? "all" : chip.key);
          }}
          className={`m3-chip m3-state m3-shape-full shrink-0 border ${
            filter === chip.key
              ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-transparent pb-nav">
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
        date={date}
        time={time}
        now={now}
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
        sortMode={sortMode ? effectiveSortMode(sortMode, filter) : undefined}
        onSortChange={(mode) => {
          // The KTX "cheapest" filter forces the order; leaving it for another
          // sort must release it, or the chip would press with no effect.
          if (filter === "cheapest" && mode !== "cheapest") onFilterChange("all");
          onSortChange?.(mode);
        }}
        priceEmphasis={filter === "cheapest" || sortMode === "cheapest"}
        savedIds={savedIds}
        onSave={onSave}
        onOpenLegend={onOpenLegend}
        formatPrice={formatPrice}
        formatRowPrice={formatRowPrice}
        filters={filterRow}
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
              className="m3-button m3-button-small m3-state shrink-0 bg-emerald-700 text-white"
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
