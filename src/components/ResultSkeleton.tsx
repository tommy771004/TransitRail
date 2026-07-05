import { useTranslation } from "react-i18next";

export function ResultSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="w-full space-y-4 px-2 py-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{t("result.searching", { defaultValue: "Searching..." })}</p>
      </div>
    </div>
  );
}
