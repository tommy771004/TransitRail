// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The one result card every market renders — a status row (next badge,
// countdown, platform, live status, fare), departure and arrival around a route band
// captioned with the train, then the duration and the journey's composition. Tapping the card opens the
// trip sheet, which carries save, map and the market's primary action.

import { AlertTriangle, Bookmark, Check } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { Country, TransitResult } from "../types";
import { countryThemes } from "../data/countries";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel, stationListLabel } from "../utils/stationLabel";
import { formatPlatform } from "./TransitIcon";
import { displayClock, formatDuration, tripCardMotion } from "./ResultShell";
import { RouteBand, bandLegs, rideLegs, tightestWait } from "./RouteBand";
import { TripDetails } from "./TripDetails";
import { transferPressure } from "../utils/journeyLegs";

export interface TripCardProps {
  trip: TransitResult;
  country: Country;
  index: number;
  isSaved: boolean;
  onSave: () => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  /** Fare text for this row; null hides it (every row shares one fare, or there is none). */
  fare: string | null;
  /** Which of the list's badges this trip earns. */
  tags?: { next?: boolean; fastest?: boolean; cheapest?: boolean };
  /** Minutes from the market's wall clock to departure; undefined unless the searched day is today there. */
  minutesUntil?: number;
  /** A departed trip stays readable but steps back. */
  past?: boolean;
  /** The market's primary action (seat preference); a slim row on the next card, and in the sheet. */
  primaryAction?: ReactNode;
  /** Market extras (amenities, seat class) at the end of the composition line. */
  extraMeta?: ReactNode;
  saveLabel?: string;
  showFullStopSequence?: boolean;
  /** Metro: the service's headsign, shown as "Towards …". */
  headsign?: string;
  withExit?: boolean;
}

export function TripCard({
  trip,
  country,
  index,
  isSaved,
  onSave,
  onOpenLegend,
  formatPrice,
  fare,
  tags = {},
  minutesUntil,
  past = false,
  primaryAction,
  extraMeta,
  saveLabel,
  showFullStopSequence = false,
  headsign,
  withExit = true,
}: TripCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = `${useId()}-sheet`;
  const theme = countryThemes[country] || countryThemes.japan;

  const legs = bandLegs(trip);
  // The label answers "how tight is this journey", so the tightest change wins.
  const wait = legs.length > 1 ? tightestWait(legs) : undefined;
  const pressure = legs.length > 1 ? transferPressure(wait, t) : undefined;
  const duration = formatDuration(t, trip.durationMinutes);
  const firstPlatform = formatPlatform(trip.platform || trip.legs?.[0]?.platform, t);
  const lastLegPlatform = trip.legs && trip.legs.length > 1 ? formatPlatform(trip.legs[trip.legs.length - 1]?.platform, t) : "";

  // The status row carries only what changes per departure: the platform, then
  // the live status. The station itself is already in the header. A realtime
  // flag without a provider status is neutral: green would read as "on time".
  const delayed = Boolean(trip.realtime && typeof trip.delayMinutes === "number" && trip.delayMinutes > 0);
  const liveNote = trip.realtime
    ? typeof trip.delayMinutes === "number"
      ? trip.delayMinutes > 0
        ? { text: `+${trip.delayMinutes} ${t("result.delay_min")}`, className: "font-semibold text-rose-700 dark:text-rose-300" }
        : { text: t("result.on_time"), className: "text-emerald-700 dark:text-emerald-400" }
      : { text: t("metro.realtime"), className: "text-slate-600 dark:text-slate-300" }
    : null;
  const platformText = [firstPlatform, lastLegPlatform].filter(Boolean).join(" → ");

  // "Direct · 8 stops", or "Change at Piccadilly Circus to Bakerloo · 3 min wait".
  // Changes are between rides: a walk between two rides is part of one change,
  // so a journey with walks names the stations where each ride ends.
  const rides = rideLegs(trip);
  const walks = Boolean(rides && trip.legs && rides.length < trip.legs.length);
  const transferStations = (walks && rides
    ? rides.slice(0, -1).map((leg) => leg.destination)
    : trip.transferStations && trip.transferStations.length > 0
      ? trip.transferStations
      : rides ? rides.slice(0, -1).map((leg) => leg.destination) : []
  ).filter((station, index, list) => index === 0 || station !== list[index - 1]);
  const composition = trip.direct
    ? [
        t("result.direct"),
        trip.stops.length > 0 ? `${trip.stops.length} ${t("result.stops")}` : null,
        headsign ? t("metro.towards", { destination: stationLabel(t, headsign, trip.country) }) : null,
      ].filter(Boolean).join(" · ")
    : transferStations.length === 1 && rides && rides.length === 2
      ? [
          t("result.transfer_to", { station: stationLabel(t, transferStations[0], trip.country), line: rides[1].lineName }),
          wait !== undefined ? t("result.transfer_wait", { count: wait }) : null,
        ].filter(Boolean).join(" · ")
      : [
          // Three or more rides: name every line, since the band hides short ones.
          legs.map((leg) => leg.name).filter(Boolean).join(" → ") || null,
          transferStations.length > 0
            ? t("result.transfer_at", { station: stationListLabel(t, transferStations, trip.country) })
            : t("result.transfer"),
        ].filter(Boolean).join(" · ");
  // The band is decorative; this is what assistive technology hears for it.
  const lineNames = legs.map((leg) => leg.name).filter(Boolean).join(" → ");

  // Every upcoming departure within the hour counts down, not only the next one.
  // A delayed train's countdown would run from a time it will not keep, so the
  // delay takes its place; no expected time is computed.
  const countdown = minutesUntil === undefined || delayed
    ? null
    : minutesUntil < 0
      ? t("result.departed")
      : minutesUntil === 0
        ? t("result.departs_now")
        : tags.next || minutesUntil <= 60
          ? t("result.departs_in", { count: minutesUntil })
          : null;
  const countdownClass = tags.next && minutesUntil !== undefined && minutesUntil >= 0
    ? "m3-label-large font-semibold text-slate-900 dark:text-white"
    : "m3-label-medium text-slate-600 dark:text-slate-300";
  const hasStatus = Boolean(tags.next || tags.cheapest || countdown || platformText || liveNote || fare);

  const openSheet = () => {
    triggerHaptic("light");
    setOpen(true);
  };

  const saveButton = (
    <button
      type="button"
      onClick={() => {
        triggerHaptic(isSaved ? "light" : "success");
        onSave();
      }}
      aria-pressed={isSaved}
      aria-label={isSaved ? t("result.saved") : saveLabel ?? t("result.save_trip")}
      title={isSaved ? t("result.saved") : saveLabel ?? t("result.save_trip")}
      className={`m3-icon-button m3-state ${isSaved
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
    >
      {isSaved ? <Check aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
    </button>
  );

  const departureClock = displayClock(trip.departureTime);
  const arrivalClock = displayClock(trip.arrivalTime, trip.departureTime, trip.durationMinutes);
  const clock = (value: ReturnType<typeof displayClock>) => value ? (
    <>
      {value.text}
      {value.dayOffset > 0 ? (
        <>
          <sup className="m3-label-small ml-0.5 font-sans font-medium text-slate-500 dark:text-slate-400" aria-hidden="true">+{value.dayOffset}</sup>
          <span className="sr-only">{t("result.next_day")}</span>
        </>
      ) : null}
    </>
  ) : "--:--";

  const badge = (label: string, className: string) => (
    <span className={`m3-label-small m3-shape-xs shrink-0 whitespace-nowrap px-1.5 py-0.5 ${className}`}>{label}</span>
  );

  return (
    <motion.article
      {...tripCardMotion(index, withExit)}
      data-trip-card
      className={`m3-card m3-card-large m3-elevation-1 min-w-0 overflow-hidden border-2 bg-white dark:bg-slate-900 ${
        tags.next ? theme.borderActive : "border-transparent"
      } ${past ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="m3-state m3-focus-inset block w-full min-w-0 scroll-mt-10 px-4 pb-3 pt-3 text-left text-slate-900 dark:text-white"
      >
        {/* Line 1, the status row: every item is shrink-0 and nowrap, so the row
            wraps instead of clipping; it is omitted when there is nothing to say. */}
        {hasStatus ? (
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {tags.next && badge(t("result.next_departure_tag"), "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")}
            {countdown ? <span className={`shrink-0 whitespace-nowrap tabular-nums ${countdownClass}`}>{countdown}</span> : null}
            {platformText || liveNote ? (
              <span className="m3-label-medium flex shrink-0 gap-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                {platformText ? <span>{platformText}</span> : null}
                {liveNote ? <span className={liveNote.className}>{liveNote.text}</span> : null}
              </span>
            ) : null}
            {fare || tags.cheapest ? (
              <div className="ml-auto flex shrink-0 items-baseline gap-2 whitespace-nowrap">
                {tags.cheapest && badge(t("result.cheapest_tag"), "self-center bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300")}
                {fare && <span className="m3-title-medium font-bold tabular-nums text-slate-900 dark:text-white" data-trip-fare-row>{fare}</span>}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Line 2: the times never shrink; the band takes whatever is left. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-3">
          <p className="m3-headline-small shrink-0 whitespace-nowrap font-mono font-bold tabular-nums leading-none text-slate-950 dark:text-white">{clock(departureClock)}</p>
          {lineNames ? <span className="sr-only">{lineNames}</span> : null}
          <RouteBand trip={trip} caption={lineNames || undefined} className="pb-[9px]" />
          <p className="m3-headline-small shrink-0 whitespace-nowrap text-right font-mono font-bold tabular-nums leading-none text-slate-950 dark:text-white">{clock(arrivalClock)}</p>
        </div>

        {/* Line 3: duration (never broken), then the composition, which may wrap to
            two lines; the pressure label never wraps. Badges sit on the value they describe. */}
        <div className="m3-body-small mt-2 flex min-w-0 items-start justify-between gap-2 text-slate-500 dark:text-slate-400">
          <span className="line-clamp-2 min-w-0">
            {tags.fastest && <>{badge(t("result.fastest_tag"), "mr-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300")}</>}
            {duration ? (
              <span className={`whitespace-nowrap font-medium ${tags.fastest ? "text-blue-700 dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`}>{duration}</span>
            ) : null}
            {duration && composition ? " · " : null}
            {composition}
          </span>
          {pressure ? (
            <span className={`shrink-0 whitespace-nowrap font-medium ${pressure.className}`}>{pressure.label}</span>
          ) : extraMeta ? (
            <span className="flex shrink-0 items-center gap-1.5">{extraMeta}</span>
          ) : null}
        </div>

        {trip.warning ? (
          <p className="m3-body-small mt-2 flex min-w-0 items-start gap-1.5 text-amber-800 dark:text-amber-400">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2 min-w-0">{trip.warning}</span>
          </p>
        ) : null}
      </button>

      {tags.next && primaryAction ? (
        <div className="flex min-w-0 justify-end border-t border-slate-100 px-4 py-2 dark:border-slate-800">
          {primaryAction}
        </div>
      ) : null}

      <TripDetails
        trip={trip}
        onOpenLegend={onOpenLegend}
        formatPrice={formatPrice}
        showFullStopSequence={showFullStopSequence}
        open={open}
        onOpenChange={setOpen}
        panelId={panelId}
        title={trip.service}
        sheetActions={<>{primaryAction}{saveButton}</>}
      />
    </motion.article>
  );
}

// --- End of TripCard.tsx ---
