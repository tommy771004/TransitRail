import { AlertTriangle, ArrowLeft, Database, History, Route, Server, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { countryConfig } from "../data/countries";
import type { SearchParams } from "../types";

interface DataWorkflowViewProps {
  params: SearchParams;
  onBack: () => void;
}

export function DataWorkflowView({ params, onBack }: DataWorkflowViewProps) {
  const { t } = useTranslation();
  const provider = countryConfig[params.country].provider;

  const steps = [
    {
      icon: Route,
      title: t("workflow.step_form"),
      body: `${params.origin || t("workflow.origin_empty")} -> ${params.destination || t("workflow.destination_empty")} / ${params.date || t("workflow.date_empty")}`,
    },
    {
      icon: Database,
      title: t("workflow.step_stations"),
      body: `/api/transit/stations?country=${params.country}`,
    },
    {
      icon: Server,
      title: t("workflow.step_search", { provider }),
      body: `/api/transit/search?origin=...&destination=...&country=${params.country}`,
    },
    {
      icon: History,
      title: t("workflow.step_local"),
      body: t("workflow.local_body"),
    },
  ];

  return (
    <main className="min-h-screen bg-transparent px-4 pb-28 pt-20">
      <section className="mx-auto max-w-md">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workflow.back")}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("workflow.title")}</h1>
            <p className="text-[11px] font-medium text-slate-400">{t("workflow.subtitle")}</p>
          </div>
        </div>

        <ol className="mt-5 space-y-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-400">0{index + 1}</p>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h2>
                  </div>
                </div>
                <p className="mt-3 break-words rounded-xl bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>

        {!countryConfig[params.country].connected ? (
          <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300">{t("workflow.adapter_pending")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-400">{t("workflow.adapter_body")}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">{t("workflow.live_ready")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-400">
                {t("workflow.live_ready_body", { provider })}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
