// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Japan result view — the shared result list with seat preference as the
// market's primary action.

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, SortMode, TransitResult } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { ResultShellHeader } from "./ResultShell";
import { ResultList } from "./ResultList";

interface JapanResultViewProps {
  country: Country;
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
  sortMode: SortMode;
  savedIds: Set<string>;
  onSortChange: (mode: SortMode) => void;
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

export function JapanResultView({
  country,
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
  sortMode,
  savedIds,
  onSortChange,
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
}: JapanResultViewProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-transparent pb-nav">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={null}
        weatherDate={!error && results.length > 0 ? date : undefined}
        onModify={onModify}
        onOpenLegend={onOpenLegend}
      />

      {overview}

      <ResultList
        country={country}
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
        sortMode={sortMode}
        onSortChange={onSortChange}
        priceEmphasis={sortMode === "cheapest"}
        savedIds={savedIds}
        onSave={onSave}
        onOpenLegend={onOpenLegend}
        formatPrice={formatPrice}
        formatRowPrice={formatRowPrice}
        afterResults={afterResults}
        card={(trip) => ({
          primaryAction: (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onSelectSeat(trip);
              }}
              className="m3-button m3-button-small m3-state shrink-0 gap-1 bg-emerald-700 text-white"
            >
              {t("result.select_seat")}
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ),
        })}
      />
    </main>
  );
}

// --- End of JapanResultView.tsx ---
