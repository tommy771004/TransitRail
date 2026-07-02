import { CalendarDays, DatabaseZap, LocateFixed, Search, Sparkles, TrainFront } from "lucide-react";
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
  const date = params.date || providerDateValue(params.country);
  const country = params.country;

  const updateParam = (key: keyof SearchParams, value: string) => {
    onChange({ ...params, [key]: value });
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
    await onSearch(origin.trim(), destination.trim(), date, country);
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
          prompt: `請用繁體中文規劃${countryConfig[country].promptName}鐵路旅程：${origin} 到 ${destination}，日期 ${date}。請說明建議路線、轉乘提醒與查詢即時班次時需要的資料欄位。`,
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
    <main className="min-h-screen bg-[#08284a] px-4 pb-28 pt-16 text-white">
      <section className="mx-auto max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-black leading-tight tracking-normal">
            {t("search.hero_title")}
          </h1>
          <p className="text-base text-blue-100">{t("search.hero_subtitle")}</p>
        </div>

        <div className="rounded-[28px] bg-slate-100 p-4 text-slate-950 shadow-2xl shadow-blue-950/40">
          <div className="mb-3 grid grid-cols-2 rounded-2xl bg-slate-200 p-1">
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
                }}
                className={`rounded-xl py-2 text-sm font-bold transition ${
                  country === item ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"
                }`}
              >
                {t(countryConfig[item].labelKey)}
              </button>
            ))}
          </div>

          <div className="rounded-[22px] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <StationField
                label={t("search.origin")}
                value={origin}
                placeholder={countryConfig[country].originPlaceholder}
                onChange={(value) => updateParam("origin", value)}
                onBrowse={() => onOpenStations("origin")}
              />
              <div className="mt-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <TrainFront className="h-5 w-5" />
              </div>
              <StationField
                label={t("search.destination")}
                value={destination}
                placeholder={countryConfig[country].destinationPlaceholder}
                alignRight
                onChange={(value) => updateParam("destination", value)}
                onBrowse={() => onOpenStations("destination")}
              />
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => updateParam("date", event.target.value)}
                  className="w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={onOpenWorkflow}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"
                aria-label={t("workflow.title")}
              >
                <DatabaseZap className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSearching}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-800 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Search className="h-5 w-5" />
              {isSearching ? t("search.searching") : t("search.realtime_search")}
            </button>
          </div>

          <div className="px-2 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">{t("history.recent")}</h2>
              <button onClick={() => onOpenStations("origin")} className="text-xs font-bold text-blue-700">
                {t("stations.all_stations")}
              </button>
            </div>
            {recentHistory.length === 0 ? (
              <div className="rounded-2xl bg-white/70 p-4 text-center text-sm text-slate-500">
                {t("history.empty_body")}
              </div>
            ) : (
              <div className="space-y-2">
                {recentHistory.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onRepeatSearch(item)}
                    className="grid w-full grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-2xl bg-slate-200/80 px-3 py-3 text-left"
                  >
                    <LocateFixed className="h-4 w-4 text-blue-700" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{t(`station.${item.origin}`, { defaultValue: item.origin })}</span>
                      <span className="block text-[10px] text-slate-500">{item.date}</span>
                    </span>
                    <span className="text-slate-500" aria-hidden="true">-&gt;</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{t(`station.${item.destination}`, { defaultValue: item.destination })}</span>
                      <span className="block text-[10px] text-slate-500">{item.resultCount} {t("history.results")}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleAiPlan}
          disabled={isAiLoading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5" />
          {isAiLoading ? t("search.thinking") : t("search.plan_ai")}
        </button>

        {aiResult && (
          <div className="rounded-2xl border border-blue-200/30 bg-white/95 p-4 text-sm leading-relaxed text-slate-800 shadow-xl">
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
  alignRight,
  onChange,
  onBrowse,
}: {
  label: string;
  value: string;
  placeholder: string;
  alignRight?: boolean;
  onChange: (value: string) => void;
  onBrowse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={alignRight ? "text-right" : ""}>
      <button
        type="button"
        onClick={onBrowse}
        className={`mb-1 block w-full text-[11px] font-semibold text-slate-500 ${alignRight ? "text-right" : "text-left"}`}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onBrowse}
        className={`w-full bg-transparent text-xl font-black outline-none truncate block ${
          alignRight ? "text-right" : "text-left"
        } ${!value ? "text-slate-300" : "text-slate-950"}`}
      >
        {value ? t(`station.${value}`, { defaultValue: value }) : placeholder}
      </button>
    </div>
  );
}
