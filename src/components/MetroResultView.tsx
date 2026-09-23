// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Subway and metro result view — the shared result list with each card's
// headsign, the full calling sequence in the sheet and the interchange hint on top.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, SortMode, TransitResult } from "../types";
import { ResultShellHeader } from "./ResultShell";
import { ResultList } from "./ResultList";

interface MetroResultViewProps {
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
  savedIds: Set<string>;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  onModify: () => void;
  onRetry?: () => void;
  recovery?: ReactNode;
  onSave: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  formatRowPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
  afterResults?: ReactNode;
  /** Injectable wall clock for the countdown; tests pin it. */
  now?: () => Date;
}

export function MetroResultView({
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
  savedIds,
  sortMode,
  onSortChange,
  onModify,
  onRetry,
  recovery,
  onSave,
  onOpenLegend,
  formatPrice,
  formatRowPrice,
  overview,
  afterResults,
  now,
}: MetroResultViewProps) {
  const { t } = useTranslation();
  const hasTransferResults = results.some((trip) => !trip.direct);

  return (
    <main className="min-h-screen bg-transparent pb-nav">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={
          <p className="m3-body-small mt-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="font-mono">{date}</span>
            {time ? <span className="font-mono text-slate-400 dark:text-slate-500">≥ {time}</span> : null}
          </p>
        }
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
        emptyTitle={t("metro.no_departures")}
        emptyHint={t("metro.no_departures_hint")}
        onModify={onModify}
        onRetry={onRetry}
        recovery={recovery}
        sortMode={sortMode}
        onSortChange={onSortChange}
        savedIds={savedIds}
        onSave={onSave}
        onOpenLegend={onOpenLegend}
        formatPrice={formatPrice}
        formatRowPrice={formatRowPrice}
        beforeList={hasTransferResults ? (
          <p className="m3-card m3-body-small bg-slate-200/60 px-4 py-3 leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {t("metro.transfer_hint")}
          </p>
        ) : null}
        afterResults={afterResults}
        card={(trip) => ({
          headsign: trip.headsign || destination,
          showFullStopSequence: true,
          saveLabel: t("metro.save_departure"),
        })}
      />
    </main>
  );
}

// --- End of MetroResultView.tsx ---
