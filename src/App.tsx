import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bell, BellOff, Share2, Bookmark, Check, Clock, DatabaseZap, MapPinned, Trash2, UserCircle, X, Activity, Sun, Moon, Monitor, CalendarDays, Coins, Compass } from "lucide-react";
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
import { TransitLegend } from "./components/TransitLegend";
import { generateICS } from "./utils/ics";
import { get, set } from "idb-keyval";
import { countryConfig, providerDateValue, countryThemes } from "./data/countries";
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
  preferredTransitTypes: [],
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

function filterByTransitTypes(results: TransitResult[], preferred: string[] | undefined) {
  if (!preferred || preferred.length === 0) {
    return results;
  }

  return results.filter((trip) => {
    const serviceLower = (trip.service || "").toLowerCase();
    const operatorLower = (trip.operator || "").toLowerCase();
    const tagsLower = (trip.tags || []).map((t) => t.toLowerCase());

    const legNames = (trip.legs || []).map((l) => (l.lineName || "").toLowerCase());
    const legModes = (trip.legs || []).map((l) => (l.mode || "").toLowerCase());

    // 1. Shinkansen / Bullet Train / KTX / THSR / High Speed / Express Rail
    const isHighSpeed =
      serviceLower.match(/(nozomi|hikari|kodama|hayabusa|yamabiko|komachi|kagayaki|hakutaka|asama|toki|tsubasa|mizuho|sakura|tsubame)/) ||
      serviceLower.includes("ktx") ||
      serviceLower.includes("srt") ||
      serviceLower.includes("itx") ||
      serviceLower.includes("express") ||
      operatorLower.includes("thsr") ||
      serviceLower.includes("thsr") ||
      serviceLower.includes("hsr") ||
      serviceLower.includes("ice") ||
      serviceLower.includes("tgv") ||
      serviceLower.includes("bullet") ||
      serviceLower.includes("shinkansen") ||
      tagsLower.includes("high_speed") ||
      tagsLower.includes("express") ||
      legNames.some((n) => n.includes("shinkansen") || n.includes("express") || n.includes("bullet"));

    // 2. Bus / Express Bus / Highway Bus
    const isBus =
      serviceLower.includes("bus") ||
      serviceLower.includes("coach") ||
      serviceLower.includes("highway") ||
      operatorLower.includes("bus") ||
      operatorLower.includes("coach") ||
      tagsLower.includes("bus") ||
      tagsLower.includes("coach") ||
      legNames.some((n) => n.includes("bus") || n.includes("coach")) ||
      legModes.some((m) => m.includes("bus") || m.includes("coach"));

    // 3. Local Train / Subway / Metro / MRT / Tube
    // Standard default or if not high-speed and not bus, it's typically local/subway/commuter rail
    const isLocal =
      (!isHighSpeed && !isBus) ||
      serviceLower.match(/(local|rapid|subway|metro|mrt|tube|underground|piccadilly|victoria|bakerloo|central|jubilee|northern|district|circle|hammersmith|metropolitan|elizabeth|overground|dlr|tram)/) ||
      operatorLower.match(/(mtr|tfl|mbta|bts|mrt|tra)/) ||
      tagsLower.includes("local") ||
      tagsLower.includes("subway") ||
      tagsLower.includes("metro") ||
      tagsLower.includes("mrt");

    if (preferred.includes("shinkansen") && isHighSpeed) return true;
    if (preferred.includes("local") && isLocal) return true;
    if (preferred.includes("bus") && isBus) return true;

    return false;
  });
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
  const [previousView, setPreviousView] = useState<AppView>("search");
  const [draftSearch, setDraftSearch] = useState<SearchParams>(emptySearch);
  const activeCountry = draftSearch.country || "japan";
  const activeTheme = countryThemes[activeCountry] || countryThemes.japan;
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
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(
    () => (localStorage.getItem("transitrail.theme") as "light" | "dark" | "auto") || "auto"
  );
  const [apiDiagnostic, setApiDiagnostic] = useState<any>(null);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [homeCurrency, setHomeCurrency] = useState<string>(() => localStorage.getItem("transitrail.homeCurrency") || "USD");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const [legendHighlight, setLegendHighlight] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem("transitrail.timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  useEffect(() => {
    localStorage.setItem("transitrail.timezone", timezone);
  }, [timezone]);

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

    const applyTheme = () => {
      let isDark = false;
      if (theme === "dark") {
        isDark = true;
      } else if (theme === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();

    if (theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        applyTheme();
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      } else {
        // @ts-ignore
        mediaQuery.addListener(handleChange);
        return () => {
          // @ts-ignore
          mediaQuery.removeListener(handleChange);
        };
      }
    }
  }, [theme]);

  const savedIds = useMemo(() => new Set(savedTrips.map((trip) => trip.id)), [savedTrips]);
  const unreadAlerts = alerts.filter((alert) => !alert.read).length;
  const visibleResults = useMemo(
    () => {
      const sorted = sortResults(results, sortMode, searchParams.country === "korea" ? koreaFilter : "all");
      return filterByTransitTypes(sorted, searchParams.preferredTransitTypes);
    },
    [results, sortMode, koreaFilter, searchParams.country, searchParams.preferredTransitTypes],
  );

  const formatConvertedPrice = (price?: number, currency?: string) => {
    if (price === undefined || !currency) return null;

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

    const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    nowInTz.setHours(nowInTz.getHours() - 1);
    const queryTime = `${String(nowInTz.getHours()).padStart(2, '0')}:${String(nowInTz.getMinutes()).padStart(2, '0')}`;

    const queryParams = { ...params, time: queryTime };
    const query = new URLSearchParams(queryParams).toString();
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
      try {
        const cachedData = await get(`transit_search_${query}`);
        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
          setResults(cachedData);
          pushAlert("Offline Mode", "Showing cached results from a previous search.");
          setIsSearching(false);
          return;
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
    setPreviousView(view);
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
    const dateStr = trip.date;
    const timeStr = trip.departureTime;
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
    }, 15000);

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
    <div className={`min-h-screen bg-slate-50/40 bg-gradient-to-tr ${activeTheme.primaryBgLight} font-sans text-slate-900 selection:bg-emerald-200 transition-all duration-500 dark:bg-[#0b1220] ${activeTheme.primaryBgDark} dark:text-slate-100 dark:selection:bg-emerald-800/40`}>
      <Header 
        onMenuOpen={() => setMenuOpen(true)} 
        onProfileOpen={() => setProfileOpen(true)} 
        timezone={timezone}
        onChangeTimezone={setTimezone}
      />

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
        <div className="pt-20 pb-28 min-h-screen bg-transparent max-w-md mx-auto">
          <ResultSkeleton />
        </div>
      )}

      {view === "results" && !isSearching && ["japan", "germany", "france", "china"].includes(searchParams.country) && (
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
          onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
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
          onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
        />
      )}

      {view === "results" && !isSearching && ["hong_kong", "singapore", "thailand"].includes(searchParams.country) && (
        <MetroResultView
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          results={visibleResults}
          savedIds={savedIds}
          onModify={() => setView("search")}
          onSave={toggleSaveTrip}
          onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
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
          onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
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
          onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
        />
      )}

      {view === "legend" && (
        <TransitLegend 
          onBack={() => setView(previousView)} 
          highlightLine={legendHighlight}
        />
      )}

      {view === "history" && (
        <UtilityPage title={t("nav.history")} icon={<Clock className="w-5 h-5" />}>
          {history.length === 0 ? (
            <EmptyState title={t("history.empty_title")} body={t("history.empty_body")} />
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {t(`station.${item.origin}`, { defaultValue: item.origin })}
                      <span className="mx-1.5 text-slate-400">&rarr;</span>
                      {t(`station.${item.destination}`, { defaultValue: item.destination })}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">{item.date} · {t(countryConfig[item.country].labelKey)} · {item.resultCount} {t("history.results")}</p>
                  </div>
                  <button
                    onClick={() => rerunHistorySearch(item)}
                    className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-500 transition-all"
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
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-sm font-bold text-slate-900 block leading-tight dark:text-white">Currency Converter</span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono leading-none">
                        {loadingRates ? "Updating live rates..." : `Rates relative to ${homeCurrency}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-500 font-medium">Home:</span>
                    <select
                      value={homeCurrency}
                      onChange={(e) => setHomeCurrency(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                      <option value="TWD">TWD (NT$)</option>
                      <option value="THB">THB (฿)</option>
                      <option value="CNY">CNY (¥)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300" style={{ borderLeft: `3px solid ${trip.lineColor || "#94a3b8"}` }}>
                            {trip.service}
                          </span>
                        </div>
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {t(`station.${trip.origin}`, { defaultValue: trip.origin })}
                          <span className="mx-1.5 text-slate-400">&rarr;</span>
                          {t(`station.${trip.destination}`, { defaultValue: trip.destination })}
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{trip.departureTime}{trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}</span>
                        </p>

                        {trip.price !== undefined && trip.currency && (
                          <div className="mt-2 text-xs font-bold text-slate-700 flex items-center gap-1 dark:text-slate-300">
                            <span className="text-slate-400 font-normal">Fare:</span>
                            <span className="bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-0.5 font-mono dark:bg-slate-800 dark:border-slate-700">
                              {formatConvertedPrice(trip.price, trip.currency)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => toggleTripReminder(trip)}
                          className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                            trip.reminderEnabled
                              ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                              : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          }`}
                          title={trip.reminderEnabled ? "Disable departure alert" : "Enable 15m departure alert"}
                          aria-label="Toggle reminder"
                        >
                          {trip.reminderEnabled ? <Bell className="h-3.5 w-3.5 text-amber-500" /> : <BellOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => shareTrip(trip)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          title="Share formatted details via Web Share API"
                          aria-label="Share trip"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => generateICS(trip)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                          title="Download Calendar Event (.ics)"
                          aria-label="Download calendar event"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeSavedTrip(trip.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400 dark:hover:border-red-800"
                          title="Remove saved trip"
                          aria-label={t("saved.remove")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {trip.seatClass ? (
                      <button
                        onClick={() => openSeatPicker(trip)}
                        className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-500 transition-all"
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
                <div key={alert.id} className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{alert.body}</p>
                  <p className="mt-2 font-mono text-[11px] text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </UtilityPage>
      )}

      <BottomNav activeView={view} unreadAlerts={unreadAlerts} onNavigate={handleNavigate} country={activeCountry} />

      {menuOpen && (
        <Panel title={t("menu.title")} onClose={() => setMenuOpen(false)}>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {[
              { icon: MapPinned, label: t("menu.new_search"), view: "search" as const },
              { icon: Clock, label: t("nav.history"), view: "history" as const },
              { icon: MapPinned, label: t("nav.stations"), view: "stations" as const },
              { icon: DatabaseZap, label: t("workflow.title"), view: "workflow" as const },
              { icon: Bookmark, label: t("nav.saved"), view: "saved" as const },
              { icon: Compass, label: t("legend.menu_title", { defaultValue: "Transit Legend / 乘車指南" }), view: "legend" as const },
            ].map(({ icon: Icon, label, view: target }) => (
              <button
                key={label}
                onClick={() => {
                  setPreviousView(view);
                  setView(target);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">{label}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {profileOpen && (
        <Panel title={t("profile.title")} onClose={() => setProfileOpen(false)}>
          <div className="flex items-center gap-3">
            <UserCircle className="h-10 w-10 text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.guest")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("profile.local_only")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ProfileStat label={t("nav.history")} value={history.length} />
            <ProfileStat label={t("nav.saved")} value={savedTrips.length} />
            <ProfileStat label={t("nav.alerts")} value={alerts.length} />
            <ProfileStat label="Favorites" value={favorites.length} />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Theme / 顯示主題</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose your appearance style</p>
              </div>
            </div>
            <div className="relative flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80">
              <div className="grid w-full grid-cols-3 gap-1 relative z-10">
                {[
                  { id: "light" as const, label: "Light", icon: Sun },
                  { id: "dark" as const, label: "Dark", icon: Moon },
                  { id: "auto" as const, label: "Auto", icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all duration-300 ${
                        isSelected
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {selectedTrip && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm px-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 sm:rounded-3xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTrip.service}</p>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{t("seat.title")}</h2>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["standard", "window", "aisle", "first"].map((seat) => (
                <button
                  key={seat}
                  onClick={() => setSeatChoice(seat)}
                  className={`rounded-xl border p-3 text-left text-sm font-bold ${
                    seatChoice === seat ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  }`}
                >
                  {t(`seat.${seat}`)}
                </button>
              ))}
            </div>
            <button onClick={confirmSeat} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-all">
              <Check className="h-4 w-4" />
              {t("seat.confirm")}
            </button>
          </div>
        </div>
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
      <div className="mb-5 flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          {icon}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      </div>
      {children}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-end bg-slate-900/60 backdrop-blur-sm">
      <div className="min-h-screen w-full max-w-sm space-y-5 border-l border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
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
    <div className="rounded-3xl border border-slate-200 p-3 text-center dark:border-slate-700">
      <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
