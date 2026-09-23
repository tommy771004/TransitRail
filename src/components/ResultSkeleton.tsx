import { useTranslation } from "react-i18next";
import type { Country } from "../types";
import { countryConfig } from "../data/countries";
import { ResultShellHeader, formatServiceDay } from "./ResultShell";

interface ResultSkeletonProps {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  onModify: () => void;
}

export function ResultSkeleton({ country, origin, destination, date, time, onModify }: ResultSkeletonProps) {
  const { t, i18n } = useTranslation();
  return (
    <main className="min-h-screen bg-transparent pb-nav">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={<p className="m3-body-small mt-1 text-slate-500 dark:text-slate-400">{formatServiceDay(date, i18n.language)}{time ? <span className="font-mono"> · ≥ {time}</span> : null}</p>}
        onModify={onModify}
      />
      <p role="status" className="m3-body-medium mx-auto max-w-md px-4 py-3 text-slate-600 dark:text-slate-300">
        {t("result.searching_source", { provider: countryConfig[country].provider })}
      </p>
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-4 animate-pulse">
      {/* The same three lines as TripCard: status row, times around the band, journey line. */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="m3-card m3-card-large m3-elevation-1 min-w-0 overflow-hidden border-2 border-transparent bg-white px-4 py-3 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="ml-auto h-5 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-3">
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="grid gap-1 pb-[9px]">
              <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800"></div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700"></div>
            </div>
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div className="mt-2 h-4 w-40 rounded bg-slate-100 dark:bg-slate-800"></div>
        </div>
      ))}
      <div className="flex justify-center mt-2">
        <p className="m3-body-medium text-slate-400 dark:text-slate-500">{t("result.searching", { defaultValue: "Searching..." })}</p>
      </div>
      </div>
    </main>
  );
}
