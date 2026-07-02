import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Bookmark, Check, Clock, DatabaseZap, MapPinned, Trash2, UserCircle, X, Activity, Sun, Moon, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { SearchForm } from "./components/SearchForm";
import { JapanResultView } from "./components/JapanResultView";
import { KoreaResultView } from "./components/KoreaResultView";
import { StationBrowser } from "./components/StationBrowser";
import { DataWorkflowView } from "./components/DataWorkflowView";
import { MetroResultView } from "./components/MetroResultView";
import { LiveRailResultView } from "./components/LiveRailResultView";
import { DiagnosticOverlay } from "./components/DiagnosticOverlay";
import { ResultSkeleton } from "./components/ResultSkeleton";
import { generateICS } from "./utils/ics";
import { get, set } from "idb-keyval";
import { countryConfig, providerDateValue } from "./data/countries";
import type {
  AppAlert,
  AppView,
  Country,
  KoreaFilter,
  SavedTrip,
  SearchHistoryItem,
  SearchParams,
  SearchResponse,
  SortMode,
  TransitResult,
} from "./types";

const emptySearch: SearchParams = {
  origin: "",
  destination: "",
  date: providerDateValue("japan"),
  country: "japan",
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sortResults(results: TransitResult[], sortMode: SortMode, koreaFilter: KoreaFilter) {
  let next = [...results];

  if (koreaFilter === "direct") {
    next = next.filter((trip) => trip.direct);
  }
  if (koreaFilter === "first_class") {
    next = next.filter((trip) => trip.seatClass === "first");
  }

  if (sortMode === "fastest") {
    next.sort((a, b) => (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER));
  }
  if (sortMode === "earliest") {
    next.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  }
  if (sortMode === "cheapest" || koreaFilter === "cheapest") {
    next.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
  }

  return next;
}

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<AppView>("search");
  const [draftSearch, setDraftSearch] = useState<SearchParams>(emptySearch);
  const [searchParams, setSearchParams] = useState<SearchParams>(emptySearch);
  const [results, setResults] = useState<TransitResult[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("fastest");
  const [koreaFilter, setKoreaFilter] = useState<KoreaFilter>("all");
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadJson("transitrail.history", []));
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => loadJson("transitrail.saved", []));
  const [alerts, setAlerts] = useState<AppAlert[]>(() => loadJson("transitrail.alerts", []));
  const [selectedTrip, setSelectedTrip] = useState<TransitResult | null>(null);
  const [seatChoice, setSeatChoice] = useState("standard");
  const [stationPickTarget, setStationPickTarget] = useState<"origin" | "destination">("origin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("transitrail.theme") as "light" | "dark") || "light"
  );
  const [apiDiagnostic, setApiDiagnostic] = useState<any>(null);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);

  useEffect(() => saveJson("transitrail.history", history), [history]);
  useEffect(() => saveJson("transitrail.saved", savedTrips), [savedTrips]);
  useEffect(() => saveJson("transitrail.alerts", alerts), [alerts]);
  useEffect(() => {
    localStorage.setItem("transitrail.theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const savedIds = useMemo(() => new Set(savedTrips.map((trip) => trip.id)), [savedTrips]);
  const unreadAlerts = alerts.filter((alert) => !alert.read).length;
  const visibleResults = useMemo(
    () => sortResults(results, sortMode, searchParams.country === "korea" ? koreaFilter : "all"),
    [results, sortMode, koreaFilter, searchParams.country],
  );

  const pushAlert = (title: string, body: string) => {
    setAlerts((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        body,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...current,
    ].slice(0, 20));
  };

  const handleSearch = async (origin: string, destination: string, date: string, country: Country) => {
    const params = { origin, destination, date, country };
    setSearchParams(params);
    setDraftSearch(params);
    setIsSearching(true);
    setView("results");
    setError(undefined);
    setResults([]);

    const query = new URLSearchParams(params).toString();
    const url = `/api/transit/search?${query}`;

    try {
      const startTime = performance.now();
      const res = await fetch(url);
      const duration = Math.round(performance.now() - startTime);
      
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const responseText = await res.text();
      
      setApiDiagnostic({
        url,
        status: res.status,
        statusText: res.statusText,
        headers,
        rawResponse: responseText,
        duration,
      });

      let data: Partial<SearchResponse> = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // Ignored
      }
      
      const resultList = Array.isArray(data.results) ? data.results : [];

      if (!res.ok) {
        setError(data.message || "Failed to fetch real-time data.");
        pushAlert(t("alerts.search_failed"), data.message || t("alerts.search_failed_body"));
      } else {
        setResults(resultList);
        await set(`transit_search_${query}`, resultList).catch(console.error);
      }

      setHistory((current) => [
        {
          ...params,
          id: `${Date.now()}`,
          searchedAt: new Date().toISOString(),
          resultCount: resultList.length,
        },
        ...current.filter((item) => (
          item.origin !== origin ||
          item.destination !== destination ||
          item.date !== date ||
          item.country !== country
        )),
      ].slice(0, 12));
    } catch {
      // Offline or network error, attempt fallback to IndexedDB
      try {
        const cachedData = await get(`transit_search_${query}`);
        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
          setResults(cachedData);
          pushAlert("Offline Mode", "Showing cached results from a previous search.");
          setIsSearching(false);
          return; // Early return to avoid setting error state
        }
      } catch (e) {
        console.error("Failed to read from cache", e);
      }

      const message = t("alerts.network_error_body");
      setError(message);
      pushAlert(t("alerts.network_error"), message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigate = (nextView: AppView) => {
    if (nextView === "stations") {
      setStationPickTarget("origin");
    }
    setView(nextView);
    if (nextView === "alerts") {
      setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
    }
  };

  const toggleSaveTrip = (trip: TransitResult) => {
    if (savedIds.has(trip.id)) {
      setSavedTrips((current) => current.filter((item) => item.id !== trip.id));
      return;
    }
    pushAlert(t("alerts.trip_saved"), `${trip.origin} -> ${trip.destination}`);
    setSavedTrips((current) => [{ ...trip, savedAt: new Date().toISOString() }, ...current]);
  };

  const removeSavedTrip = (tripId: string) => {
    setSavedTrips((current) => current.filter((trip) => trip.id !== tripId));
  };

  const openSeatPicker = (trip: TransitResult) => {
    setSelectedTrip(trip);
    setSeatChoice(trip.seatClass === "first" ? "first" : "standard");
  };

  const confirmSeat = () => {
    if (!selectedTrip) return;
    pushAlert(t("alerts.seat_selected"), `${selectedTrip.service} / ${t(`seat.${seatChoice}`)}`);
    setSelectedTrip(null);
  };

  const rerunHistorySearch = (item: SearchHistoryItem) => {
    void handleSearch(item.origin, item.destination, item.date, item.country);
  };

  const openStations = (target: "origin" | "destination") => {
    setStationPickTarget(target);
    setView("stations");
  };

  const selectStation = (station: string) => {
    setDraftSearch((current) => ({ ...current, [stationPickTarget]: station }));
    setView("search");
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900 selection:bg-orange-200">
      <Header onMenuOpen={() => setMenuOpen(true)} onProfileOpen={() => setProfileOpen(true)} />

      {(view === "search" || view === "stations") && (
        <SearchForm
          params={draftSearch}
          isSearching={isSearching}
          recentHistory={history}
          onChange={setDraftSearch}
          onSearch={handleSearch}
          onOpenStations={openStations}
          onOpenWorkflow={() => setView("workflow")}
          onRepeatSearch={rerunHistorySearch}
        />
      )}

      {view === "stations" && (
        <StationBrowser
          country={draftSearch.country}
          target={stationPickTarget}
          onBack={() => setView("search")}
          onCountryChange={(country) => setDraftSearch((current) => ({
            ...current,
            country,
            origin: "",
            destination: "",
            date: providerDateValue(country),
          }))}
          onSelectStation={selectStation}
        />
      )}

      {view === "workflow" && (
        <DataWorkflowView params={draftSearch} onBack={() => setView("search")} />
      )}

      {view === "results" && isSearching && (
        <div className="pt-20 pb-28 min-h-screen bg-stone-100 max-w-md mx-auto">
          <ResultSkeleton />
        </div>
      )}

      {view === "results" && !isSearching && searchParams.country === "japan" && (
        <JapanResultView
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          sortMode={sortMode}
          savedIds={savedIds}
          onSortChange={setSortMode}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
          onSelectSeat={openSeatPicker}
        />
      )}

      {view === "results" && !isSearching && searchParams.country === "korea" && (
        <KoreaResultView
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          filter={koreaFilter}
          savedIds={savedIds}
          onFilterChange={setKoreaFilter}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
          onSelectSeat={openSeatPicker}
        />
      )}

      {view === "results" && !isSearching && searchParams.country === "hong_kong" && (
        <MetroResultView
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          savedIds={savedIds}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
        />
      )}

      {view === "results" && !isSearching && searchParams.country === "united_kingdom" && (
        <LiveRailResultView
          market="london"
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          savedIds={savedIds}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
        />
      )}

      {view === "results" && !isSearching && searchParams.country === "united_states" && (
        <LiveRailResultView
          market="boston"
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          savedIds={savedIds}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
        />
      )}

      {view === "history" && (
        <UtilityPage title={t("nav.history")} icon={<Clock className="w-5 h-5" />}>
          {history.length === 0 ? (
            <EmptyState title={t("history.empty_title")} body={t("history.empty_body")} />
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {t(`station.${item.origin}`, { defaultValue: item.origin })}
                      <span className="mx-1.5 text-stone-400">&rarr;</span>
                      {t(`station.${item.destination}`, { defaultValue: item.destination })}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-stone-400">{item.date} · {t(countryConfig[item.country].labelKey)} · {item.resultCount} {t("history.results")}</p>
                  </div>
                  <button
                    onClick={() => rerunHistorySearch(item)}
                    className="shrink-0 rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white"
                  >
                    {t("history.search_again")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </UtilityPage>
      )}

      {view === "saved" && (
        <UtilityPage title={t("nav.saved")} icon={<Bookmark className="w-5 h-5" />}>
          {savedTrips.length === 0 ? (
            <EmptyState title={t("saved.empty_title")} body={t("saved.empty_body")} />
          ) : (
            <div className="space-y-2">
              {savedTrips.map((trip) => (
                <div key={trip.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{trip.service}</p>
                      <p className="mt-0.5 truncate text-sm text-stone-600">
                        {t(`station.${trip.origin}`, { defaultValue: trip.origin })}
                        <span className="mx-1.5 text-stone-400">&rarr;</span>
                        {t(`station.${trip.destination}`, { defaultValue: trip.destination })}
                      </p>
                      <p className="mt-1 font-mono text-xs text-stone-400">
                        {trip.departureTime}{trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => removeSavedTrip(trip.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                        aria-label={t("saved.remove")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => generateICS(trip)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                        aria-label="Add to Calendar"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {trip.seatClass ? (
                    <button
                      onClick={() => openSeatPicker(trip)}
                      className="mt-3 w-full rounded-lg bg-stone-900 py-2 text-xs font-medium text-white"
                    >
                      {t("result.select_seat")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </UtilityPage>
      )}

      {view === "alerts" && (
        <UtilityPage title={t("nav.alerts")} icon={<Bell className="w-5 h-5" />}>
          {alerts.length === 0 ? (
            <EmptyState title={t("alerts.empty_title")} body={t("alerts.empty_body")} />
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-sm font-semibold text-stone-900">{alert.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{alert.body}</p>
                  <p className="mt-2 font-mono text-[11px] text-stone-400">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </UtilityPage>
      )}

      <BottomNav activeView={view} unreadAlerts={unreadAlerts} onNavigate={handleNavigate} />

      {menuOpen && (
        <Panel title={t("menu.title")} onClose={() => setMenuOpen(false)}>
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {[
              { icon: MapPinned, label: t("menu.new_search"), view: "search" as const },
              { icon: Clock, label: t("nav.history"), view: "history" as const },
              { icon: MapPinned, label: t("nav.stations"), view: "stations" as const },
              { icon: DatabaseZap, label: t("workflow.title"), view: "workflow" as const },
              { icon: Bookmark, label: t("nav.saved"), view: "saved" as const },
            ].map(({ icon: Icon, label, view: target }) => (
              <button
                key={label}
                onClick={() => { setView(target); setMenuOpen(false); }}
                className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-stone-50"
              >
                <Icon className="h-4 w-4 text-stone-500" />
                <span className="text-sm font-medium text-stone-900">{label}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {profileOpen && (
        <Panel title={t("profile.title")} onClose={() => setProfileOpen(false)}>
          <div className="flex items-center gap-3">
            <UserCircle className="h-10 w-10 text-stone-400" />
            <div>
              <p className="text-sm font-semibold text-stone-900">{t("profile.guest")}</p>
              <p className="text-sm text-stone-500">{t("profile.local_only")}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ProfileStat label={t("nav.history")} value={history.length} />
            <ProfileStat label={t("nav.saved")} value={savedTrips.length} />
            <ProfileStat label={t("nav.alerts")} value={alerts.length} />
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">Dark Mode</p>
              <p className="text-xs text-stone-500">Toggle dark appearance</p>
            </div>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="flex items-center justify-center p-2 rounded-full border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </Panel>
      )}

      {selectedTrip && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 px-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-stone-500">{selectedTrip.service}</p>
                <h2 className="text-lg font-semibold tracking-tight text-stone-900">{t("seat.title")}</h2>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["standard", "window", "aisle", "first"].map((seat) => (
                <button
                  key={seat}
                  onClick={() => setSeatChoice(seat)}
                  className={`rounded-lg border p-3 text-left text-sm font-medium ${
                    seatChoice === seat ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-900"
                  }`}
                >
                  {t(`seat.${seat}`)}
                </button>
              ))}
            </div>
            <button onClick={confirmSeat} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800">
              <Check className="h-4 w-4" />
              {t("seat.confirm")}
            </button>
          </div>
        </div>
      )}

      {apiDiagnostic && (
        <button
          onClick={() => setDiagnosticOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg shadow-stone-900/20 hover:bg-stone-800"
          aria-label="API Diagnostics"
          title="View API Diagnostics"
        >
          <Activity className="h-5 w-5" />
        </button>
      )}

      {diagnosticOpen && (
        <DiagnosticOverlay diagnostic={apiDiagnostic} onClose={() => setDiagnosticOpen(false)} />
      )}
    </div>
  );
}

function UtilityPage({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-20">
      <div className="mb-4 flex items-center gap-2 text-stone-500">
        {icon}
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
      </div>
      {children}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-sm text-stone-500">{body}</p>
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-end bg-stone-900/40">
      <div className="min-h-screen w-full max-w-sm space-y-4 border-l border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-200 p-3 text-center">
      <p className="font-mono text-lg font-semibold text-stone-900">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">{label}</p>
    </div>
  );
}
