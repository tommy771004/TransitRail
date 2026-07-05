import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryOptions } from "../data/countries";
import type { Country, TransitLine } from "../types";
import { triggerHaptic } from "../utils/haptics";

interface StationBrowserProps {
  country: Country;
  target: "origin" | "destination";
  onBack: () => void;
  onCountryChange: (country: Country) => void;
  onSelectStation: (station: string) => void;
}

type BrowserTab = "lines" | "all";

const lineNoteKeys: Partial<Record<Country, string>> = {
  japan: "stations.note_japan",
  korea: "stations.note_korea",
  united_states: "stations.note_united_states",
};

export function StationBrowser({
  country,
  target,
  onBack,
  onCountryChange,
  onSelectStation,
}: StationBrowserProps) {
  const { t } = useTranslation();
  const handleSelectStation = (station: string) => {
    triggerHaptic("medium");
    onSelectStation(station);
  };
  const [tab, setTab] = useState<BrowserTab>("lines");
  const [stations, setStations] = useState<string[]>([]);
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesFailed, setLinesFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchStations = async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const res = await fetch(`/api/transit/stations?country=${country}`);
        const data = await res.json();
        if (active && res.ok) {
          setStations(data.stations || []);
        } else if (active) {
          setStations([]);
          setLoadFailed(true);
        }
      } catch {
        if (active) {
          setStations([]);
          setLoadFailed(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const fetchLines = async () => {
      setLinesLoading(true);
      setLinesFailed(false);
      try {
        const res = await fetch(`/api/transit/lines?country=${country}`);
        const data = await res.json();
        if (active && res.ok) {
          setLines(data.lines || []);
          setExpandedLine(null);
        } else if (active) {
          setLines([]);
          setLinesFailed(true);
        }
      } catch {
        if (active) {
          setLines([]);
          setLinesFailed(true);
        }
      } finally {
        if (active) setLinesLoading(false);
      }
    };
    void fetchStations();
    void fetchLines();
    return () => {
      active = false;
    };
  }, [country]);

  const lineColorByName = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const line of lines) map.set(line.name, line.color);
    return map;
  }, [lines]);

  const filteredStations = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return stations;
    return stations.filter((station) => {
      const translated = t(`station.${station}`, { defaultValue: station }).toLowerCase();
      return station.toLowerCase().includes(value) || translated.includes(value);
    });
  }, [query, stations, t]);

  const searching = query.trim().length > 0;
  const featured = countryConfig[country].featuredStations;
  const noteKey = lineNoteKeys[country];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="flex h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:h-[80vh] sm:max-w-md sm:rounded-3xl dark:bg-slate-900">
        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => {
                triggerHaptic("light");
                onBack();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={t("workflow.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {target === "origin" ? t("stations.pick_origin") : t("stations.pick_destination")}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {countryConfig[country].provider}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {countryOptions.map((item) => (
              <button
                key={item}
                onClick={() => {
                  triggerHaptic("light");
                  onCountryChange(item);
                  setQuery("");
                  setTab("lines");
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  country === item
                    ? "bg-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.25)]"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {t(countryConfig[item].labelKey)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("stations.search_placeholder")}
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            {query && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  setQuery("");
                }}
                className="p-0.5"
              >
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {!searching && (
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
              {(["lines", "all"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    triggerHaptic("light");
                    setTab(item);
                  }}
                  className={`rounded-[10px] py-1.5 text-xs font-bold ${
                    tab === item ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {item === "lines" ? t("stations.tab_lines") : t("stations.tab_all")}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-12">
          {searching ? (
            <StationList
              isLoading={isLoading}
              loadFailed={loadFailed}
              stations={filteredStations}
              onSelectStation={handleSelectStation}
            />
          ) : tab === "all" ? (
            <>
              {featured.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {featured.map((station) => (
                    <button
                      key={station}
                      onClick={() => handleSelectStation(station)}
                      className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {t(`station.${station}`, { defaultValue: station })}
                    </button>
                  ))}
                </div>
              )}
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                stations={filteredStations}
                onSelectStation={handleSelectStation}
              />
            </>
          ) : (
            <div className="mt-3">
              {noteKey && (
                <p className="mb-3 rounded-xl bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {t(noteKey)}
                </p>
              )}
              {linesLoading ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("stations.lines_loading")}</p>
              ) : linesFailed || lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("stations.lines_unavailable")}</p>
              ) : (
                <div className="space-y-2">
                  {lines.map((line) => {
                    const expanded = expandedLine === line.id;
                    return (
                      <div key={line.id} className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => {
                            triggerHaptic("light");
                            setExpandedLine(expanded ? null : line.id);
                          }}
                          className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left dark:bg-slate-900"
                          aria-expanded={expanded}
                        >
                          <span
                            className="h-7 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: line.color || "#94a3b8" }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{line.name}</span>
                            <span className="block font-mono text-[11px] text-slate-400">
                              {t("stations.station_count", { count: line.stations.length })}
                            </span>
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {expanded && (
                          <ul className="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                            {line.stations.map((station, index) => (
                              <li key={`${station.name}-${index}`}>
                                <button
                                  onClick={() => handleSelectStation(station.name)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <span className="flex w-1.5 shrink-0 flex-col items-center self-stretch">
                                    <span className={`w-px flex-1 ${index === 0 ? "bg-transparent" : "bg-slate-300 dark:bg-slate-600"}`} />
                                    <span
                                      className="h-2 w-2 rounded-full border-2 bg-white dark:bg-slate-900"
                                      style={{ borderColor: line.color || "#94a3b8" }}
                                    />
                                    <span className={`w-px flex-1 ${index === line.stations.length - 1 ? "bg-transparent" : "bg-slate-300 dark:bg-slate-600"}`} />
                                  </span>
                                  <span className="min-w-0 flex-1 py-0.5">
                                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                                      {t(`station.${station.name}`, { defaultValue: station.name })}
                                      {station.localName ? (
                                        <span className="ml-2 text-xs font-normal text-slate-400">{station.localName}</span>
                                      ) : null}
                                    </span>
                                    {station.interchanges && station.interchanges.length > 0 && (
                                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        {station.interchanges.map((other) => (
                                          <span key={other} className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span
                                              className="h-1.5 w-1.5 rounded-full"
                                              style={{ backgroundColor: lineColorByName.get(other) || "#94a3b8" }}
                                            />
                                            {other}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StationList({
  isLoading,
  loadFailed,
  stations,
  onSelectStation,
}: {
  isLoading: boolean;
  loadFailed: boolean;
  stations: string[];
  onSelectStation: (station: string) => void;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("stations.loading")}</p>;
  }
  if (loadFailed) {
    return <p className="py-8 text-center text-sm text-red-700 dark:text-red-400">{t("stations.unavailable")}</p>;
  }
  if (stations.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("stations.none")}</p>;
  }
  return (
    <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
      {stations.map((station) => (
        <li key={station}>
          <button
            onClick={() => onSelectStation(station)}
            className="w-full py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
              {t(`station.${station}`, { defaultValue: station })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
