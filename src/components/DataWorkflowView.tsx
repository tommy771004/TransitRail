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
    <main className="min-h-screen bg-stone-100 px-4 pb-28 pt-20">
      <section className="mx-auto max-w-md">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workflow.back")}
        </button>

        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t("workflow.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">{t("workflow.subtitle")}</p>

        <ol className="mt-5 space-y-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-stone-400">0{index + 1}</p>
                    <h2 className="text-sm font-semibold text-stone-900">{step.title}</h2>
                  </div>
                </div>
                <p className="mt-3 break-words rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs text-stone-600">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>

        {!countryConfig[params.country].connected ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">{t("workflow.adapter_pending")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">{t("workflow.adapter_body")}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">{t("workflow.live_ready")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                {t("workflow.live_ready_body", { provider })}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
