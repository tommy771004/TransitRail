/**
 * Author: AI Coding Agent
 * OS support: Linux
 * Description: Component for browsing and selecting origin or destination stations with auto-fill logic
 */
import { Accessibility, ArrowLeft, ChevronDown, Search, X, MapPin, Loader2, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { motion, AnimatePresence, useDragControls, type Variants } from "motion/react";
import { countryConfig, countryFlags, countryThemes } from "../data/countries";
import type { Country, TransitLine } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel } from "../utils/stationLabel";
import { stationSearchKey } from "../data/stationKey";
import { resolveStationAlias } from "../data/stationAliases";
import type { StationCoverage } from "../data/stationCoverage";
import { fuzzyMatch } from "../utils/fuzzy";
import { getAuditHeaders, postAuditEvent, resolveAuditTimezone } from "../utils/audit";
import type { ServiceRegion } from "../server/catalog";
import { loadStationBrowserCatalog, resolveCatalogSelection } from "./stationBrowserCatalog";

interface StationBrowserProps {
  country: Country;
  target: "origin" | "destination";
  onBack: () => void;
  onSelectStation: (station: string, autoFillDest?: string, lineId?: string) => void;
  scrollToLineId?: string;
  selectedOrigin?: string;
  selectedDate?: string;
}

const lineNoteKeys: Partial<Record<Country, string>> = {
  japan: "stations.note_japan",
  korea: "stations.note_korea",
  united_states: "stations.note_united_states",
  malaysia: "stations.note_malaysia",
  singapore: "stations.note_singapore",
};

export function StationBrowser({
  country,
  target,
  onBack,
  onSelectStation,
  scrollToLineId,
  selectedOrigin,
  selectedDate,
}: StationBrowserProps) {
  const { t } = useTranslation();
  const theme = countryThemes[country] || countryThemes.japan;
  const stationKeyForCountry = (name: string) => stationSearchKey(resolveStationAlias(country, name));
  const buildAuditHeaders = () => getAuditHeaders(i18n.language, resolveAuditTimezone());

  const dragControls = useDragControls();

  const handleClose = () => {
    triggerHaptic("light");
    onBack();
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [regionsCollapsed, setRegionsCollapsed] = useState(false);
  const [stations, setStations] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<StationCoverage | undefined>(undefined);
  const [stationSource, setStationSource] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<TransitLine[]>([]);
  const [regions, setRegions] = useState<ServiceRegion[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesFailed, setLinesFailed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleSelectStation = (station: string) => {
    triggerHaptic("medium");
    let autoFillDest: string | undefined;
    let selectedLineId: string | undefined;
    if (target === "origin") {
      const stationKey = stationKeyForCountry(station);
      const activeLine = lines.find(l => l.id === selectedCategory);
      if (activeLine && activeLine.stations.some(s => stationKeyForCountry(s.name) === stationKey)) {
        const first = activeLine.stations[0].name;
        const last = activeLine.stations[activeLine.stations.length - 1].name;
        autoFillDest = stationKeyForCountry(last) === stationKey ? first : last;
        selectedLineId = activeLine.id;
      } else {
        for (const line of lines) {
          if (line.stations.some(s => stationKeyForCountry(s.name) === stationKey)) {
            const first = line.stations[0].name;
            const last = line.stations[line.stations.length - 1].name;
            autoFillDest = stationKeyForCountry(last) === stationKey ? first : last;
            selectedLineId = line.id;
            break;
          }
        }
      }
    }
    void postAuditEvent({
      event: "station.select",
      country,
      target,
      station,
      lineId: selectedLineId,
      regionId: regions.find((region) => region.lines.some((line) => line.id === selectedLineId))?.id,
    }, { language: i18n.language });
    onSelectStation(station, autoFillDest, selectedLineId);
  };

  const handleUseLocation = () => {
    triggerHaptic("medium");
    if (!navigator.geolocation) {
      void postAuditEvent({
        event: "station.geolocation.failed",
        country,
        target,
        reason: "geolocation_unsupported",
      }, { language: i18n.language });
      setLocationError(t("stations.geolocation_unsupported"));
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const params = new URLSearchParams({
            country,
            lat: String(latitude),
            lng: String(longitude),
            accuracy: String(accuracy),
          });
          const res = await fetch(`/api/transit/nearest-station?${params.toString()}`, {
            headers: buildAuditHeaders(),
          });
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
          setLocationError(t("stations.location_error"));
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        void postAuditEvent({
          event: "station.geolocation.failed",
          country,
          target,
          reason: error.code === error.PERMISSION_DENIED ? "permission_denied" : "geolocation_error",
        }, { language: i18n.language });
        setLocationError(t("stations.location_permission_denied"));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    void postAuditEvent({
      event: "station.browser.open",
      country,
      target,
    }, { language: i18n.language });
  }, [country, target]);

  useEffect(() => {
    let active = true;
    setSelectedCategory("");
    setSelectedRegion("");
    setRegionsCollapsed(false);

    const applyCatalog = (fetchedRegions: ServiceRegion[], fetchedLines: TransitLine[]) => {
      setRegions(fetchedRegions);
      setLines(fetchedLines);
      setLinesFailed(false);
      const selection = resolveCatalogSelection(fetchedRegions, scrollToLineId);
      if (selection.regionId) {
        setSelectedRegion(selection.regionId);
        setRegionsCollapsed(false);
        setSelectedCategory(selection.lineId);
      }
    };

    const loadFromApi = async () => {
      const response = await loadStationBrowserCatalog({
        country,
        date: selectedDate,
        origin: target === "destination" ? selectedOrigin : undefined,
        headers: buildAuditHeaders(),
      });
      if (!active) return;
      if (response.ok) {
        setStations(response.data.stations || []);
        setStationSource(response.data.stationSource);
        setCoverage(response.data.coverage);
        applyCatalog(response.data.regions || [], response.data.lines || []);
      }
      else {
        setStations([]);
        setStationSource(undefined);
        setCoverage(undefined);
        setRegions([]);
        setLines([]);
        setLoadFailed(true);
        setLinesFailed(true);
      }
    };

    const load = async () => {
      setIsLoading(true);
      setLinesLoading(true);
      setLoadFailed(false);
      setLinesFailed(false);
      await loadFromApi();
      if (active) {
        setIsLoading(false);
        setLinesLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [country, selectedDate, selectedOrigin, target, scrollToLineId]);

  const [isInputFocused, setIsInputFocused] = useState(false);

  const dependencyMap = useMemo(() => {
    return buildDependencyMap(lines);
  }, [lines]);

  const visibleLines = useMemo(() => {
    const stationKeys = new Set(stations.map(stationKeyForCountry));
    const regionLines = regions.find((region) => region.id === selectedRegion)?.lines || [];
    return regionLines
      .map((line) => ({
        ...line,
        stations: line.stations.filter((station) => stationKeys.has(stationKeyForCountry(station.name))),
      }))
      .filter((line) => line.stations.length > 0);
  }, [regions, selectedRegion, stations, country]);

  useEffect(() => {
    if (regions.length === 0) return;
    const activeRegion = regions.find((region) => region.id === selectedRegion);
    if (!activeRegion && !regionsCollapsed) {
      const restored = regions.find((region) => region.lines.some((line) => line.id === scrollToLineId));
      setSelectedRegion((restored || regions[0]).id);
      return;
    }
    if (visibleLines.length === 0 || visibleLines.some((line) => line.id === selectedCategory)) return;
    if (scrollToLineId && visibleLines.some((line) => line.id === scrollToLineId)) {
      setSelectedCategory(scrollToLineId);
      return;
    }
    setSelectedCategory(visibleLines[0].id);
  }, [regions, selectedRegion, regionsCollapsed, visibleLines, selectedCategory, scrollToLineId]);

  const stationsToRender = useMemo(() => {
    const line = lines.find((l) => l.id === selectedCategory);
    if (!line) return [];
    const stationKeys = new Set(stations.map(stationKeyForCountry));
    return line.stations.filter((station) => stationKeys.has(stationKeyForCountry(station.name)));
  }, [lines, selectedCategory, stations, country]);

  const lineColorByName = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const line of lines) map.set(line.name, line.color);
    return map;
  }, [lines]);

  const searching = query.trim().length > 0;

  useEffect(() => {
    if (selectedCategory && !searching && lines.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`line-btn-${selectedCategory}`);
        if (el && el.scrollIntoView) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [selectedCategory, searching, lines.length]);

  const localNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines) {
      for (const st of line.stations) {
        if (st.localName) {
          map.set(st.name, st.localName);
        }
      }
    }
    return map;
  }, [lines]);

  const accessibilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const line of lines) {
      for (const st of line.stations) {
        if (st.accessible) {
          map.set(st.name, true);
        }
      }
    }
    return map;
  }, [lines]);

  /**
   * Stations the picker can offer but search cannot answer for.
   *
   * The line map and the timetables are different graphs: Seoul's map has 305
   * stations, its timetables cover 8. Without this the picker silently hands
   * users a dead end (Cheongnyangni → Seoul Station). A missing `covered` list
   * means the country answers arbitrary pairs live, so nothing is marked.
   */
  const isUncovered = useMemo(() => {
    const covered = coverage?.covered;
    if (!covered) return () => false;
    const keys = new Set(covered.map(stationKeyForCountry));
    return (station: string) => !keys.has(stationKeyForCountry(station));
  }, [coverage, country]);

  const filteredStations = useMemo(() => {
    const value = query.trim().toLowerCase();
    const baseStations = stations;
    if (!value) return baseStations;
    
    const tZh = i18n.getFixedT("zh-TW", "translation");
    
    return baseStations.filter((station) => {
      const primary = station.toLowerCase();
      const translated = stationLabel(t, station, country).toLowerCase();
      const zhLabel = stationLabel(tZh, station, country).toLowerCase();
      const localName = localNameMap.get(station)?.toLowerCase() || "";

      return fuzzyMatch(value, primary) || 
             fuzzyMatch(value, translated) || 
             fuzzyMatch(value, zhLabel) || 
             (localName && fuzzyMatch(value, localName));
    });
  }, [query, stations, t, country, localNameMap]);

  const featured = useMemo(() => {
    const origFeatured = countryConfig[country].featuredStations;
    const stationKeys = new Set(stations.map(stationKeyForCountry));
    return origFeatured.filter((station) => stationKeys.has(stationKeyForCountry(station)));
  }, [country, stations]);

  const noteKey = lineNoteKeys[country];

  const backdropVariants: Variants = {
    hidden: { 
      opacity: 0,
      transition: { duration: 0.25, ease: "easeOut" }
    },
    visible: { 
      opacity: 1, 
      transition: { duration: 0.3, ease: "easeOut" } 
    }
  };

  const sheetVariants: Variants = {
    hidden: { 
      y: "100%", 
      opacity: 0.95,
      transition: {
        type: "spring",
        damping: 32,
        stiffness: 350,
        mass: 0.8
      }
    },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: "spring", damping: 30, stiffness: 280, mass: 0.85 } 
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <motion.div 
      initial="visible"
      animate="visible"
      exit="hidden"
      variants={backdropVariants}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 dark:bg-slate-950/75 sm:items-center sm:p-4"
    >
      <motion.section 
        variants={sheetVariants}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(event, info) => {
          if (info.offset.y > 120 || info.velocity.y > 400) {
            handleClose();
          }
        }}
        className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[#060a13] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.28)] sm:h-[80vh] sm:max-w-md sm:rounded-2xl"
      >
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing select-none shrink-0"
          style={{ touchAction: "none" }}
        >
          <div className="w-12 h-1.5 bg-slate-300/60 dark:bg-slate-700/50 rounded-full" />
        </div>

        <div className="shrink-0 border-b border-slate-100 dark:border-slate-800/50 px-5 pb-4">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label={t("workflow.back")}
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                {target === "origin" ? t("stations.pick_origin") : t("stations.pick_destination")}
              </h1>
              <p className="truncate text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                <span className="text-sm leading-none">{countryFlags[country] || ""}</span>
                <span className="font-semibold text-slate-600 dark:text-slate-400">{t(countryConfig[country].labelKey)}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>{countryConfig[country].provider}</span>
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="relative flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 transition-colors focus-within:border-emerald-700 focus-within:bg-white dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-emerald-400 dark:focus-within:bg-slate-950">
              <Search aria-hidden="true" className="h-4.5 w-4.5 shrink-0 text-slate-500 dark:text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                aria-label={t("stations.search_label")}
                enterKeyHint="search"
                placeholder={t("stations.search_placeholder")}
                className="w-full bg-transparent text-base font-medium text-slate-900 placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setQuery("");
                  }}
                  aria-label={t("stations.clear_search")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>

            {searching && isInputFocused && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[#070b14] dark:shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
                <StationList
                  isLoading={isLoading}
                  loadFailed={loadFailed}
                  emptyMessageKey={coverage?.messageKey}
                  sourceUrl={coverage?.sourceUrl}
                  stations={filteredStations}
                  country={country}
                  onSelectStation={(st) => {
                    handleSelectStation(st);
                    setQuery("");
                  }}
                  accessibilityMap={accessibilityMap}
                  target={target}
                  selectedOrigin={selectedOrigin}
                  dependencyMap={dependencyMap}
                  isUncovered={isUncovered}
                />
              </div>
            )}
          </div>

          {target === "origin" && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleUseLocation}
                disabled={isLocating}
                aria-busy={isLocating}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${theme.badgeBg}`}
              >
                {isLocating ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Navigation aria-hidden="true" className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                )}
                {isLocating ? t("stations.locating") : t("stations.use_current_location")}
              </button>
              {locationError && (
                <p className="mt-2 text-center text-xs font-semibold text-red-500 dark:text-red-400">
                  {locationError}
                </p>
              )}
            </div>
          )}
        </div>

        {(noteKey || stationSource) && !searching && (
          <div className="px-5 pb-1 pt-3">
            {noteKey && (
              <p className="rounded-2xl bg-amber-500/5 border border-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400/90">
                {t(noteKey)}
              </p>
            )}
            {stationSource && (
              <a
                href={stationSource}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block px-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {t("stations.official_station_source")}
              </a>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {searching ? (
            <div className="w-full overflow-y-auto px-5 pb-12 pt-2">
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                emptyMessageKey={coverage?.messageKey}
                sourceUrl={coverage?.sourceUrl}
                stations={filteredStations}
                country={country}
                onSelectStation={handleSelectStation}
                accessibilityMap={accessibilityMap}
                isUncovered={isUncovered}
              />
            </div>
          ) : lines.length === 0 && !linesLoading && !linesFailed ? (
            <div className="w-full overflow-y-auto px-5 pb-12 pt-2">
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                emptyMessageKey={coverage?.messageKey}
                sourceUrl={coverage?.sourceUrl}
                stations={filteredStations}
                country={country}
                onSelectStation={handleSelectStation}
                accessibilityMap={accessibilityMap}
                isUncovered={isUncovered}
              />
            </div>
          ) : (
            <>
              <div className="w-[115px] sm:w-[135px] shrink-0 overflow-y-auto border-r border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-[#040810]/20 pb-12 pt-2">
                <ul className="space-y-1">
                  {!linesLoading && !linesFailed && regions.map((region) => (
                    <li key={region.id}>
                      <button
                        aria-expanded={selectedRegion === region.id}
                        onClick={() => {
                          triggerHaptic("light");
                          if (selectedRegion === region.id) {
                            setSelectedRegion("");
                            setRegionsCollapsed(true);
                            setSelectedCategory("");
                          } else {
                            setSelectedRegion(region.id);
                            setRegionsCollapsed(false);
                            setSelectedCategory(region.lines.find((line) => line.id === selectedCategory)?.id || region.lines[0]?.id || "");
                          }
                        }}
                        type="button"
                        className={`flex min-h-11 w-full items-center justify-between gap-1 px-3 py-2.5 text-left text-xs font-semibold ${
                          selectedRegion === region.id ? theme.textActive : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span className="truncate">{t(`service_region.${region.id}`)}</span>
                        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${selectedRegion === region.id ? "rotate-180" : ""}`} />
                      </button>
                      {selectedRegion === region.id && (
                        <ul className="space-y-1 pb-1">
                          {visibleLines.map((line) => (
                            <li key={line.id}>
                              <button
                                id={`line-btn-${line.id}`}
                                aria-pressed={selectedCategory === line.id}
                                onClick={() => {
                                  triggerHaptic("light");
                                  setSelectedCategory(line.id);
                                }}
                                type="button"
                                className={`group relative flex min-h-11 w-full flex-col justify-center px-4 py-3 text-left transition-colors ${
                                  selectedCategory === line.id
                                    ? `${theme.badgeBg} border-l-4 ${theme.borderActive} font-semibold rounded-r-lg`
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                              >
                                <span className="block truncate text-xs font-bold leading-tight">
                                  {t(`line.${line.name}`, { defaultValue: line.name })}
                                </span>
                                <span className="mt-1.5 inline-flex w-fit items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none" style={{ backgroundColor: `${line.color}15`, color: line.color }}>
                                  {line.stations.length}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-12 pt-2">
                {linesLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{t("stations.loading")}</p>
                  </div>
                ) : linesFailed || !selectedCategory ? (
                  <div className="py-12 text-center">
                    <p className="text-xs font-bold text-red-500 dark:text-red-400">{t("stations.unavailable")}</p>
                  </div>
                ) : (
                  <>
                    {featured.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <MapPin className="h-3 w-3 text-emerald-500" />
                          <span>{t("stations.featured")}</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                          {featured.map((station) => (
                            <button
                              key={station}
                              type="button"
                              onClick={() => handleSelectStation(station)}
                              className="min-h-11 shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {stationLabel(t, station, country)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <motion.ul 
                      variants={containerVariants}
                      initial="visible"
                      animate="visible"
                      className="space-y-1"
                    >
                      {stationsToRender.map((station, index, arr) => {
                        const line = lines.find((l) => l.id === selectedCategory);
                        const primaryLabel = stationLabel(t, station.name, country);
                        
                        let secondaryLabel: string | null = null;
                        if (i18n.language === "zh-TW") {
                          if (primaryLabel !== station.name) {
                            secondaryLabel = station.name;
                          }
                        } else {
                          const tZh = i18n.getFixedT("zh-TW", "translation");
                          const zhLabel = stationLabel(tZh, station.name, country);
                          if (zhLabel !== station.name) {
                            secondaryLabel = zhLabel;
                          }
                        }

                        return (
                          <motion.li 
                            key={`${station.name}-${index}`}
                            variants={itemVariants}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectStation(station.name)}
                              className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                            >
                              <span className="flex w-2 shrink-0 flex-col items-center self-stretch">
                                <span className={`w-[2px] flex-1 ${index === 0 ? "bg-transparent" : "bg-slate-200 dark:bg-slate-800"}`} />
                                <span
                                  className="h-2.5 w-2.5 rounded-full border-2 bg-white dark:bg-[#060a13]"
                                  style={{ borderColor: line?.color || "#10b981" }}
                                />
                                <span className={`w-[2px] flex-1 ${index === arr.length - 1 ? "bg-transparent" : "bg-slate-200 dark:bg-slate-800"}`} />
                              </span>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className={`block truncate text-sm font-bold flex items-center gap-1.5 ${isUncovered(station.name) ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                                  {primaryLabel}
                                  {isUncovered(station.name) && <NoTimetableBadge />}
                                  {station.localName ? (
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{station.localName}</span>
                                  ) : null}
                                  {station.accessible && (
                                    <span className="inline-flex items-center justify-center text-blue-700 dark:text-blue-300" title={t("stations.accessible")}>
                                      <Accessibility aria-hidden="true" className="h-4 w-4" />
                                      <span className="sr-only">{t("stations.accessible")}</span>
                                    </span>
                                  )}
                                </span>
                                {secondaryLabel && (
                                  <span className="block truncate text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                                    {secondaryLabel}
                                  </span>
                                )}
                                {target === "destination" && selectedOrigin && (() => {
                                  const conn = dependencyMap.get(selectedOrigin)?.get(station.name);
                                  if (!conn) return null;
                                  return (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      {conn.isDirect ? (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/30">
                                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
                                          {t("stations.direct_route")}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/30">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          {conn.transferCount} {conn.transferCount === 1 ? t("stations.transfer") : t("stations.transfers")}
                                        </span>
                                      )}
                                      {conn.lines.map((lineObj) => (
                                        <span
                                          key={lineObj.id}
                                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 dark:bg-slate-850 border border-slate-200/40 dark:border-slate-800/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
                                        >
                                          <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: lineObj.color }}
                                          />
                                          {t(`line.${lineObj.name}`, { defaultValue: lineObj.name })}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                                {station.interchanges && station.interchanges.length > 0 && (
                                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {station.interchanges.map((other) => (
                                      <span key={other} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 border border-slate-200/40 dark:border-slate-800/60 px-1.5 py-0.5 rounded-md">
                                        <span
                                          className="h-1.5 w-1.5 rounded-full shrink-0"
                                          style={{ backgroundColor: lineColorByName.get(other) || "#94a3b8" }}
                                        />
                                        {t(`line.${other}`, { defaultValue: other })}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                            </button>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

/**
 * Marks a station the picker lists but the timetables do not cover, so the
 * dead end is visible before the user commits to a search.
 */
function NoTimetableBadge() {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200/60 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400"
      title={t("stations.no_timetable_hint")}
    >
      {t("stations.no_timetable")}
    </span>
  );
}

function StationList({
  isLoading,
  loadFailed,
  emptyMessageKey,
  sourceUrl,
  stations,
  country,
  onSelectStation,
  accessibilityMap,
  target,
  selectedOrigin,
  dependencyMap,
  isUncovered,
}: {
  isLoading: boolean;
  loadFailed: boolean;
  emptyMessageKey?: StationCoverage["messageKey"];
  sourceUrl?: string;
  stations: string[];
  country: Country;
  onSelectStation: (station: string) => void;
  accessibilityMap: Map<string, boolean>;
  target?: "origin" | "destination";
  selectedOrigin?: string;
  dependencyMap?: Map<string, Map<string, ConnectionInfo>>;
  isUncovered?: (station: string) => boolean;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{t("stations.loading")}</p>
      </div>
    );
  }
  if (loadFailed) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-bold text-red-500 dark:text-red-400">{t("stations.unavailable")}</p>
      </div>
    );
  }
  if (stations.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {emptyMessageKey ? t(emptyMessageKey) : t("stations.none")}
        </p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {t("stations.official_source")}
          </a>
        )}
      </div>
    );
  }

  const listVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } }
  };

  return (
    <motion.ul 
      variants={listVariants}
      initial="visible"
      animate="visible"
      className="space-y-1"
    >
      {stations.map((station) => {
        const primaryLabel = stationLabel(t, station, country);
        const uncovered = isUncovered?.(station) ?? false;

        let secondaryLabel: string | null = null;
        if (i18n.language === "zh-TW") {
          if (primaryLabel !== station) {
            secondaryLabel = station;
          }
        } else {
          const tZh = i18n.getFixedT("zh-TW", "translation");
          const zhLabel = stationLabel(tZh, station, country);
          if (zhLabel !== station) {
            secondaryLabel = zhLabel;
          }
        }

        return (
          <motion.li 
            key={station}
            variants={itemVariants}
          >
            <button
              type="button"
              onClick={() => onSelectStation(station)}
              className="group flex min-h-11 w-full items-center justify-between rounded-lg px-3.5 py-3 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
            >
              <div className="flex min-w-0 flex-col">
                <span className={`block truncate text-sm font-bold flex items-center gap-1.5 ${uncovered ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                  {primaryLabel}
                  {uncovered && <NoTimetableBadge />}
                  {accessibilityMap.get(station) && (
                    <span className="inline-flex items-center justify-center text-blue-700 dark:text-blue-300" title={t("stations.accessible")}>
                      <Accessibility aria-hidden="true" className="h-4 w-4" />
                      <span className="sr-only">{t("stations.accessible")}</span>
                    </span>
                  )}
                </span>
                {secondaryLabel && (
                  <span className="block truncate text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    {secondaryLabel}
                  </span>
                )}
                {target === "destination" && selectedOrigin && dependencyMap && (() => {
                  const conn = dependencyMap.get(selectedOrigin)?.get(station);
                  if (!conn) return null;
                  return (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {conn.isDirect ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/30">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
                          {t("stations.direct_route")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {conn.transferCount} {conn.transferCount === 1 ? t("stations.transfer") : t("stations.transfers")}
                        </span>
                      )}
                      {conn.lines.map((lineObj) => (
                        <span
                          key={lineObj.id}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 dark:bg-slate-850 border border-slate-200/40 dark:border-slate-800/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: lineObj.color }}
                          />
                          {t(`line.${lineObj.name}`, { defaultValue: lineObj.name })}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
              </span>
            </button>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

export interface ConnectionInfo {
  isDirect: boolean;
  lines: Array<{ id: string; name: string; color: string }>;
  transferCount: number;
  path: string[];
}

export function buildDependencyMap(lines: TransitLine[]): Map<string, Map<string, ConnectionInfo>> {
  const map = new Map<string, Map<string, ConnectionInfo>>();
  const adj = new Map<string, Array<{ to: string; lineId: string; lineName: string; lineColor: string }>>();
  const allStations = new Set<string>();
  
  for (const line of lines) {
    for (let i = 0; i < line.stations.length; i++) {
      const current = line.stations[i].name;
      allStations.add(current);
      if (!adj.has(current)) {
        adj.set(current, []);
      }
      if (i > 0) {
        adj.get(current)!.push({
          to: line.stations[i - 1].name,
          lineId: line.id,
          lineName: line.name,
          lineColor: line.color || "#94a3b8"
        });
      }
      if (i < line.stations.length - 1) {
        adj.get(current)!.push({
          to: line.stations[i + 1].name,
          lineId: line.id,
          lineName: line.name,
          lineColor: line.color || "#94a3b8"
        });
      }
    }
  }

  for (const origin of allStations) {
    const originMap = new Map<string, ConnectionInfo>();
    const queue: Array<{ station: string; path: Array<{ station: string; lineId: string; lineName: string; lineColor: string }> }> = [{ station: origin, path: [] }];
    const visited = new Set<string>([origin]);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      
      if (curr.station !== origin) {
        const linesInvolved: Array<{ id: string; name: string; color: string }> = [];
        const lineIdsSet = new Set<string>();
        for (const step of curr.path) {
          if (!lineIdsSet.has(step.lineId)) {
            lineIdsSet.add(step.lineId);
            linesInvolved.push({ id: step.lineId, name: step.lineName, color: step.lineColor });
          }
        }
        
        const sharedLines = lines.filter(line => 
          line.stations.some(s => s.name === origin) && 
          line.stations.some(s => s.name === curr.station)
        );
        const isDirect = sharedLines.length > 0;
        const linesToShow = isDirect 
          ? sharedLines.map(l => ({ id: l.id, name: l.name, color: l.color || "#94a3b8" }))
          : linesInvolved;
        const transferCount = isDirect ? 0 : (linesInvolved.length - 1);
        
        originMap.set(curr.station, {
          isDirect,
          lines: linesToShow,
          transferCount,
          path: curr.path.map(p => p.station)
        });
      }
      
      const neighbors = adj.get(curr.station) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({
            station: edge.to,
            path: [
              ...curr.path,
              {
                station: edge.to,
                lineId: edge.lineId,
                lineName: edge.lineName,
                lineColor: edge.lineColor
              }
            ]
          });
        }
      }
    }
    
    map.set(origin, originMap);
  }
  
  return map;
}

// --- End of StationBrowser.tsx ---
