import { useTranslation } from "react-i18next";
import type { Country } from "../types";
import { countryConfig } from "../data/countries";
import { ResultShellHeader } from "./ResultShell";

interface ResultSkeletonProps {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  onModify: () => void;
}

export function ResultSkeleton({ country, origin, destination, date, time, onModify }: ResultSkeletonProps) {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen bg-transparent pb-nav pt-16">
      <ResultShellHeader
        country={country}
        origin={origin}
        destination={destination}
        meta={<p className="m3-body-small mt-1 font-mono text-slate-500 dark:text-slate-400">{date}{time ? ` · ≥ ${time}` : ""}</p>}
        onModify={onModify}
      />
      <p role="status" className="m3-body-medium mx-auto max-w-md px-4 py-3 text-slate-600 dark:text-slate-300">
        {t("result.searching_source", { provider: countryConfig[country].provider })}
      </p>
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="m3-card m3-card-large m3-elevation-1 overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between dark:border-slate-800 dark:bg-slate-900">
            <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>

          <div className="px-4 py-4">
            <div className="relative">
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200 dark:bg-slate-700" />

              <ul className="space-y-4">
                <li className="relative pl-6">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700" />
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700"></div>
                  </div>
                  <div className="mt-2 h-3 w-20 rounded bg-slate-100 dark:bg-slate-700"></div>
                </li>

                <li className="relative pl-6">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700" />
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700"></div>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between dark:border-slate-800">
            <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-700"></div>
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-700"></div>
          </div>
        </div>
      ))}
      <div className="flex justify-center mt-2">
        <p className="m3-body-medium text-slate-400 dark:text-slate-500">{t("result.searching", { defaultValue: "Searching..." })}</p>
      </div>
      </div>
    </main>
  );
}
