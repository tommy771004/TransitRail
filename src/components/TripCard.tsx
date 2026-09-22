// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The one result card every market renders — tags, duration and fare on the
// first line, departure and arrival around a proportional route band, then the journey's
// composition. Tapping the card opens the trip sheet; only the next departure carries
// an action row.

import { AlertTriangle, Bookmark, Check, ChevronRight, ListTree, Map as MapIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { Country, TransitResult } from "../types";
import { countryThemes } from "../data/countries";
import { triggerHaptic } from "../utils/haptics";
import { stationLabel, stationListLabel } from "../utils/stationLabel";
import { formatPlatform } from "./TransitIcon";
import { formatDuration, tripCardMotion } from "./ResultShell";
import { RouteBand, bandLegs, tightestWait } from "./RouteBand";
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
  /** Minutes from the searched time to departure; undefined when no time was searched. */
  minutesUntil?: number;
  /** A departed trip stays readable but steps back. */
  past?: boolean;
  /** The market's primary action (seat preference); rendered on the next card and in the sheet. */
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
  const [viewMode, setViewMode] = useState<"timeline" | "map">("timeline");
  const panelId = `${useId()}-sheet`;
  const theme = countryThemes[country] || countryThemes.japan;

  const legs = bandLegs(trip);
  // The label answers "how tight is this journey", so the tightest change wins.
  const wait = legs.length > 1 ? tightestWait(legs) : undefined;
  const pressure = legs.length > 1 ? transferPressure(wait, t) : undefined;
  const duration = formatDuration(t, trip.durationMinutes);
  const firstPlatform = formatPlatform(trip.platform || trip.legs?.[0]?.platform, t);
  const lastLegPlatform = trip.legs && trip.legs.length > 1 ? formatPlatform(trip.legs[trip.legs.length - 1]?.platform, t) : "";

  // Under the departure time only what changes per departure: the platform,
  // then the live status. The station itself is already in the header.
  const liveNote = trip.realtime
    ? typeof trip.delayMinutes === "number"
      ? trip.delayMinutes > 0
        ? { text: `+${trip.delayMinutes} ${t("result.delay_min")}`, className: "text-rose-600 dark:text-rose-400" }
        : { text: t("result.on_time"), className: "text-emerald-600 dark:text-emerald-400" }
      : { text: t("metro.realtime"), className: "text-emerald-600 dark:text-emerald-400" }
    : null;

  // "Direct · 8 stops", or "Change at Piccadilly Circus to Bakerloo · 3 min wait".
  const transferStations = trip.transferStations && trip.transferStations.length > 0
    ? trip.transferStations
    : trip.legs && trip.legs.length > 1 ? trip.legs.slice(0, -1).map((leg) => leg.destination) : [];
  const composition = trip.direct
    ? [
        t("result.direct"),
        trip.stops.length > 0 ? `${trip.stops.length} ${t("result.stops")}` : null,
        headsign ? t("metro.towards", { destination: stationLabel(t, headsign, trip.country) }) : null,
      ].filter(Boolean).join(" · ")
    : transferStations.length === 1 && trip.legs && trip.legs.length === 2
      ? [
          t("result.transfer_to", { station: stationLabel(t, transferStations[0], trip.country), line: trip.legs[1].lineName }),
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

  const countdown = minutesUntil === undefined
    ? null
    : minutesUntil < 0
      ? t("result.departed")
      : minutesUntil === 0
        ? t("result.departs_now")
        : t("result.departs_in", { count: minutesUntil });

  const openSheet = (mode: "timeline" | "map") => {
    triggerHaptic("light");
    setViewMode(mode);
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
        onClick={() => openSheet("timeline")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="m3-state block w-full min-w-0 px-4 pb-3 pt-3 text-left text-slate-900 dark:text-white"
      >
        {/* Line 1: badges (may truncate) · duration and fare (never wrap) · chevron. */}
        <div className="flex min-h-6 min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden">
            {tags.next && badge(t("result.next_departure_tag"), `${theme.buttonBg} text-white`)}
            {tags.fastest && badge(t("result.fastest_tag"), "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300")}
            {tags.cheapest && badge(t("result.cheapest_tag"), "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300")}
          </div>
          <div className="ml-auto flex shrink-0 items-baseline gap-2 whitespace-nowrap">
            {duration && <span className="m3-label-medium text-slate-500 dark:text-slate-400">{duration}</span>}
            {fare && <span className="m3-title-medium font-bold tabular-nums text-slate-900 dark:text-white" data-trip-fare-row>{fare}</span>}
          </div>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </div>

        {/* Line 2: the times never shrink; the band takes whatever is left. */}
        <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-3">
          <div className="shrink-0">
            <p className="m3-headline-small whitespace-nowrap font-mono font-bold tabular-nums leading-none text-slate-950 dark:text-white">{trip.departureTime}</p>
            <p className="m3-label-small mt-1.5 flex h-4 gap-1.5 whitespace-nowrap leading-4 text-slate-500 dark:text-slate-400">
              {firstPlatform ? <span>{firstPlatform}</span> : null}
              {liveNote ? <span className={liveNote.className}>{liveNote.text}</span> : null}
            </p>
          </div>
          {lineNames ? <span className="sr-only">{lineNames}</span> : null}
          <RouteBand trip={trip} className="pb-[9px]" />
          <div className="shrink-0 text-right">
            <p className="m3-headline-small whitespace-nowrap font-mono font-bold tabular-nums leading-none text-slate-950 dark:text-white">{trip.arrivalTime || "--:--"}</p>
            <p className="m3-label-small mt-1.5 h-4 whitespace-nowrap leading-4 text-slate-500 dark:text-slate-400">{lastLegPlatform}</p>
          </div>
        </div>

        {/* Line 3: composition may wrap to two lines; the pressure label never does. */}
        <div className="m3-body-small mt-2 flex min-w-0 items-start justify-between gap-2 text-slate-500 dark:text-slate-400">
          <span className="line-clamp-2 min-w-0">{composition}</span>
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

      {tags.next ? (
        <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="m3-label-large min-w-0 truncate text-slate-700 dark:text-slate-200">{countdown}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {saveButton}
            <button
              type="button"
              onClick={() => openSheet("timeline")}
              className="m3-icon-button m3-state bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              aria-label={t("result.stops_action")}
              title={t("result.stops_action")}
            >
              <ListTree aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openSheet("map")}
              className="m3-icon-button m3-state bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              aria-label={t("result.map_action")}
              title={t("result.map_action")}
            >
              <MapIcon aria-hidden="true" className="h-4 w-4" />
            </button>
            {primaryAction}
          </div>
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
        initialViewMode={viewMode}
        title={trip.service}
        sheetActions={<>{primaryAction}{saveButton}</>}
      />
    </motion.article>
  );
}

// --- End of TripCard.tsx ---
