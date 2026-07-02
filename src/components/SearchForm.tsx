import { ArrowUpDown, CalendarDays, ChevronRight, DatabaseZap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions, providerDateValue } from "../data/countries";
import type { Country, SearchHistoryItem, SearchParams } from "../types";

interface SearchFormProps {
  params: SearchParams;
  isSearching: boolean;
  recentHistory: SearchHistoryItem[];
  onChange: (params: SearchParams) => void;
  onSearch: (origin: string, destination: string, date: string, country: Country) => Promise<void>;
  onOpenStations: (target: "origin" | "destination") => void;
  onOpenWorkflow: () => void;
  onRepeatSearch: (item: SearchHistoryItem) => void;
}

export function SearchForm({
  params,
  isSearching,
  recentHistory,
  onChange,
  onSearch,
  onOpenStations,
  onOpenWorkflow,
  onRepeatSearch,
}: SearchFormProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const origin = params.origin;
  const destination = params.destination;
  const country = params.country;
  const config = countryConfig[country];
  const date = config.liveOnly ? providerDateValue(country) : (params.date || providerDateValue(country));

  const updateParam = (key: keyof SearchParams, value: string) => {
    onChange({ ...params, [key]: value });
  };

  const swapStations = () => {
    onChange({ ...params, origin: destination, destination: origin });
  };

  const handleSubmit = async () => {
    if (!origin.trim() || !destination.trim()) {
      setFormError(t("search.validation_required"));
      return;
    }
    if (origin.trim() === destination.trim()) {
      setFormError(t("search.validation_same_station"));
      return;
    }
    setFormError(null);
    // Recompute for live-only providers so a page left open overnight still
    // submits the provider's current date.
    const submitDate = config.liveOnly ? providerDateValue(country) : date;
    await onSearch(origin.trim(), destination.trim(), submitDate, country);
  };

  const handleAiPlan = async () => {
    if (!origin.trim() || !destination.trim()) {
      setFormError(t("search.validation_required"));
      return;
    }
    setIsAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `請用繁體中文規劃${config.promptName}鐵路旅程：${origin} 到 ${destination}，日期 ${date}。請說明建議路線、轉乘提醒與查詢即時班次時需要的資料欄位。`,
        }),
      });
      const data = await res.json();
      setAiResult(res.ok ? data.result : data.error || t("search.ai_failed"));
    } catch {
      setAiResult(t("alerts.network_error_body"));
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 pb-28 pt-20">
      <section className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{t("search.title")}</h1>

        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
          {countryOptions.map((item) => (
            <button
              key={item}
              onClick={() => {
                onChange({
                  origin: "",
                  destination: "",
                  date: providerDateValue(item),
                  country: item,
                });
                setFormError(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium ${
                country === item
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-600"
              }`}
            >
              {t(countryConfig[item].labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-white">
          <div className="relative p-4">
            <div className="grid grid-cols-[14px_1fr] gap-x-3">
              <div className="flex flex-col items-center pt-3.5">
                <span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-stone-400 bg-white" />
                <span className="w-px flex-1 bg-stone-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-stone-900" />
              </div>
              <div>
                <StationField
                  label={t("search.origin")}
                  value={origin}
                  placeholder={config.originPlaceholder}
                  onBrowse={() => onOpenStations("origin")}
                />
                <div className="my-1 h-px bg-stone-100" />
                <StationField
                  label={t("search.destination")}
                  value={destination}
                  placeholder={config.destinationPlaceholder}
                  onBrowse={() => onOpenStations("destination")}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={swapStations}
              className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-900"
              aria-label={t("search.swap")}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          <div className="border-t border-stone-100 p-4">
            {config.liveOnly ? (
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                <span className="font-medium">{t("search.live_today")}</span>
                <span className="ml-auto font-mono text-xs text-stone-400">{date}</span>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <CalendarDays className="h-4 w-4 text-stone-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => updateParam("date", event.target.value)}
                  className="w-full bg-transparent font-medium text-stone-900 outline-none"
                />
              </label>
            )}

            {formError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSearching}
              className="mt-4 h-12 w-full rounded-lg bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {isSearching ? t("search.searching") : t("search.realtime_search")}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenWorkflow}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm text-stone-600">
            <DatabaseZap className="h-4 w-4 text-stone-400" />
            <span>
              {t("search.data_source")}{" "}
              <span className="font-semibold text-stone-900">{config.provider}</span>
            </span>
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${
            config.connected ? "text-emerald-700" : "text-amber-700"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${config.connected ? "bg-emerald-600" : "bg-amber-500"}`} />
            {config.connected ? t("search.connected") : t("search.adapter_pending")}
          </span>
        </button>

        {recentHistory.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              {t("history.recent")}
            </h2>
            <div className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
              {recentHistory.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onRepeatSearch(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-900">
                      {t(`station.${item.origin}`, { defaultValue: item.origin })}
                      <span className="mx-1.5 text-stone-400">&rarr;</span>
                      {t(`station.${item.destination}`, { defaultValue: item.destination })}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-stone-400">
                      {item.date} · {t(countryConfig[item.country].labelKey)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          onClick={handleAiPlan}
          disabled={isAiLoading}
          className="mt-6 w-full rounded-lg py-2 text-center text-sm font-medium text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900 disabled:opacity-50"
        >
          {isAiLoading ? t("search.thinking") : t("search.plan_ai")}
        </button>

        {aiResult && (
          <div className="mt-3 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-700">
            {aiResult}
          </div>
        )}
      </section>
    </main>
  );
}

function StationField({
  label,
  value,
  placeholder,
  onBrowse,
}: {
  label: string;
  value: string;
  placeholder: string;
  onBrowse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onBrowse} className="block w-full py-2 pr-12 text-left">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</span>
      <span className={`mt-0.5 block truncate text-lg font-semibold tracking-tight ${
        value ? "text-stone-900" : "text-stone-300"
      }`}>
        {value ? t(`station.${value}`, { defaultValue: value }) : placeholder}
      </span>
    </button>
  );
}
