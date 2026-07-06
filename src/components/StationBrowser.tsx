import { ArrowLeft, ChevronDown, Search, X, MapPin, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { countryConfig, countryFlags } from "../data/countries";
import type { Country, TransitLine } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel } from "../utils/stationLabel";

interface StationBrowserProps {
  country: Country;
  target: "origin" | "destination";
  onBack: () => void;
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
  onSelectStation,
}: StationBrowserProps) {
  const { t } = useTranslation();
  const handleSelectStation = (station: string) => {
    triggerHaptic("medium");
    onSelectStation(station);
  };
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stations, setStations] = useState<string[]>([]);
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesFailed, setLinesFailed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleUseLocation = () => {
    triggerHaptic("medium");
    if (!navigator.geolocation) {
      setLocationError(t("stations.geolocation_unsupported", "Geolocation is not supported by your browser."));
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/transit/nearest-station?country=${country}&lat=${latitude}&lng=${longitude}`);
          if (!res.ok) {
            throw new Error("Failed to find nearest station");
          }
          const data = await res.json();
          if (data.station) {
            handleSelectStation(data.station);
          } else {
            throw new Error("No station found");
          }
        } catch (error) {
          setLocationError(t("stations.location_error", "Could not determine nearest station."));
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setLocationError(t("stations.location_permission_denied", "Location access denied or failed."));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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
      const translated = stationLabel(t, station, country).toLowerCase();
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
                <span className="mr-1">{countryFlags[country] || ""}</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">{t(countryConfig[country].labelKey)}</span>
                <span className="mx-1">·</span>
                {countryConfig[country].provider}
              </p>
            </div>
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

          {target === "origin" && (
            <div className="mt-3">
              <button
                onClick={handleUseLocation}
                disabled={isLocating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {isLocating ? t("stations.locating", "Locating...") : t("stations.use_current_location", "Use Current Location")}
              </button>
              {locationError && (
                <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
                  {locationError}
                </p>
              )}
            </div>
          )}

        </div>

        {noteKey && !searching && (
          <div className="px-4 pb-2">
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {t(noteKey)}
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {searching ? (
            <div className="w-full overflow-y-auto px-4 pb-12">
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                stations={filteredStations}
                country={country}
                onSelectStation={handleSelectStation}
              />
            </div>
          ) : (
            <>
              {/* Left Column: Categories / Lines */}
              <div className="w-[110px] sm:w-[130px] shrink-0 overflow-y-auto border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 pb-12 pt-2">
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => {
                        triggerHaptic("light");
                        setSelectedCategory("all");
                      }}
                      className={`group relative flex w-full flex-col justify-center px-4 py-3 text-left transition-colors ${
                        selectedCategory === "all"
                          ? "bg-blue-600 dark:bg-blue-600 rounded-full mx-2 w-[calc(100%-16px)]"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className={`block truncate text-sm font-bold ${selectedCategory === "all" ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                        {t("stations.tab_all")}
                      </span>
                      <span className={`mt-0.5 inline-flex w-fit items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${selectedCategory === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}>
                        {stations.length}
                      </span>
                    </button>
                  </li>
                  {!linesLoading && !linesFailed && lines.map((line) => (
                    <li key={line.id}>
                      <button
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedCategory(line.id);
                        }}
                        className={`group relative flex w-full flex-col justify-center px-4 py-3 text-left transition-colors ${
                          selectedCategory === line.id
                            ? "bg-blue-600 dark:bg-blue-600 rounded-full mx-2 w-[calc(100%-16px)]"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className={`block truncate text-sm font-bold ${selectedCategory === line.id ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                          {line.name}
                        </span>
                        <span className={`mt-0.5 inline-flex w-fit items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${selectedCategory === line.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}>
                          {line.stations.length}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Stations */}
              <div className="flex-1 overflow-y-auto px-4 pb-12">
                {selectedCategory === "all" ? (
                  <>
                    {featured.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {featured.map((station) => (
                          <button
                            key={station}
                            onClick={() => handleSelectStation(station)}
                            className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {stationLabel(t, station, country)}
                          </button>
                        ))}
                      </div>
                    )}
                    <StationList
                      isLoading={isLoading}
                      loadFailed={loadFailed}
                      stations={stations}
                      country={country}
                      onSelectStation={handleSelectStation}
                    />
                  </>
                ) : (
                  <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.find((l) => l.id === selectedCategory)?.stations.map((station, index) => {
                      const line = lines.find((l) => l.id === selectedCategory);
                      return (
                        <li key={`${station.name}-${index}`}>
                          <button
                            onClick={() => handleSelectStation(station.name)}
                            className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span className="flex w-1.5 shrink-0 flex-col items-center self-stretch">
                              <span className={`w-px flex-1 ${index === 0 ? "bg-transparent" : "bg-slate-300 dark:bg-slate-600"}`} />
                              <span
                                className="h-2 w-2 rounded-full border-2 bg-white dark:bg-slate-900"
                                style={{ borderColor: line?.color || "#94a3b8" }}
                              />
                              <span className={`w-px flex-1 ${index === (line?.stations.length || 0) - 1 ? "bg-transparent" : "bg-slate-300 dark:bg-slate-600"}`} />
                            </span>
                            <span className="min-w-0 flex-1 py-0.5">
                              <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                                {stationLabel(t, station.name, country)}
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
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
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
  country,
  onSelectStation,
}: {
  isLoading: boolean;
  loadFailed: boolean;
  stations: string[];
  country: Country;
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
              {stationLabel(t, station, country)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
