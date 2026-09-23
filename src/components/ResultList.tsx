// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The departure list shared by every market view — sort chips, the
// shared-fare line, the departed fold, the miss/empty blocks and one TripCard per
// verified departure. Market differences arrive as props, never as a second layout.

import { hasDisplayableFare } from "@/src/utils/fare";
import { ChevronDown } from "lucide-react";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import type { Country, CoverageGap, NoResultReason, SearchFailureKind, SortMode, TransitResult } from "../types";
import { countryConfig } from "../data/countries";
import { triggerHaptic } from "../utils/haptics";
import { minutesOf } from "../utils/journeyLegs";
import { renderEmptyBlock, renderMissBlock } from "./ResultShell";
import { TripCard, type TripCardProps } from "./TripCard";

const localeForCurrency = (currency?: string) => {
  switch (currency) {
    case "JPY": return "ja-JP";
    case "KRW": return "ko-KR";
    case "HKD": return "zh-HK";
    case "TWD": return "zh-TW";
    case "CNY": return "zh-CN";
    case "EUR": return "de-DE";
    case "GBP": return "en-GB";
    case "CHF": return "de-CH";
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
    case "MYR": return "ms-MY";
    case "SGD": return "en-SG";
    case "USD": return "en-US";
    default: return "en-US";
  }
};

const fractionDigitsForCurrency = (currency?: string) =>
  ["JPY", "KRW", "TWD", "CNY", "VND", "IDR", "HUF"].includes(currency || "") ? 0 : 2;

/** The verified fare as text, or null when the result carries none. Never an estimate. */
export function formatFare(trip: TransitResult, formatPrice?: (trip: TransitResult) => string | null): string | null {
  if (!hasDisplayableFare(trip)) return null;
  return formatPrice?.(trip) || new Intl.NumberFormat(localeForCurrency(trip.currency), {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: fractionDigitsForCurrency(trip.currency),
  }).format(trip.price);
}

/** The market's wall clock as "YYYY-MM-DD" and minutes since midnight. */
function marketClock(country: Country, now: Date): { date: string; minutes: number } | null {
  try {
    const timeZone = countryConfig[country]?.timeZone;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const hour = Number(get("hour")) % 24;
    return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
  } catch {
    return null;
  }
}

export type TripCardExtras = Partial<Pick<TripCardProps, "primaryAction" | "extraMeta" | "saveLabel" | "showFullStopSequence" | "headsign">>;

export interface ResultListProps {
  country: Country;
  results: TransitResult[];
  /** The searched service day (YYYY-MM-DD); the countdown only runs when it is today. */
  date?: string;
  /** The searched departure time (HH:MM); picks the next departure on another day. */
  time?: string;
  /** The wall clock, injectable so the countdown can be tested. */
  now?: () => Date;
  error?: string;
  noResultReason?: NoResultReason;
  failureKind?: SearchFailureKind;
  coverageGap?: CoverageGap;
  officialSourceUrl?: string;
  emptyTitle: string;
  emptyHint: string;
  onModify: () => void;
  onRetry?: () => void;
  recovery?: ReactNode;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  /** Fares are the reason rows are ordered, so every row shows its own. */
  priceEmphasis?: boolean;
  savedIds: Set<string>;
  onSave: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  /**
   * The fare as a row shows it. Rows carry only the native fare when the
   * passenger shows both currencies; the shared line and the sheet keep both.
   */
  formatRowPrice?: (trip: TransitResult) => string | null;
  /** Market controls that share the sticky bar with the sort chips. */
  toolbar?: ReactNode;
  /** Market filter chips on the sort row itself, after a divider (Korea's direct / first class). */
  filters?: ReactNode;
  /** A way forward once every listed departure has left (the following day's search). */
  allDepartedAction?: ReactNode;
  /** A notice above the first card (Metro's transfer hint). */
  beforeList?: ReactNode;
  afterResults?: ReactNode;
  /** Per-trip market extras for the card. */
  card?: (trip: TransitResult) => TripCardExtras;
  withExit?: boolean;
}

export function ResultList({
  country,
  results,
  date,
  time,
  now = () => new Date(),
  error,
  noResultReason,
  failureKind,
  coverageGap,
  officialSourceUrl,
  emptyTitle,
  emptyHint,
  onModify,
  onRetry,
  recovery,
  sortMode,
  onSortChange,
  priceEmphasis = false,
  savedIds,
  onSave,
  onOpenLegend,
  formatPrice,
  formatRowPrice,
  toolbar,
  filters,
  allDepartedAction,
  beforeList,
  afterResults,
  card,
  withExit = true,
}: ResultListProps) {
  const { t } = useTranslation();
  const [showPast, setShowPast] = useState(false);
  const nowRef = useRef(now);
  nowRef.current = now;
  const [, setTick] = useState(0);

  // The countdowns follow the wall clock: one re-render on each minute
  // boundary, paused while the page is hidden.
  useEffect(() => {
    if (!date) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    const start = () => {
      stop();
      timeout = setTimeout(() => {
        setTick((value) => value + 1);
        interval = setInterval(() => setTick((value) => value + 1), 60_000);
      }, 60_000 - (nowRef.current().getTime() % 60_000));
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        setTick((value) => value + 1);
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [date]);

  // "Departs in N min" and the departed fold are only honest against the
  // market's wall clock on the searched day; any other day gets neither, and
  // the searched time merely picks which departure counts as next. Which rows
  // count as departed is read once per result set, so a card never leaves the
  // list under the reader's finger; only the countdown text keeps moving.
  const listClock = useMemo(
    () => (date ? marketClock(country, nowRef.current()) : null),
    [country, date, results],
  );
  const reference = listClock && listClock.date === date ? listClock.minutes : null;
  const liveClock = date ? marketClock(country, now()) : null;
  const liveReference = liveClock && liveClock.date === date ? liveClock.minutes : null;
  const searched = reference ?? minutesOf(time);
  const departure = (trip: TransitResult) => minutesOf(trip.departureTime);
  const isPast = (trip: TransitResult) => {
    const dep = departure(trip);
    return reference !== null && dep !== null && dep < reference;
  };

  // Badges are relative to this result set: a fastest that every row shares
  // is not a distinction, and a fare that never varies is one line, not a column.
  const durations = results.map((trip) => trip.durationMinutes).filter((value): value is number => typeof value === "number");
  const fastest = durations.length > 1 && new Set(durations).size > 1 ? Math.min(...durations) : undefined;
  const fares = results.filter(hasDisplayableFare);
  const distinctPrices = new Set(fares.map((trip) => trip.price));
  const cheapest = distinctPrices.size > 1 ? Math.min(...fares.map((trip) => trip.price)) : undefined;
  // One line replaces the column only when every row shares that fare; a fare
  // some rows carry and others lack stays on the rows that have it.
  const everyRowFared = fares.length > 0 && fares.length === results.length;
  const fareOnRows = fares.length > 0 && (distinctPrices.size > 1 || priceEmphasis || !everyRowFared);
  const sharedFare = !fareOnRows && everyRowFared ? formatFare(fares[0], formatPrice) : null;

  const upcoming = results.filter((trip) => {
    const dep = departure(trip);
    return searched === null || dep === null || dep >= searched;
  });
  const nextId = upcoming.reduce<TransitResult | undefined>((best, trip) => {
    const dep = departure(trip);
    if (dep === null) return best;
    const bestDep = best ? departure(best) : null;
    return bestDep === null || dep < bestDep ? trip : best;
  }, undefined)?.id ?? upcoming[0]?.id;
  // No fallback to a row before the searched time: with the fold open, a
  // departed train must never carry the Next badge.

  const departed = results.filter(isPast);
  const visible = showPast ? results : results.filter((trip) => !isPast(trip));
  // Late at night the list could be nothing but the fold line. Say what that
  // means instead: the verified departures shown have left. Never "no service"
  // or "last train", which only a full timetable could claim.
  const allDeparted = !showPast && departed.length > 0 && visible.length === 0;
  const lastShown = departed.reduce<TransitResult | undefined>((latest, trip) => {
    const dep = departure(trip);
    const latestDep = latest ? departure(latest) : null;
    return dep !== null && (latestDep === null || dep > latestDep) ? trip : latest;
  }, undefined);

  // A long day in departure order gets an hour heading before the first
  // verified row of each hour. Headings come only from rows: an hour without
  // one gets no heading and no "no trains" claim, since a gap means no
  // verified row, not no service.
  const hourIdPrefix = useId();
  const hourOf = (trip: TransitResult) => {
    const dep = departure(trip);
    return dep === null ? null : Math.floor(dep / 60);
  };
  const groupByHour = (sortMode ?? "earliest") === "earliest" && visible.length > 20;
  const hourId = (hour: number) => `${hourIdPrefix}-hour-${hour}`;
  // Past two dozen rows, the sort row also offers a jump to each hour that has
  // one; plain anchors, no scroll observers.
  const railHours = groupByHour && visible.length > 24
    ? [...new Set(visible.map(hourOf).filter((hour): hour is number => hour !== null))]
    : [];
  const jumpToHour = (hour: number) => {
    const heading = document.getElementById(hourId(hour));
    if (!heading) return;
    triggerHaptic("light");
    heading.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  };

  // A secondary sort only earns a chip when pressing it could move a row. A
  // timed search is always in departure order first, so there the chip can only
  // reorder departures that share a minute; an all-day list reorders whenever
  // the values differ at all. Earliest and the pressed chip always stay.
  const canReorder = (value: (trip: TransitResult) => number | undefined) => {
    const groups = new Map<string, Set<number>>();
    for (const trip of results) {
      const key = time ? String(departure(trip)) : "day";
      const measured = value(trip);
      if (measured === undefined) continue;
      const seen = groups.get(key) ?? new Set<number>();
      seen.add(measured);
      groups.set(key, seen);
    }
    return [...groups.values()].some((seen) => seen.size > 1);
  };
  const sortChips: Array<{ mode: SortMode; label: string }> = [
    { mode: "earliest", label: t("result.earliest") },
    ...(sortMode === "fastest" || canReorder((trip) => trip.durationMinutes)
      ? [{ mode: "fastest" as const, label: t(time ? "journey.secondary_fastest" : "result.fastest") }]
      : []),
    ...(sortMode === "cheapest" || canReorder((trip) => (hasDisplayableFare(trip) ? trip.price : undefined))
      ? [{ mode: "cheapest" as const, label: t(time ? "journey.secondary_cheapest" : "result.cheapest") }]
      : []),
  ];
  const showSort = Boolean(sortMode && onSortChange) && !error && results.length > 0;

  return (
    <>
      {(showSort || (toolbar && !error && results.length > 0)) && (
        <div className="sticky top-16 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
          <div className="mx-auto max-w-md min-w-0 lg:max-w-5xl">
            {toolbar}
            {showSort && (
              <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-2.5">
              <div role="group" aria-label={t("result.sort_by")} className="flex shrink-0 gap-2">
                {sortChips.map((chip) => (
                  <button
                    key={chip.mode}
                    type="button"
                    aria-pressed={sortMode === chip.mode}
                    onClick={() => {
                      triggerHaptic("light");
                      onSortChange?.(chip.mode);
                    }}
                    className={`m3-chip m3-state m3-shape-full shrink-0 ${
                      sortMode === chip.mode
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {filters ? (
                <>
                  <span aria-hidden="true" className="h-6 w-px shrink-0 bg-slate-300 dark:bg-slate-600" />
                  {filters}
                </>
              ) : null}
              {railHours.length > 1 ? (
                <>
                  <span aria-hidden="true" className="h-6 w-px shrink-0 bg-slate-300 dark:bg-slate-600" />
                  <nav aria-label={t("result.jump_to_hour")} className="flex shrink-0 gap-2">
                    {railHours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => jumpToHour(hour)}
                        className="m3-chip m3-state m3-shape-sm shrink-0 border border-slate-300 px-3 tabular-nums text-slate-700 dark:border-slate-600 dark:text-slate-300"
                      >
                        {t("result.hour_heading", { hour: String(hour).padStart(2, "0") })}
                      </button>
                    ))}
                  </nav>
                </>
              ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* One column on phones and tablets; from lg the same cards take a 40rem
          column and the supplementary blocks a sticky aside. Only containers
          change: the aside follows every card in the DOM. */}
      <section className="mx-auto max-w-md min-w-0 space-y-3 px-4 py-4 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,40rem)_minmax(18rem,22rem)] lg:items-start lg:gap-8 lg:space-y-0">
        <AnimatePresence mode="popLayout">
          {error ? (
            renderMissBlock({
              message: error,
              reason: noResultReason,
              failureKind,
              coverageGap,
              country,
              sourceUrl: officialSourceUrl,
              errorTitle: t("result.unable_to_fetch"),
              onModify,
              onRetry,
              recovery,
            })
          ) : results.length === 0 ? (
            renderEmptyBlock(emptyTitle, emptyHint)
          ) : (
            <motion.div
              key="list-container"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 space-y-3"
            >
              {beforeList}
              {sharedFare && !allDeparted && (
                <p className="m3-body-small flex min-w-0 items-baseline justify-between gap-3 px-1 text-slate-500 dark:text-slate-400">
                  <span className="truncate">{t("result.fare_all")}</span>
                  <span className="m3-label-large shrink-0 tabular-nums text-slate-900 dark:text-white">{sharedFare}</span>
                </p>
              )}
              {allDeparted ? (
                <div role="status" className="m3-card m3-card-large m3-elevation-1 bg-white p-4 dark:bg-slate-900">
                  <p className="m3-title-medium text-slate-900 dark:text-white">{t("result.all_departed_title")}</p>
                  <p className="m3-body-medium mt-1 text-slate-600 dark:text-slate-300">
                    {t("result.all_departed_body", { count: departed.length, time: lastShown?.departureTime ?? "--:--" })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPast(true)}
                      className="m3-button m3-state border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      {t("result.show_departed")}
                    </button>
                    {allDepartedAction}
                  </div>
                </div>
              ) : null}
              {departed.length > 0 && !showPast && !allDeparted && (
                <button
                  type="button"
                  onClick={() => setShowPast(true)}
                  aria-label={t("result.show_departed")}
                  className="m3-state m3-body-small flex min-h-8 w-full items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400"
                >
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                  <span className="shrink-0 whitespace-nowrap">{t("result.departed_count", { count: departed.length })}</span>
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                </button>
              )}
              <AnimatePresence mode="popLayout">
                {visible.map((trip, index) => {
                  const dep = departure(trip);
                  const extras = card?.(trip) ?? {};
                  const hour = groupByHour ? hourOf(trip) : null;
                  const startsHour = hour !== null && (index === 0 || hourOf(visible[index - 1]) !== hour);
                  return (
                    <Fragment key={trip.id}>
                      {startsHour && hour !== null ? (
                        <h2
                          id={hourId(hour)}
                          tabIndex={-1}
                          className="m3-label-large flex scroll-mt-32 items-center gap-2 px-1 pt-1 tabular-nums text-slate-600 outline-none dark:text-slate-300"
                        >
                          <span className="shrink-0 whitespace-nowrap">{t("result.hour_heading", { hour: String(hour).padStart(2, "0") })}</span>
                          <span aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </h2>
                      ) : null}
                      <TripCard
                        trip={trip}
                        country={country}
                        index={index}
                        isSaved={savedIds.has(trip.id)}
                        onSave={() => onSave(trip)}
                        onOpenLegend={onOpenLegend}
                        formatPrice={formatPrice}
                        fare={fareOnRows ? formatFare(trip, formatRowPrice ?? formatPrice) : null}
                        tags={{
                          next: trip.id === nextId,
                          fastest: fastest !== undefined && trip.durationMinutes === fastest,
                          cheapest: cheapest !== undefined && hasDisplayableFare(trip) && trip.price === cheapest,
                        }}
                        minutesUntil={liveReference !== null && dep !== null ? dep - liveReference : undefined}
                        past={isPast(trip)}
                        withExit={withExit}
                        {...extras}
                      />
                    </Fragment>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {!error && results.length > 0 && afterResults ? (
          <aside className="min-w-0 space-y-3 lg:sticky lg:top-36">{afterResults}</aside>
        ) : null}
      </section>
    </>
  );
}

// --- End of ResultList.tsx ---
