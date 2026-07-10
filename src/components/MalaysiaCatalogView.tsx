import { AlertCircle, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MalaysiaCatalogViewProps {
  origin: string;
  destination: string;
  onModify: () => void;
}

/** Makes the no-timetable boundary explicit instead of rendering synthetic departures. */
export function MalaysiaCatalogView({ origin, destination, onModify }: MalaysiaCatalogViewProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-transparent pb-28 pt-14">
      <section className="border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {origin} <span className="text-slate-400">→</span> {destination}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">data.gov.my station catalog</p>
          </div>
          <button
            type="button"
            onClick={onModify}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t("result.modify")}
          </button>
        </div>
      </section>
      <section className="mx-auto max-w-md px-4 py-5">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h1 className="mt-3 text-base font-bold">{t("malaysia.catalog_title")}</h1>
          <p className="mt-2 text-sm leading-6">{t("malaysia.catalog_body")}</p>
        </div>
      </section>
    </main>
  );
}
