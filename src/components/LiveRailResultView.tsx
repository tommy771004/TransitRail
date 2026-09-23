// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: UK, US, Swiss, Belgian and Norwegian result view — the shared result list
// under a market-flavoured header.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, SortMode, TransitResult } from "../types";
import { ResultShellHeader, formatServiceDay } from "./ResultShell";
import { ResultList } from "./ResultList";

interface LiveRailResultViewProps {
  market: "london" | "boston" | "switzerland" | "belgium" | "norway";
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
  allDepartedAction?: ReactNode;
  overview?: ReactNode;
  afterResults?: ReactNode;
  /** Injectable wall clock for the countdown; tests pin it. */
  now?: () => Date;
}

export function LiveRailResultView({
  market,
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
  allDepartedAction,
  overview,
  afterResults,
  now,
}: LiveRailResultViewProps) {
  const { t, i18n } = useTranslation();
  const isBoston = market === "boston";
  const isSwiss = market === "switzerland";
  const isBelgium = market === "belgium";
  const isNorway = market === "norway";
  const copyKey = isBoston ? "boston" : isSwiss ? "switzerland" : isBelgium ? "belgium" : isNorway ? "norway" : "london";
  const country: Country = isBoston ? "united_states" : isSwiss ? "switzerland" : isBelgium ? "belgium" : isNorway ? "norway" : "united_kingdom";

  return (
    <main className="min-h-screen bg-transparent pb-nav">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        sectionClassName={`border-b px-4 py-4 backdrop-blur-sm ${isSwiss ? "border-rose-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,246,246,0.98)_72%,rgba(255,237,237,0.98)_100%)] dark:border-rose-900/40 dark:bg-[linear-gradient(135deg,rgba(12,12,12,0.96)_0%,rgba(44,10,14,0.96)_100%)]" : "border-slate-200/80 bg-white/95 dark:border-slate-700/50 dark:bg-slate-900/95"}`}
        meta={
          <p className={`m3-body-small mt-1 flex min-w-0 flex-wrap items-center gap-1.5 ${isSwiss ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`absolute h-full w-full animate-ping rounded-full opacity-60 ${isSwiss ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span className={`h-2 w-2 rounded-full ${isSwiss ? "bg-rose-600" : "bg-emerald-600"}`} />
            </span>
            <span className="min-w-0 truncate">{t(`${copyKey}.official_data`, { defaultValue: isBelgium ? "Official iRail timetable data" : "Official timetable data" })}</span>
            <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">{formatServiceDay(date, i18n.language)}</span>
            {time ? <span className="font-mono text-slate-400 dark:text-slate-500">≥ {time}</span> : null}
            {isSwiss ? <span className="m3-chip m3-label-small m3-shape-full min-h-6 bg-rose-700 px-3 uppercase tracking-[0.18em] text-white dark:bg-rose-500 dark:text-slate-950">OJP 2.0</span> : null}
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
        emptyTitle={t(`${copyKey}.no_journeys`)}
        emptyHint={t(`${copyKey}.no_journeys_hint`)}
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
        allDepartedAction={allDepartedAction}
        afterResults={afterResults}
      />
    </main>
  );
}

// --- End of LiveRailResultView.tsx ---
