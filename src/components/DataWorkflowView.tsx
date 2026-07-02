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
    <main className="min-h-screen bg-slate-950 px-4 pb-28 pt-16 text-white">
      <section className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-semibold text-blue-200">
          <ArrowLeft className="h-4 w-4" />
          {t("workflow.back")}
        </button>

        <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-blue-950/50">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black">{t("workflow.title")}</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{t("workflow.subtitle")}</p>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-2xl bg-white p-4 text-slate-950">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-orange-600">0{index + 1}</p>
                      <h2 className="font-black">{step.title}</h2>
                    </div>
                  </div>
                  <p className="mt-3 break-words rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>

          {params.country !== "hong_kong" ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <h2 className="text-sm font-bold text-amber-100">{t("workflow.adapter_pending")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-amber-50/75">{t("workflow.adapter_body")}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <h2 className="text-sm font-bold text-emerald-100">{t("workflow.live_ready")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-emerald-50/75">{t("workflow.live_ready_body")}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
