/**
 * Author: AI Coding Agent
 * OS support: Linux
 * Description: Component for browsing and selecting origin or destination stations with auto-fill logic
 */
import { ArrowLeft, ChevronDown, Search, X, MapPin, Loader2, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { countryConfig, countryFlags, countryThemes } from "../data/countries";
import type { Country, TransitLine } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel } from "../utils/stationLabel";
import { fuzzyMatch } from "../utils/fuzzy";
import { getAuditHeaders, postAuditEvent, resolveAuditTimezone } from "../utils/audit";

interface StationBrowserProps {
  country: Country;
  target: "origin" | "destination";
  onBack: () => void;
  onSelectStation: (station: string, autoFillDest?: string, lineId?: string) => void;
  scrollToLineId?: string;
  selectedOrigin?: string;
}

const lineNoteKeys: Partial<Record<Country, string>> = {
  japan: "stations.note_japan",
  korea: "stations.note_korea",
  united_states: "stations.note_united_states",
  malaysia: "stations.note_malaysia",
};

export function StationBrowser({
  country,
  target,
  onBack,
  onSelectStation,
  scrollToLineId,
  selectedOrigin,
}: StationBrowserProps) {
  const { t } = useTranslation();
  const theme = countryThemes[country] || countryThemes.japan;
  const buildAuditHeaders = () => getAuditHeaders(i18n.language, resolveAuditTimezone());

  const dragControls = useDragControls();

  const handleClose = () => {
    triggerHaptic("light");
    onBack();
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stations, setStations] = useState<string[]>([]);
  const [lines, setLines] = useState<TransitLine[]>([]);
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
      const activeLine = lines.find(l => l.id === selectedCategory);
      if (activeLine && activeLine.stations.some(s => s.name === station)) {
        const first = activeLine.stations[0].name;
        const last = activeLine.stations[activeLine.stations.length - 1].name;
        autoFillDest = (last === station) ? first : last;
        selectedLineId = activeLine.id;
      } else {
        for (const line of lines) {
          if (line.stations.some(s => s.name === station)) {
            const first = line.stations[0].name;
            const last = line.stations[line.stations.length - 1].name;
            autoFillDest = (last === station) ? first : last;
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
      setLocationError(t("stations.geolocation_unsupported", "Geolocation is not supported by your browser."));
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
          setLocationError(t("stations.location_error", "Could not determine nearest station."));
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
        setLocationError(t("stations.location_permission_denied", "Location access denied or failed."));
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

    const applyLines = (fetchedLines: TransitLine[]) => {
      setLines(fetchedLines);
      if (fetchedLines.length > 0) {
        setSelectedCategory(scrollToLineId || fetchedLines[0].id);
      } else {
        setLinesFailed(true);
      }
    };

    const loadFromApi = async () => {
      const [sRes, lRes] = await Promise.allSettled([
        fetch(`/api/transit/stations?country=${country}`, {
          headers: buildAuditHeaders(),
        }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch(`/api/transit/lines?country=${country}`).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      ]);
      if (!active) return;
      if (sRes.status === "fulfilled" && sRes.value.ok) setStations(sRes.value.d.stations || []);
      else { setStations([]); setLoadFailed(true); }
      if (lRes.status === "fulfilled" && lRes.value.ok) applyLines(lRes.value.d.lines || []);
      else { setLines([]); setLinesFailed(true); }
    };

    const load = async () => {
      setIsLoading(true);
      setLinesLoading(true);
      setLoadFailed(false);
      setLinesFailed(false);
      try {
        const res = await fetch(`/catalog/${country}.json`);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setStations(data.stations || []);
          applyLines(data.lines || []);
          return;
        }
        await loadFromApi();
      } catch {
        await loadFromApi();
      } finally {
        if (active) {
          setIsLoading(false);
          setLinesLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [country]);

  const [isInputFocused, setIsInputFocused] = useState(false);

  const dependencyMap = useMemo(() => {
    return buildDependencyMap(lines);
  }, [lines]);

  const visibleLines = useMemo(() => {
    if (target === "destination" && selectedOrigin && dependencyMap.size > 0) {
      const allowed = dependencyMap.get(selectedOrigin);
      // Static route diagrams only cover parts of several national station
      // catalogs. A missing graph node means "unknown", not "unreachable".
      if (!allowed) return lines;
      return lines.filter(line => 
        line.stations.some(s => s.name !== selectedOrigin && allowed.has(s.name))
      );
    }
    return lines;
  }, [lines, target, selectedOrigin, dependencyMap]);

  useEffect(() => {
    if (visibleLines.length > 0) {
      if (!visibleLines.some(l => l.id === selectedCategory)) {
        setSelectedCategory(scrollToLineId || visibleLines[0].id);
      }
    }
  }, [visibleLines, selectedCategory, scrollToLineId]);

  const stationsToRender = useMemo(() => {
    const line = lines.find((l) => l.id === selectedCategory);
    if (!line) return [];
    if (target === "destination" && selectedOrigin) {
      const allowed = dependencyMap.get(selectedOrigin);
      if (!allowed) return line.stations;
      return line.stations.filter(s => s.name !== selectedOrigin && allowed.has(s.name));
    }
    return line.stations;
  }, [lines, selectedCategory, target, selectedOrigin, dependencyMap]);

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

  const filteredStations = useMemo(() => {
    const value = query.trim().toLowerCase();
    let baseStations = stations;
    if (target === "destination" && selectedOrigin) {
      const allowed = dependencyMap.get(selectedOrigin);
      if (allowed) {
        baseStations = stations.filter(s => allowed.has(s));
      }
    }
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
  }, [query, stations, t, country, localNameMap, target, selectedOrigin, dependencyMap]);

  const featured = useMemo(() => {
    const origFeatured = countryConfig[country].featuredStations;
    if (target === "destination" && selectedOrigin) {
      const allowed = dependencyMap.get(selectedOrigin);
      if (allowed) {
        return origFeatured.filter(s => allowed.has(s));
      }
    }
    return origFeatured;
  }, [country, target, selectedOrigin, dependencyMap]);

  const noteKey = lineNoteKeys[country];

  const backdropVariants = {
    hidden: { 
      opacity: 0,
      transition: { duration: 0.25, ease: "easeOut" }
    },
    visible: { 
      opacity: 1, 
      transition: { duration: 0.3, ease: "easeOut" } 
    }
  };

  const sheetVariants = {
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

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={backdropVariants}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-sm sm:items-center sm:p-4"
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
        className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[32px] bg-white/95 dark:bg-[#060a13]/95 backdrop-blur-xl sm:h-[80vh] sm:max-w-md sm:rounded-[28px] border border-slate-200/50 dark:border-slate-800/60 shadow-[0_24px_64px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.4)]"
      >
        <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent`} />

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
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all shadow-xs border border-slate-200/40 dark:border-slate-800/50"
              aria-label={t("workflow.back")}
            >
              <ArrowLeft className="h-5 w-5" />
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
            <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/60 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50 dark:focus-within:ring-emerald-500/10 focus-within:bg-white dark:focus-within:bg-slate-950/80 transition-all duration-300 shadow-xs">
              <Search className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500 shrink-0 transition-colors group-focus-within:text-emerald-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                placeholder={t("stations.search_placeholder")}
                className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-600"
              />
              {query && (
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setQuery("");
                  }}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {query.trim().length > 0 && isInputFocused && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl dark:border-slate-800/80 dark:bg-[#070b14]/95 backdrop-blur-xl">
                <StationList
                  isLoading={isLoading}
                  loadFailed={loadFailed}
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
                />
              </div>
            )}
          </div>

          {target === "origin" && (
            <div className="mt-3">
              <button
                onClick={handleUseLocation}
                disabled={isLocating}
              className={`relative flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold shadow-sm transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 ${theme.badgeBg}`}
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
                
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                ) : (
                  <Navigation className="h-4 w-4 text-emerald-500 group-hover:rotate-12 transition-transform duration-300" />
                )}
                {isLocating ? t("stations.locating", "Locating...") : t("stations.use_current_location", "Use Current Location")}
              </button>
              {locationError && (
                <p className="mt-2 text-center text-xs font-semibold text-red-500 dark:text-red-400">
                  {locationError}
                </p>
              )}
            </div>
          )}
        </div>

        {noteKey && !searching && (
          <div className="px-5 pb-1 pt-3">
            <p className="rounded-2xl bg-amber-500/5 border border-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400/90">
              {t(noteKey)}
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {searching ? (
            <div className="w-full overflow-y-auto px-5 pb-12 pt-2">
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                stations={filteredStations}
                country={country}
                onSelectStation={handleSelectStation}
                accessibilityMap={accessibilityMap}
              />
            </div>
          ) : lines.length === 0 && !linesLoading && !linesFailed ? (
            <div className="w-full overflow-y-auto px-5 pb-12 pt-2">
              <StationList
                isLoading={isLoading}
                loadFailed={loadFailed}
                stations={filteredStations}
                country={country}
                onSelectStation={handleSelectStation}
                accessibilityMap={accessibilityMap}
              />
            </div>
          ) : (
            <>
              <div className="w-[115px] sm:w-[135px] shrink-0 overflow-y-auto border-r border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-[#040810]/20 pb-12 pt-2">
                <ul className="space-y-1">
                  {!linesLoading && !linesFailed && visibleLines.map((line) => (
                    <li key={line.id}>
                      <button
                        id={`line-btn-${line.id}`}
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedCategory(line.id);
                        }}
                        className={`group relative flex w-full flex-col justify-center px-4 py-3.5 text-left transition-all ${
                          selectedCategory === line.id
                            ? `${theme.badgeBg} border-l-4 ${theme.borderActive} font-black rounded-r-xl`
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        <span className="block truncate text-xs font-bold leading-tight">
                          {t(`line.${line.name}`, { defaultValue: line.name })}
                        </span>
                        <span className="mt-1.5 inline-flex w-fit items-center justify-center rounded-full px-2 py-0.5 text-[9px] font-bold font-mono leading-none" style={{ backgroundColor: `${line.color}15`, color: line.color }}>
                          {line.stations.length}
                        </span>
                      </button>
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
                        <div className="flex items-center gap-1.5 px-1 mb-2 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                          <MapPin className="h-3 w-3 text-emerald-500" />
                          <span>{t("stations.featured", "Popular Stations")}</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                          {featured.map((station) => (
                            <button
                              key={station}
                              onClick={() => handleSelectStation(station)}
                              className="shrink-0 whitespace-nowrap rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/60 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all shadow-xs"
                            >
                              {stationLabel(t, station, country)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <motion.ul 
                      variants={containerVariants}
                      initial="hidden"
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
                              onClick={() => handleSelectStation(station.name)}
                              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-100/40 dark:hover:bg-slate-800/40 text-left transition-all group"
                            >
                              <span className="flex w-2 shrink-0 flex-col items-center self-stretch">
                                <span className={`w-[2px] flex-1 ${index === 0 ? "bg-transparent" : "bg-slate-200 dark:bg-slate-800"}`} />
                                <span
                                  className="h-2.5 w-2.5 rounded-full border-2 bg-white dark:bg-[#060a13] transition-transform duration-300 group-hover:scale-125"
                                  style={{ borderColor: line?.color || "#10b981", boxShadow: `0 0 8px ${line?.color || "#10b981"}50` }}
                                />
                                <span className={`w-[2px] flex-1 ${index === arr.length - 1 ? "bg-transparent" : "bg-slate-200 dark:bg-slate-800"}`} />
                              </span>
                              <div className="flex-1 min-w-0 flex flex-col group-hover:translate-x-1 transition-transform">
                                <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  {primaryLabel}
                                  {station.localName ? (
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{station.localName}</span>
                                  ) : null}
                                  {station.accessible && (
                                    <span className="inline-flex items-center justify-center p-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded" title={t("stations.accessible", "Wheelchair Accessible")}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M19 22l-3-6-4 2"/><path d="M16 16l-4-2-2-6 2-2 4 4"/><circle cx="8" cy="18" r="4"/><path d="M8 22v-8"/></svg>
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
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          {t("stations.direct_route", "Direct")}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/30">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          {conn.transferCount} {conn.transferCount === 1 ? t("stations.transfer", "Transfer") : t("stations.transfers", "Transfers")}
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

function StationList({
  isLoading,
  loadFailed,
  stations,
  country,
  onSelectStation,
  accessibilityMap,
  target,
  selectedOrigin,
  dependencyMap,
}: {
  isLoading: boolean;
  loadFailed: boolean;
  stations: string[];
  country: Country;
  onSelectStation: (station: string) => void;
  accessibilityMap: Map<string, boolean>;
  target?: "origin" | "destination";
  selectedOrigin?: string;
  dependencyMap?: Map<string, Map<string, ConnectionInfo>>;
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
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t("stations.none")}</p>
      </div>
    );
  }

  const listVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } }
  };

  return (
    <motion.ul 
      variants={listVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      {stations.map((station) => {
        const primaryLabel = stationLabel(t, station, country);
        
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
              onClick={() => onSelectStation(station)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl hover:bg-slate-100/40 dark:hover:bg-slate-800/40 text-left transition-all group"
            >
              <div className="flex flex-col min-w-0 group-hover:translate-x-1 transition-transform">
                <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  {primaryLabel}
                  {accessibilityMap.get(station) && (
                    <span className="inline-flex items-center justify-center p-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded" title={t("stations.accessible", "Wheelchair Accessible")}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M19 22l-3-6-4 2"/><path d="M16 16l-4-2-2-6 2-2 4 4"/><circle cx="8" cy="18" r="4"/><path d="M8 22v-8"/></svg>
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
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t("stations.direct_route", "Direct")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {conn.transferCount} {conn.transferCount === 1 ? t("stations.transfer", "Transfer") : t("stations.transfers", "Transfers")}
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
