import { AlertTriangle, CheckCircle2, Clock3, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ServiceDayAdvisory } from "../types";

interface ServiceDayAdvisoryNoticeProps {
  advisory: ServiceDayAdvisory;
}

const riskStyles = {
  safe: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100",
  approaching: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100",
  critical: "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-100",
  missed: "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100",
  unavailable: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
} as const;

export function ServiceDayAdvisoryNotice({ advisory }: ServiceDayAdvisoryNoticeProps) {
  const { t } = useTranslation();
  const Icon = advisory.risk === "safe"
    ? CheckCircle2
    : advisory.risk === "unavailable"
      ? Info
      : advisory.risk === "missed" || advisory.risk === "critical"
        ? AlertTriangle
        : Clock3;
  const coverageNote = advisory.coverage === "stale"
    ? t("service_day.stale")
    : advisory.coverage === "partial"
      ? t("service_day.partial")
      : advisory.coverage === "unavailable"
        ? t("service_day.unavailable")
        : advisory.note;

  return (
    <aside
      className={`mx-auto max-w-md border-b px-4 py-3 ${riskStyles[advisory.risk]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h2 className="text-sm font-black">{t("service_day.title")}</h2>
            <span className="text-xs font-black uppercase tracking-wide">
              {t(`service_day.risk.${advisory.risk}`)}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold">
            {t(`service_day.type.${advisory.serviceDayType}`)} · {advisory.serviceDate} · {advisory.timezone}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <p>
              <span className="block opacity-70">{t("service_day.first")}</span>
              <strong className="font-mono text-sm">{advisory.firstDeparture || "—"}</strong>
            </p>
            <p>
              <span className="block opacity-70">{t("service_day.last")}</span>
              <strong className="font-mono text-sm">{advisory.lastDeparture || "—"}</strong>
            </p>
          </div>
          {typeof advisory.minutesToLastDeparture === "number" && advisory.risk !== "missed" ? (
            <p className="mt-2 text-xs font-semibold">
              {t("service_day.minutes_remaining", { count: Math.max(advisory.minutesToLastDeparture, 0) })}
            </p>
          ) : null}
          {coverageNote ? <p className="mt-2 text-xs font-semibold opacity-80">{coverageNote}</p> : null}
          <p className="mt-2 text-[10px] font-medium opacity-60">
            {t("service_day.source", { source: advisory.source })}
            {advisory.sourceUrl ? (
              <a
                className="ml-1 underline underline-offset-2"
                href={advisory.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("service_day.verify")}
              </a>
            ) : null}
          </p>
        </div>
      </div>
    </aside>
  );
}
