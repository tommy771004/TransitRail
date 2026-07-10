// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Main App entry component handling multi-country transit routing, views, and data workflow

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MessageSquare, Bell, BellOff, Share2, Bookmark, Check, Clock, DatabaseZap, MapPinned, Trash2, UserCircle, X, Activity, Sun, Moon, Monitor, CalendarDays, Coins, Compass, Search, Pin } from "lucide-react";
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
import { FeedbackView } from "./components/FeedbackView";
import { DiagnosticOverlay } from "./components/DiagnosticOverlay";
import { ResultSkeleton } from "./components/ResultSkeleton";
import { TransitLegend } from "./components/TransitLegend";
import { TransitIcon, formatPlatform } from "./components/TransitIcon";
import { generateICS } from "./utils/ics";
import { stationLabel } from "./utils/stationLabel";
import { triggerHaptic } from "./utils/haptics";
import { getAuditHeaders } from "./utils/audit";
import { get, set } from "idb-keyval";
import { countryConfig, providerDateValue, countryThemes, countryFlags, countryOptions } from "./data/countries";
import type {
  AppAlert,
  AppView,
  Country,
  CurrencyDisplayMode,
  FavoriteRoute,
  KoreaFilter,
  SavedTrip,
  SearchHistoryItem,
  SearchParams,
  SearchResponse,
  SortMode,
  TransitResult,
} from "./types";

import { allCurrencies } from "./data/countries";

const emptySearch: SearchParams = {
  origin: "",
  destination: "",
  date: providerDateValue("japan"),
  country: "japan",
  preferredTransitTypes: [],
};

const seoCountryPathMap: Record<Country, string> = {
  japan: "/japan",
  korea: "/korea",
  china: "/china",
  singapore: "/singapore",
  thailand: "/thailand",
  hong_kong: "/hong-kong",
  united_kingdom: "/united-kingdom",
  united_states: "/united-states",
  germany: "/germany",
  france: "/france",
  switzerland: "/switzerland",
};

function normalizeCountrySlug(value: string | null): Country | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  return countryOptions.includes(normalized as Country) ? (normalized as Country) : undefined;
}

function countryFromPath(pathname: string): Country | undefined {
  const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  const pathMap: Record<string, Country> = {
    "/japan": "japan",
    "/korea": "korea",
    "/china": "china",
    "/singapore": "singapore",
    "/thailand": "thailand",
    "/hong-kong": "hong_kong",
    "/hong_kong": "hong_kong",
    "/united-kingdom": "united_kingdom",
    "/united_kingdom": "united_kingdom",
    "/united-states": "united_states",
    "/united_states": "united_states",
    "/germany": "germany",
    "/france": "france",
    "/switzerland": "switzerland",
  };

  return pathMap[normalizedPath];
}

function buildInitialSearch(defaultCountry: Country): SearchParams {
  const pathCountry = countryFromPath(window.location.pathname);
  const query = new URLSearchParams(window.location.search);
  const queryCountry = normalizeCountrySlug(query.get("country"));
  const resolvedCountry = queryCountry ?? pathCountry ?? defaultCountry;
  const rawDate = query.get("date");
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : providerDateValue(resolvedCountry);

  return {
    origin: (query.get("origin") || "").trim(),
    destination: (query.get("destination") || "").trim(),
    date,
    country: resolvedCountry,
    preferredTransitTypes: [],
  };
}

function buildCanonicalSearchUrl(params: SearchParams) {
  const path = seoCountryPathMap[params.country] || "/";
  const query = new URLSearchParams();
  const origin = params.origin.trim();
  const destination = params.destination.trim();
  const date = params.date?.trim();

  if (origin) {
    query.set("origin", origin);
  }
  if (destination) {
    query.set("destination", destination);
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    query.set("date", date);
  }

  const queryString = query.toString();
  return queryString
    ? `${window.location.origin}${path}?${queryString}`
    : `${window.location.origin}${path}`;
}

interface CachedExchangeRates {
  base: string;
  rates: Record<string, number>;
  cachedAt: number;
}

const EXCHANGE_RATE_CACHE_TTL_MS = 5 * 60 * 1000;

function readCachedExchangeRates(base: string): Record<string, number> | undefined {
  try {
    const raw = window.sessionStorage.getItem(`transitrail.exchange-rates.${base}`);
    if (!raw) return undefined;

    const cached = JSON.parse(raw) as CachedExchangeRates;
    if (cached.base !== base || !cached.rates || Date.now() - cached.cachedAt > EXCHANGE_RATE_CACHE_TTL_MS) {
      return undefined;
    }
    return cached.rates;
  } catch {
    return undefined;
  }
}

function cacheExchangeRates(base: string, rates: Record<string, number>) {
  try {
    const value: CachedExchangeRates = { base, rates, cachedAt: Date.now() };
    window.sessionStorage.setItem(`transitrail.exchange-rates.${base}`, JSON.stringify(value));
  } catch {
    // Private browsing or a full storage quota should not block the converter.
  }
}

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
  const { t, i18n } = useTranslation();
  
  const initialPreferredCountry = useMemo<Country>(() => {
    const pathSelectedCountry = countryFromPath(window.location.pathname);
    const querySelectedCountry = normalizeCountrySlug(new URLSearchParams(window.location.search).get("country"));
    if (pathSelectedCountry || querySelectedCountry) {
      return querySelectedCountry ?? pathSelectedCountry ?? "japan";
    }

    const stored = localStorage.getItem("transitrail.preferredCountry") as Country | null;
    if (stored && countryOptions.includes(stored as Country)) {
      return stored as Country;
    }
    // Auto-detect based on local timezone (Geo alignment)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Tokyo")) return "japan";
      if (tz.includes("Seoul")) return "korea";
      if (tz.includes("Singapore")) return "singapore";
      if (tz.includes("Bangkok")) return "thailand";
      if (tz.includes("Hong_Kong")) return "hong_kong";
      if (tz.includes("London") || tz.includes("Europe/London")) return "united_kingdom";
      if (tz.includes("New_York") || tz.includes("Chicago") || tz.includes("Denver") || tz.includes("Los_Angeles") || tz.includes("Phoenix") || tz.includes("Detroit") || tz.includes("Indianapolis") || tz.includes("Anchorage") || tz.includes("Honolulu")) return "united_states";
      if (tz.includes("Berlin") || tz.includes("Europe/Berlin")) return "germany";
      if (tz.includes("Paris") || tz.includes("Europe/Paris")) return "france";
      if (tz.includes("Shanghai") || tz.includes("Chongqing") || tz.includes("Harbin") || tz.includes("Urumqi")) return "china";
    } catch (e) {
      console.error("Timezone detection error", e);
    }
    return "japan";
  }, []);

  const [preferredCountry, setPreferredCountry] = useState<Country>(initialPreferredCountry);

  const initialSearch: SearchParams = buildInitialSearch(initialPreferredCountry);

  const [view, setView] = useState<AppView>("search");
  const [previousView, setPreviousView] = useState<AppView>("search");
  const [draftSearch, setDraftSearch] = useState<SearchParams>(initialSearch);
  const activeCountry = draftSearch.country || initialPreferredCountry;
  const activeTheme = countryThemes[activeCountry] || countryThemes.japan;
  const [searchParams, setSearchParams] = useState<SearchParams>(initialSearch);
  const [results, setResults] = useState<TransitResult[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("fastest");
  const [koreaFilter, setKoreaFilter] = useState<KoreaFilter>("all");
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadJson("transitrail.history", []));
  const sortedHistoryList = useMemo(() => {
    return [...history].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [history]);
  const [favorites, setFavorites] = useState<FavoriteRoute[]>(() => loadJson("transitrail.favorites", []));
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => loadJson("transitrail.saved", []));
  const [savedTripsSearch, setSavedTripsSearch] = useState("");
  const [alerts, setAlerts] = useState<AppAlert[]>(() => loadJson("transitrail.alerts", []));
  const [selectedTrip, setSelectedTrip] = useState<TransitResult | null>(null);
  const [seatChoice, setSeatChoice] = useState("standard");
  const [stationPickTarget, setStationPickTarget] = useState<"origin" | "destination">("origin");
  const [originLineId, setOriginLineId] = useState<string | undefined>();
  const [showStations, setShowStations] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(
    () => (localStorage.getItem("transitrail.theme") as "light" | "dark" | "auto") || "auto"
  );
  const [apiDiagnostic, setApiDiagnostic] = useState<any>(null);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [priceDisplayMode, setPriceDisplayMode] = useState<CurrencyDisplayMode>(
    () => (localStorage.getItem("transitrail.priceDisplayMode") as CurrencyDisplayMode) || "both"
  );
  const [homeCurrency, setHomeCurrency] = useState<string>(() => localStorage.getItem("transitrail.homeCurrency") || "TWD");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const [generatingPosterIds, setGeneratingPosterIds] = useState<string[]>([]);

  useEffect(() => {
    if (view !== "saved") return;
    const tripToGenerate = savedTrips.find(t => !t.posterSvg && !generatingPosterIds.includes(t.id));
    if (!tripToGenerate) return;
    setGeneratingPosterIds(prev => [...prev, tripToGenerate.id]);
    fetch("/api/generate-poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: tripToGenerate.origin,
        destination: tripToGenerate.destination,
        country: tripToGenerate.country
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to generate poster");
        return res.json();
      })
      .then(data => {
        if (data.svg) {
          setSavedTrips(prev => prev.map(t => t.id === tripToGenerate.id ? { ...t, posterSvg: data.svg } : t));
        }
      })
      .catch(err => {
        console.error("Poster generation error:", err);
      })
      .finally(() => {
        setGeneratingPosterIds(prev => prev.filter(id => id !== tripToGenerate.id));
      });
  }, [view, savedTrips, generatingPosterIds]);

  // SEO and Dynamic Metadata Engine
  useEffect(() => {
    const baseTitle = "Rail National";
    let title = baseTitle;
    let description = "International rail routing with official live transit providers and AI planning";
    let schemaJson: any = null;
    const searchLikeParams = view === "results" ? searchParams : draftSearch;
    const canonicalUrl =
      view === "search" || view === "results"
        ? buildCanonicalSearchUrl(searchLikeParams)
        : `${window.location.origin}/`;

    if (view === "search") {
      const countryLabel = t(countryConfig[draftSearch.country].labelKey);
      title = `${t("menu.new_search", { defaultValue: "New Search" })} - ${countryLabel} | ${baseTitle}`;
      description = `Search live schedules, ticket fares, and routes for train systems in ${countryLabel}. Connect with official transit providers including JR, Korail, MTR, TfL, DB, and more.`;
      
      schemaJson = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": baseTitle,
        "url": canonicalUrl,
        "description": description,
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${window.location.origin}/?country={country}&origin={origin}&destination={destination}&date={date}`
          },
          "query-input": "required name=country required name=origin required name=destination required name=date"
        }
      };
    } else if (view === "results") {
      const countryLabel = t(countryConfig[searchParams.country].labelKey);
      const originName = stationLabel(t, searchParams.origin, searchParams.country);
      const destinationName = stationLabel(t, searchParams.destination, searchParams.country);
      title = `${originName} ➔ ${destinationName} | ${countryLabel} | ${baseTitle}`;
      description = `Live train timetables from ${originName} to ${destinationName} in ${countryLabel}. Compare ticket prices, seat options, and transfer details.`;
      
      schemaJson = {
        "@context": "https://schema.org",
        "@type": "Trip",
        "name": `${originName} to ${destinationName} Transit`,
        "url": canonicalUrl,
        "provider": {
          "@type": "Organization",
          "name": countryConfig[searchParams.country].provider
        },
        "departureStation": {
          "@type": "TrainStation",
          "name": originName
        },
        "arrivalStation": {
          "@type": "TrainStation",
          "name": destinationName
        },
        "departureTime": searchParams.date
      };
    } else if (view === "saved") {
      title = `${t("profile.favorites", { defaultValue: "Favorites" })} & Saved Trips | ${baseTitle}`;
      description = "View your saved trips, favorite routes, and offline schedule history on Rail National.";
    } else if (view === "alerts") {
      title = `Transit Alerts & Updates | ${baseTitle}`;
      description = "Real-time transit service alerts, platform notices, and system diagnostic updates.";
    } else if (view === "feedback") {
      title = `${t("feedback.title", { defaultValue: "Feedback" })} | ${baseTitle}`;
      description = "Send feedback to Rail National.";
    }

    // Apply document title
    document.title = title;

    // Apply document lang
    if (i18n.language) {
      document.documentElement.lang = i18n.language;
    }

    // Apply description meta tag
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", description);

    // Apply keywords meta tag
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement("meta");
      metaKeywords.setAttribute("name", "keywords");
      document.head.appendChild(metaKeywords);
    }
    const keywords = view === "results"
      ? `train, transit, schedule, routing, ${searchParams.origin}, ${searchParams.destination}, ${searchParams.country}, timetables`
      : `train, transit, schedule, routing, international rail, subway, travel planner, timetables`;
    metaKeywords.setAttribute("content", keywords);

    // Apply Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    // Apply OpenGraph & Twitter Card Meta Tags
    const ogTags = {
      "og:title": title,
      "og:description": description,
      "og:url": canonicalUrl,
      "og:type": "website",
      "og:site_name": baseTitle,
      "twitter:card": "summary_large_image",
      "twitter:title": title,
      "twitter:description": description,
    };
    Object.entries(ogTags).forEach(([key, val]) => {
      let metaTag = document.querySelector(`meta[property="${key}"]`) || document.querySelector(`meta[name="${key}"]`);
      if (!metaTag) {
        metaTag = document.createElement("meta");
        if (key.startsWith("og:")) {
          metaTag.setAttribute("property", key);
        } else {
          metaTag.setAttribute("name", key);
        }
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute("content", val);
    });

    // Control indexing for non-content routes (noindex, nofollow)
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      document.head.appendChild(robotsMeta);
    }
    const shouldNoIndex = view === "alerts" || view === "saved" || view === "history" || view === "workflow" || view === "feedback";
    robotsMeta.setAttribute(
      "content",
      shouldNoIndex
        ? "noindex, nofollow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
    );

    // Apply structured SEO data (JSON-LD)
    if (schemaJson) {
      let script = document.getElementById("jsonld-seo");
      if (script) {
        script.innerHTML = JSON.stringify(schemaJson);
      } else {
        script = document.createElement("script");
        script.id = "jsonld-seo";
        script.setAttribute("type", "application/ld+json");
        script.innerHTML = JSON.stringify(schemaJson);
        document.head.appendChild(script);
      }
    } else {
      const script = document.getElementById("jsonld-seo");
      if (script) script.remove();
    }
  }, [view, draftSearch.country, draftSearch.origin, draftSearch.destination, draftSearch.date, searchParams.origin, searchParams.destination, searchParams.country, searchParams.date, t, i18n.language]);
  const [legendHighlight, setLegendHighlight] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem("transitrail.timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  useEffect(() => {
    localStorage.setItem("transitrail.timezone", timezone);
  }, [timezone]);

  useEffect(() => {
    localStorage.setItem("transitrail.preferredCountry", preferredCountry);
    setDraftSearch((prev) => ({
      ...prev,
      country: preferredCountry,
      date: prev.country === preferredCountry ? prev.date : providerDateValue(preferredCountry)
    }));
  }, [preferredCountry]);

  useEffect(() => saveJson("transitrail.history", history), [history]);
  useEffect(() => saveJson("transitrail.favorites", favorites), [favorites]);
  useEffect(() => saveJson("transitrail.saved", savedTrips), [savedTrips]);
  useEffect(() => saveJson("transitrail.alerts", alerts), [alerts]);
  useEffect(() => {
    localStorage.setItem("transitrail.homeCurrency", homeCurrency);
  }, [homeCurrency]);
  useEffect(() => {
    localStorage.setItem("transitrail.priceDisplayMode", priceDisplayMode);
  }, [priceDisplayMode]);

  useEffect(() => {
    const cachedRates = readCachedExchangeRates(homeCurrency);
    if (cachedRates) {
      setExchangeRates(cachedRates);
      setLoadingRates(false);
      return;
    }

    let cancelled = false;
    const fetchRates = async () => {
      setLoadingRates(true);
      try {
        const res = await fetch(`/api/exchange-rates?base=${homeCurrency}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            cacheExchangeRates(homeCurrency, data.rates);
            if (!cancelled) {
              setExchangeRates(data.rates);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates", err);
      } finally {
        if (!cancelled) {
          setLoadingRates(false);
        }
      }
    };
    fetchRates();
    return () => {
      cancelled = true;
    };
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

  const localeForCurrency = (c: string) => {
    switch (c) {
      case "JPY": return "ja-JP";
      case "KRW": return "ko-KR";
      case "HKD": return "zh-HK";
      case "TWD": return "zh-TW";
      case "CNY": return "zh-CN";
      case "GBP": return "en-GB";
      case "EUR": return "de-DE";
      case "THB": return "th-TH";
      case "AUD": return "en-AU";
      case "CAD": return "en-CA";
      case "NZD": return "en-NZ";
      case "PHP": return "en-PH";
      case "IDR": return "id-ID";
      case "VND": return "vi-VN";
      case "SEK": return "sv-SE";
      case "NOK": return "nb-NO";
      case "DKK": return "da-DK";
      case "PLN": return "pl-PL";
      case "TRY": return "tr-TR";
      case "ZAR": return "en-ZA";
      case "BRL": return "pt-BR";
      case "MXN": return "es-MX";
      case "RUB": return "ru-RU";
      case "INR": return "en-IN";
      case "SAR": return "ar-SA";
      case "AED": return "ar-AE";
      case "ILS": return "he-IL";
      case "CZK": return "cs-CZ";
      case "HUF": return "hu-HU";
      case "RON": return "ro-RO";
      default: return "en-US";
    }
  };

  const fractionDigits = (c: string) =>
    c === "JPY" || c === "KRW" || c === "TWD" || c === "CNY" || c === "VND" || c === "IDR" ? 0 : 2;

  const formatPriceForTrip = (price?: number, currency?: string) => {
    if (price === undefined || !currency) return null;
    return new Intl.NumberFormat(localeForCurrency(currency), {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits(currency),
    }).format(price);
  };

  const formatConvertedPrice = (price?: number, currency?: string) => {
    if (price === undefined || !currency) return null;

    const nativeFormatted = formatPriceForTrip(price, currency);

    if (currency === homeCurrency || priceDisplayMode === "original") {
      return nativeFormatted;
    }

    const rate = exchangeRates[currency];
    if (!rate) {
      return nativeFormatted;
    }

    const convertedAmount = price / rate;
    const convertedFormatted = formatPriceForTrip(convertedAmount, homeCurrency);

    if (priceDisplayMode === "converted") {
      return convertedFormatted;
    }

    return `${nativeFormatted} (~${convertedFormatted})`;
  };

  const formatTripPrice = (trip: TransitResult) =>
    formatConvertedPrice(trip.price, trip.currency);

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

    const todayStr = providerDateValue(country);
    const queryParams: any = { ...params };
    if (date === todayStr) {
      const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      nowInTz.setHours(nowInTz.getHours() - 1);
      const queryTime = `${String(nowInTz.getHours()).padStart(2, '0')}:${String(nowInTz.getMinutes()).padStart(2, '0')}`;
      queryParams.time = queryTime;
    }
    const query = new URLSearchParams(queryParams).toString();
    const url = `/api/transit/search?${query}`;

    try {
      const startTime = performance.now();
      const res = await fetch(url, {
        headers: getAuditHeaders(i18n.language, timezone),
      });
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
      (trip.price ? `• Price: ${formatTripPrice(trip) || formatConvertedPrice(trip.price, trip.currency) || `${trip.price} ${trip.currency || ""}`}\n` : "") +
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

  const togglePinHistory = (id: string) => {
    setHistory((current) =>
      current.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );
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
    setShowStations(true);
  };

  const selectStation = (station: string, autoFillDest?: string, lineId?: string) => {
    setDraftSearch((current) => {
      const next = { ...current, [stationPickTarget]: station };
      if (stationPickTarget === "origin" && autoFillDest) {
        next.destination = autoFillDest;
      }
      return next;
    });

    if (stationPickTarget === "origin" && lineId) {
      setOriginLineId(lineId);
    }

    setShowStations(false);
  };

  const renderView = () => {
    switch (view) {
      case "search":
        return (
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
            onTogglePinHistory={togglePinHistory}
          />
        );
      case "workflow":
        return (
          <DataWorkflowView params={draftSearch} onBack={() => setView("search")} />
        );
      case "results":
        if (isSearching) {
          return (
            <div className="pt-20 pb-28 min-h-screen bg-transparent max-w-md mx-auto">
              <ResultSkeleton />
            </div>
          );
        }
        if (["japan", "germany", "france", "china"].includes(searchParams.country)) {
          return (
            <JapanResultView
              country={searchParams.country}
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
              formatPrice={formatTripPrice}
            />
          );
        }
        if (searchParams.country === "korea") {
          return (
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
              formatPrice={formatTripPrice}
            />
          );
        }
        if (["hong_kong", "singapore", "thailand"].includes(searchParams.country)) {
          return (
            <MetroResultView
              country={searchParams.country}
              origin={searchParams.origin}
              destination={searchParams.destination}
              date={searchParams.date}
              error={error}
              results={visibleResults}
              savedIds={savedIds}
              onModify={() => setView("search")}
              onSave={toggleSaveTrip}
              onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
              formatPrice={formatTripPrice}
            />
          );
        }
        if (searchParams.country === "united_kingdom") {
          return (
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
              formatPrice={formatTripPrice}
            />
          );
        }
        if (searchParams.country === "united_states") {
          return (
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
              formatPrice={formatTripPrice}
            />
          );
        }
        if (searchParams.country === "switzerland") {
          return (
            <LiveRailResultView
              market="switzerland"
              origin={searchParams.origin}
              destination={searchParams.destination}
              date={searchParams.date}
              error={error}
              results={visibleResults}
              savedIds={savedIds}
              onModify={() => setView("search")}
              onSave={toggleSaveTrip}
              onOpenLegend={(highlight?: string) => { setLegendHighlight(highlight || null); setPreviousView(view); setView("legend"); }}
              formatPrice={formatTripPrice}
            />
          );
        }
        return null;
      case "legend":
        return (
          <TransitLegend 
            onBack={() => setView(previousView)} 
            highlightLine={legendHighlight}
          />
        );
      case "history":
        return (
          <UtilityPage
            title={t("nav.history")}
            icon={<Clock className="w-5 h-5" />}
            action={history.length > 0 ? (
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  setHistory([]);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-xl transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("history.clear_all")}</span>
              </button>
            ) : undefined}
          >
            {history.length === 0 ? (
              <EmptyState title={t("history.empty_title")} body={t("history.empty_body")} />
            ) : (
              <div className="space-y-2">
                {sortedHistoryList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {stationLabel(t, item.origin, item.country)}
                        <span className="mx-1.5 text-slate-400">&rarr;</span>
                        {stationLabel(t, item.destination, item.country)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{item.date} · {countryFlags[item.country] || ""} {t(countryConfig[item.country].labelKey)} · {item.resultCount} {t("history.results")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          triggerHaptic("light");
                          togglePinHistory(item.id);
                        }}
                        title={item.pinned ? t("history.unpin") : t("history.pin")}
                        className={`p-2 rounded-xl border transition-all ${
                          item.pinned
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                            : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-500 dark:hover:text-slate-400"
                        }`}
                      >
                        <Pin className={`h-4 w-4 ${item.pinned ? "fill-current rotate-45" : ""}`} />
                      </button>
                      <button
                        onClick={() => rerunHistorySearch(item)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-500 transition-all h-[36px]"
                      >
                        {t("history.search_again")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </UtilityPage>
        );
      case "saved":
        return (
          <UtilityPage
            title={t("nav.saved")}
            icon={<Bookmark className="w-5 h-5" />}
            action={savedTrips.length > 0 ? (
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  setSavedTrips([]);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-xl transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t("saved.clear_all")}</span>
              </button>
            ) : undefined}
          >
            {savedTrips.length === 0 ? (
              <EmptyState title={t("saved.empty_title")} body={t("saved.empty_body")} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-sm font-bold text-slate-900 block leading-tight dark:text-white">
                          {t("profile.currency_converter", { defaultValue: "Currency Converter / 匯率轉換" })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono leading-none">
                          {loadingRates 
                            ? t("profile.loading_rates", { defaultValue: "Updating live rates..." }) 
                            : t("profile.rates_relative_to", { currency: homeCurrency, defaultValue: `Rates relative to ${homeCurrency} (via Taiwan Central Bank)` })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-500 font-medium">
                        {t("profile.home_currency", { defaultValue: "Home:" })}
                      </span>
                      <select
                        value={homeCurrency}
                        onChange={(e) => setHomeCurrency(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {allCurrencies.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t("profile.price_display", { defaultValue: "Display" })}:
                    </span>
                    <div className="flex rounded-lg bg-slate-100 p-0.5">
                      {(["original", "converted", "both"] as CurrencyDisplayMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPriceDisplayMode(m)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-all ${
                            priceDisplayMode === m
                              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-200 dark:text-slate-900"
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-900"
                          }`}
                        >
                          {m === "original" ? "Original" : m === "converted" ? "Converted" : "Both"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("saved.search_placeholder", { defaultValue: "Search by service or destination..." })}
                    value={savedTripsSearch}
                    onChange={(e) => setSavedTripsSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-slate-500 shadow-sm transition-all"
                  />
                  {savedTripsSearch && (
                    <button
                      onClick={() => setSavedTripsSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {Object.entries(
                    savedTrips
                      .filter(trip => {
                        if (!savedTripsSearch) return true;
                        const s = savedTripsSearch.toLowerCase();
                        return (
                          (trip.service && trip.service.toLowerCase().includes(s)) ||
                          (trip.destination && trip.destination.toLowerCase().includes(s)) ||
                          (trip.origin && trip.origin.toLowerCase().includes(s))
                        );
                      })
                      .reduce((acc, trip) => {
                      const d = trip.date || "Unknown Date";
                      if (!acc[d]) acc[d] = [];
                      acc[d].push(trip);
                      return acc;
                    }, {} as Record<string, SavedTrip[]>)
                  )
                  .sort(([dateA], [dateB]) => {
                    if (dateA === "Unknown Date") return 1;
                    if (dateB === "Unknown Date") return -1;
                    return dateA.localeCompare(dateB);
                  })
                  .map(([date, trips]) => (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{date}</h4>
                      </div>
                      <div className="space-y-2.5">
                        {(trips as SavedTrip[]).map((trip) => (
                    <div key={trip.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      {trip.posterSvg && (
                        <div 
                          className="mb-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner max-h-[140px] flex items-center justify-center bg-slate-950 [&>svg]:w-full [&>svg]:h-auto"
                          dangerouslySetInnerHTML={{ __html: trip.posterSvg }}
                        />
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300" style={{ borderLeft: `3px solid ${trip.lineColor || "#94a3b8"}` }}>
                              <TransitIcon trip={trip} className="h-3 w-3" />
                              <span>{trip.service}</span>
                            </span>
                          </div>
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {stationLabel(t, trip.origin, trip.country)}
                            <span className="mx-1.5 text-slate-400">&rarr;</span>
                            {stationLabel(t, trip.destination, trip.country)}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{trip.departureTime}{trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}</span>
                            </span>
                            {formatPlatform(trip.platform || (trip as any).legs?.[0]?.platform, t) && (
                              <span className="shrink-0 inline-flex items-center rounded-md bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {formatPlatform(trip.platform || (trip as any).legs?.[0]?.platform, t)}
                              </span>
                            )}
                          </p>

                          {trip.price !== undefined && trip.currency && (
                            <div className="mt-2 text-xs font-bold text-slate-700 flex items-center gap-1 dark:text-slate-300">
                              <span className="text-slate-400 font-normal">Fare:</span>
                              <span className="bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-0.5 font-mono dark:bg-slate-800 dark:border-slate-700">
                                {formatTripPrice(trip) || formatConvertedPrice(trip.price, trip.currency)}
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
                  ))}
                </div>
              </div>
            )}
          </UtilityPage>
        );
      case "alerts":
        return (
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
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen relative overflow-x-hidden bg-slate-50/40 bg-gradient-to-tr ${activeTheme.primaryBgLight} font-sans text-slate-900 selection:bg-emerald-200 transition-all duration-500 dark:bg-[#060a13] ${activeTheme.primaryBgDark} dark:text-slate-100 dark:selection:bg-emerald-800/40`}>
      {/* Premium Cinematic Background Glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-indigo-500/10 dark:bg-indigo-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[60%] h-[50%] rounded-full bg-emerald-500/10 dark:bg-emerald-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[50%] h-[40%] rounded-full bg-cyan-500/10 dark:bg-cyan-600/5 blur-[110px] pointer-events-none" />

      <Header 
        onMenuOpen={() => setMenuOpen(true)} 
        onProfileOpen={() => setProfileOpen(true)} 
        timezone={timezone}
        homeCurrency={homeCurrency}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={view === "results" ? `results-${isSearching}-${searchParams.country}` : view}
          initial={{ opacity: 0, scale: 0.985, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, y: -8 }}
          transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.7 }}
          className="w-full flex-1 flex flex-col"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showFeedback && (
          <FeedbackView onBack={() => setShowFeedback(false)} />
        )}
        {showStations && (
          <StationBrowser
            country={draftSearch.country}
            target={stationPickTarget}
            onBack={() => setShowStations(false)}
            onSelectStation={selectStation}
            scrollToLineId={stationPickTarget === "destination" ? originLineId : undefined}
            selectedOrigin={draftSearch.origin}
          />
        )}
      </AnimatePresence>

      <BottomNav activeView={view} unreadAlerts={unreadAlerts} onNavigate={handleNavigate} onOpenSettings={() => setProfileOpen(true)} country={activeCountry} />

      <AnimatePresence>
        {menuOpen && (
          <Panel title={t("menu.title")} onClose={() => setMenuOpen(false)}>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {[
                { icon: MapPinned, label: t("menu.new_search"), view: "search" as const },
                { icon: Clock, label: t("nav.history"), view: "history" as const },
                { icon: Bookmark, label: t("nav.saved"), view: "saved" as const },
                { icon: Compass, label: t("legend.menu_title", { defaultValue: "Transit Legend / 乘車指南" }), view: "legend" as const },
                { icon: MessageSquare, label: t("menu.feedback", { defaultValue: "Feedback" }), view: "feedback" as const },
              ].map(({ icon: Icon, label, view: target }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (target === "feedback") {
                      setShowFeedback(true);
                    } else {
                      setPreviousView(view);
                      setView(target as AppView);
                    }
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
      </AnimatePresence>

      <AnimatePresence>
        {profileOpen && (
          <Panel title={t("profile.title")} onClose={() => setProfileOpen(false)}>
          <div className="grid grid-cols-2 gap-2">
            <ProfileStat label={t("nav.history")} value={history.length} />
            <ProfileStat label={t("nav.saved")} value={savedTrips.length} />
            <ProfileStat label={t("nav.alerts")} value={alerts.length} />
            <ProfileStat label={t("profile.favorites", { defaultValue: "Favorites" })} value={favorites.length} />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.preferred_region", { defaultValue: "Preferred Region" })}</p>
                </div>
              </div>
              <select
                value={preferredCountry}
                onChange={(e) => setPreferredCountry(e.target.value as Country)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {countryOptions.map((c) => (
                  <option key={c} value={c}>{countryFlags[c]} {t(`search.${c}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.timezone")}</p>
                </div>
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {[
                  { id: "Asia/Taipei", name_en: "Taiwan (Taipei)", name_zh: "台灣 (Taipei)", flag: "🇹🇼" },
                  { id: "Asia/Tokyo", name_en: "Japan (Tokyo)", name_zh: "日本 (Tokyo)", flag: "🇯🇵" },
                  { id: "Asia/Seoul", name_en: "Korea (Seoul)", name_zh: "韓國 (Seoul)", flag: "🇰🇷" },
                  { id: "Asia/Singapore", name_en: "Singapore", name_zh: "新加坡 (Singapore)", flag: "🇸🇬" },
                  { id: "Asia/Bangkok", name_en: "Thailand (Bangkok)", name_zh: "泰國 (Bangkok)", flag: "🇹🇭" },
                  { id: "Asia/Hong_Kong", name_en: "Hong Kong", name_zh: "香港 (Hong Kong)", flag: "🇭🇰" },
                  { id: "Europe/London", name_en: "United Kingdom (London)", name_zh: "英國 (London)", flag: "🇬🇧" },
                  { id: "Europe/Berlin", name_en: "Germany (Berlin)", name_zh: "德國 (Berlin)", flag: "🇩🇪" },
                  { id: "Europe/Paris", name_en: "France (Paris)", name_zh: "法國 (Paris)", flag: "🇫🇷" },
                  { id: "America/New_York", name_en: "United States East (New York)", name_zh: "美國東岸 (New York)", flag: "🇺🇸" },
                  { id: "America/Los_Angeles", name_en: "United States West (Los Angeles)", name_zh: "美國西岸 (Los Angeles)", flag: "🇺🇸" },
                  { id: "Asia/Shanghai", name_en: "China (Shanghai)", name_zh: "中國 (Shanghai)", flag: "🇨🇳" },
                ].map((r) => (
                  <option key={r.id} value={r.id}>{r.flag} {i18n.language === "zh-TW" ? r.name_zh : r.name_en}</option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.local_currency")}</p>
                </div>
              </div>
              <select
                value={homeCurrency}
                onChange={(e) => setHomeCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {allCurrencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-slate-400 font-mono">
                {loadingRates ? t("profile.loading_rates") : t("profile.rates_source")}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.price_display")}</p>
                </div>
              </div>
              <div className="relative flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                <div className="grid w-full grid-cols-3 gap-1 relative z-10">
                  {[
                    { id: "original" as CurrencyDisplayMode, label: "Original", desc: t("profile.display_original_sub") },
                    { id: "converted" as CurrencyDisplayMode, label: "Converted", desc: t("profile.display_converted_sub") },
                    { id: "both" as CurrencyDisplayMode, label: "Both", desc: t("profile.display_both_sub") },
                  ].map((item) => {
                    const isSelected = priceDisplayMode === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPriceDisplayMode(item.id)}
                        className={`relative flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition-all duration-300 ${
                          isSelected
                            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-400">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t("profile.theme")}</p>
                </div>
              </div>
              <div className="relative flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                <div className="grid w-full grid-cols-3 gap-1 relative z-10">
                  {[
                    { id: "light" as const, label: t("profile.theme_light"), icon: Sun },
                    { id: "dark" as const, label: t("profile.theme_dark"), icon: Moon },
                    { id: "auto" as const, label: t("profile.theme_auto"), icon: Monitor },
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
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
          </div>
        </Panel>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTrip && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm px-4 sm:items-center"
            onClick={() => setSelectedTrip(null)}
          >
            <motion.div 
              initial={{ y: "60px", opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "40px", opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
              className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 sm:rounded-3xl dark:bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      <AnimatePresence>
        {diagnosticOpen && (
          <DiagnosticOverlay diagnostic={apiDiagnostic} onClose={() => setDiagnosticOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function UtilityPage({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-20">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">
            {icon}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        </div>
        {action}
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="fixed inset-0 z-[70] flex justify-end bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260, mass: 0.85 }}
        className="h-[100dvh] w-full max-w-sm overflow-y-auto overscroll-contain space-y-5 border-l border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
      </motion.div>
    </motion.div>
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

// --- End of App.tsx ---
