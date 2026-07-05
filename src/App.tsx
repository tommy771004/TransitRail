import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bell, BellOff, Share2, Bookmark, Check, Clock, DatabaseZap, MapPinned, Trash2, UserCircle, X, Activity, Sun, Moon, CalendarDays, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
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
  FavoriteRoute,
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
  const [favorites, setFavorites] = useState<FavoriteRoute[]>(() => loadJson("transitrail.favorites", []));
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
  const [homeCurrency, setHomeCurrency] = useState<string>(() => localStorage.getItem("transitrail.homeCurrency") || "USD");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState<boolean>(false);

  useEffect(() => saveJson("transitrail.history", history), [history]);
  useEffect(() => saveJson("transitrail.favorites", favorites), [favorites]);
  useEffect(() => saveJson("transitrail.saved", savedTrips), [savedTrips]);
  useEffect(() => saveJson("transitrail.alerts", alerts), [alerts]);
  useEffect(() => {
    localStorage.setItem("transitrail.homeCurrency", homeCurrency);
  }, [homeCurrency]);

  useEffect(() => {
    const fetchRates = async () => {
      setLoadingRates(true);
      try {
        const res = await fetch(`/api/exchange-rates?base=${homeCurrency}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            setExchangeRates(data.rates);
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates", err);
      } finally {
        setLoadingRates(false);
      }
    };
    fetchRates();
  }, [homeCurrency]);

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

  const formatConvertedPrice = (price?: number, currency?: string) => {
    if (price === undefined || !currency) return null;

    // Default formatting of native price
    const formattedNative = new Intl.NumberFormat(
      currency === "JPY" ? "ja-JP" : currency === "KRW" ? "ko-KR" : currency === "HKD" ? "zh-HK" : currency === "GBP" ? "en-GB" : "en-US",
      {
        style: "currency",
        currency: currency,
        maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
      }
    ).format(price);

    if (currency === homeCurrency) {
      return formattedNative;
    }

    const rate = exchangeRates[currency];
    if (!rate) {
      return formattedNative;
    }

    const convertedAmount = price / rate;
    const formattedConverted = new Intl.NumberFormat(
      homeCurrency === "JPY" ? "ja-JP" : homeCurrency === "KRW" ? "ko-KR" : homeCurrency === "HKD" ? "zh-HK" : homeCurrency === "GBP" ? "en-GB" : "en-US",
      {
        style: "currency",
        currency: homeCurrency,
        maximumFractionDigits: homeCurrency === "JPY" || homeCurrency === "KRW" ? 0 : 2,
      }
    ).format(convertedAmount);

    return `${formattedNative} (~${formattedConverted})`;
  };

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
    setSavedTrips((current) => [
      {
        ...trip,
        savedAt: new Date().toISOString(),
        date: searchParams.date || providerDateValue(trip.country),
        reminderEnabled: false,
        reminderFired: false,
      },
      ...current,
    ]);
  };

  const removeSavedTrip = (tripId: string) => {
    setSavedTrips((current) => current.filter((trip) => trip.id !== tripId));
  };

  const getTripDepartureDate = (trip: SavedTrip): Date | null => {
    const dateStr = trip.date; // "YYYY-MM-DD"
    const timeStr = trip.departureTime; // "HH:MM"
    if (!dateStr || !timeStr) return null;

    const dateParts = dateStr.split("-").map((num) => parseInt(num, 10));
    const timeParts = timeStr.split(":").map((num) => parseInt(num, 10));
    if (dateParts.length !== 3 || timeParts.length < 2) return null;

    return new Date(
      dateParts[0],
      dateParts[1] - 1,
      dateParts[2],
      timeParts[0],
      timeParts[1],
      0,
      0
    );
  };

  const triggerReminder = (trip: SavedTrip) => {
    const title = `Departure Approaching: ${trip.service}`;
    const body = `Your trip from ${trip.origin} to ${trip.destination} departs in less than 15 minutes at ${trip.departureTime}!`;

    pushAlert(title, body);

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (e) {
        console.error("Failed to show browser notification", e);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      let changed = false;
      const updatedTrips = savedTrips.map((trip) => {
        if (trip.reminderEnabled && !trip.reminderFired) {
          const departureDate = getTripDepartureDate(trip);
          if (departureDate) {
            const timeDiff = departureDate.getTime() - Date.now();
            // Trigger if departing within 15 minutes (and still in the future/present)
            if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) {
              changed = true;
              triggerReminder(trip);
              return { ...trip, reminderFired: true };
            }
          }
        }
        return trip;
      });

      if (changed) {
        setSavedTrips(updatedTrips);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [savedTrips]);

  const toggleTripReminder = (trip: SavedTrip) => {
    const isEnabling = !trip.reminderEnabled;
    if (isEnabling && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            pushAlert("Notifications Enabled", "You will now receive desktop alerts for approaching trip departures.");
          }
        });
      }
    }

    setSavedTrips((current) =>
      current.map((item) =>
        item.id === trip.id
          ? {
              ...item,
              reminderEnabled: isEnabling,
              reminderFired: isEnabling ? false : item.reminderFired,
            }
          : item
      )
    );

    pushAlert(
      isEnabling ? "Reminder Set" : "Reminder Removed",
      isEnabling
        ? `We'll remind you 15m before ${trip.service} departs.`
        : `Alert for ${trip.service} has been turned off.`
    );
  };

  const shareTrip = async (trip: SavedTrip) => {
    const tripDate = trip.date || providerDateValue(trip.country);
    const shareText = `🚇 Transit Details:\n` +
      `• Train/Service: ${trip.service}\n` +
      `• Origin: ${trip.origin}\n` +
      `• Destination: ${trip.destination}\n` +
      `• Date: ${tripDate}\n` +
      `• Departure: ${trip.departureTime}\n` +
      `• Arrival: ${trip.arrivalTime || "N/A"}\n` +
      (trip.price ? `• Price: ${trip.price} ${trip.currency || ""}\n` : "") +
      `Have a safe trip!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip Details: ${trip.origin} to ${trip.destination}`,
          text: shareText,
        });
      } catch (err) {
        console.error("Web Share API failed", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        pushAlert("Trip Details Copied", "Trip details copied to clipboard!");
      } catch (err) {
        console.error("Clipboard copy failed", err);
        pushAlert("Share Failed", "Unable to share or copy trip details.");
      }
    }
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

  const toggleFavoriteRoute = (origin: string, destination: string, country: Country) => {
    const isFavorited = favorites.some(
      (f) => f.origin === origin && f.destination === destination && f.country === country
    );

    if (isFavorited) {
      setFavorites((current) =>
        current.filter(
          (f) => !(f.origin === origin && f.destination === destination && f.country === country)
        )
      );
      pushAlert("Route Removed", "Removed from Favorite Routes.");
    } else {
      const newFav: FavoriteRoute = {
        id: `${Date.now()}`,
        origin,
        destination,
        country,
        createdAt: new Date().toISOString(),
      };
      setFavorites((current) => [newFav, ...current]);
      pushAlert("Route Added", "Added to Favorite Routes.");
    }
  };

  const removeFavoriteById = (id: string) => {
    setFavorites((current) => current.filter((fav) => fav.id !== id));
    pushAlert("Route Removed", "Removed from Favorite Routes.");
  };

  const rerunFavoriteSearch = (fav: FavoriteRoute) => {
    const date = providerDateValue(fav.country);
    void handleSearch(fav.origin, fav.destination, date, fav.country);
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
          favorites={favorites}
          onToggleFavorite={toggleFavoriteRoute}
          onRemoveFavorite={removeFavoriteById}
          onRepeatFavoriteSearch={rerunFavoriteSearch}
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
            <div className="space-y-4">
              {/* Preferred Home Currency Converter Selector */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-stone-900 block leading-tight">Currency Converter</span>
                      <span className="text-[10px] text-stone-400 font-medium font-mono leading-none">
                        {loadingRates ? "Updating live rates..." : `Rates relative to ${homeCurrency}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-stone-500 font-medium">Home:</span>
                    <select
                      value={homeCurrency}
                      onChange={(e) => setHomeCurrency(e.target.value)}
                      className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 outline-none focus:border-stone-400 cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="KRW">KRW (₩)</option>
                      <option value="HKD">HKD (HK$)</option>
                      <option value="CHF">CHF (CHF)</option>
                      <option value="SGD">SGD (S$)</option>
                      <option value="MYR">MYR (RM)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="truncate rounded border-l-2 bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-800" style={{ borderLeftColor: trip.lineColor || "#a8a29e" }}>
                            {trip.service}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {t(`station.${trip.origin}`, { defaultValue: trip.origin })}
                          <span className="mx-1.5 text-stone-400">&rarr;</span>
                          {t(`station.${trip.destination}`, { defaultValue: trip.destination })}
                        </p>
                        <p className="mt-1 font-mono text-xs text-stone-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-stone-400 shrink-0" />
                          <span>{trip.departureTime}{trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}</span>
                        </p>

                        {/* Price Display with Conversion */}
                        {trip.price !== undefined && trip.currency && (
                          <div className="mt-2 text-xs font-semibold text-stone-700 flex items-center gap-1">
                            <span className="text-stone-400 font-normal">Fare:</span>
                            <span className="bg-stone-50 border border-stone-200/60 rounded px-1.5 py-0.5 font-mono">
                              {formatConvertedPrice(trip.price, trip.currency)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons columns */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => toggleTripReminder(trip)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            trip.reminderEnabled
                              ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                              : "border-stone-200 text-stone-500 hover:bg-stone-50"
                          }`}
                          title={trip.reminderEnabled ? "Disable departure alert" : "Enable 15m departure alert"}
                          aria-label="Toggle reminder"
                        >
                          {trip.reminderEnabled ? <Bell className="h-3.5 w-3.5 text-amber-500" /> : <BellOff className="h-3.5 w-3.5 text-stone-400" />}
                        </button>
                        <button
                          onClick={() => shareTrip(trip)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                          title="Share formatted details via Web Share API"
                          aria-label="Share trip"
                        >
                          <Share2 className="h-3.5 w-3.5 text-stone-400" />
                        </button>
                        <button
                          onClick={() => generateICS(trip)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                          title="Download Calendar Event (.ics)"
                          aria-label="Download calendar event"
                        >
                          <CalendarDays className="h-3.5 w-3.5 text-stone-400" />
                        </button>
                        <button
                          onClick={() => removeSavedTrip(trip.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-red-600 hover:border-red-200"
                          title="Remove saved trip"
                          aria-label={t("saved.remove")}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-stone-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                    {trip.seatClass ? (
                      <button
                        onClick={() => openSeatPicker(trip)}
                        className="mt-3 w-full rounded-lg bg-stone-900 py-2 text-xs font-medium text-white hover:bg-stone-800 transition-colors"
                      >
                        {t("result.select_seat")}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
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
          <div className="grid grid-cols-2 gap-2">
            <ProfileStat label={t("nav.history")} value={history.length} />
            <ProfileStat label={t("nav.saved")} value={savedTrips.length} />
            <ProfileStat label={t("nav.alerts")} value={alerts.length} />
            <ProfileStat label="Favorites" value={favorites.length} />
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
