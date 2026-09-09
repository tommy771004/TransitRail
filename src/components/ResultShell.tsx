// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Shared shell pieces for the country result views — header, list-state
// blocks (weather / error / empty), trip-card chrome, timeline bar, and save button.
// The state blocks are render helpers (not components) so they stay direct children
// of each view's AnimatePresence and keep the exact same enter/exit semantics.

import { ArrowRight, Bookmark, Check, Compass, Edit2 } from "lucide-react";
import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { motion, type MotionProps } from "motion/react";
import type { Country, CoverageGap, NoResultReason } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";
import i18n from "../i18n";

/**
 * One journey duration, written the same way in every market.
 *
 * Seven spellings used to reach the same page — `2h 24m` from here, `42 min`
 * from the live-rail view's own label, `120 分` from another, `173 分鐘` from a
 * third — because each result view formatted its own. The unit words are
 * translated; the shape is not, so a passenger comparing Tokyo with Zürich
 * compares like with like.
 */
export const formatDuration = (t: TFunction, minutes?: number) => {
  if (minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hourLabel = t("result.hour_label", { defaultValue: "h" });
  const minLabel = t("result.min_label", { defaultValue: "min" });
  return hours > 0 ? `${hours}${hourLabel} ${mins}${minLabel}` : `${mins}${minLabel}`;
};

const defaultHeaderSectionClass =
  "border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900";

interface ResultShellHeaderProps {
  country: Country;
  origin: string;
  destination: string;
  /** The line rendered under the origin → destination row. */
  meta: ReactNode;
  onModify: () => void;
  onOpenLegend?: (highlight?: string) => void;
  sectionClassName?: string;
}

export function ResultShellHeader({
  country,
  origin,
  destination,
  meta,
  onModify,
  onOpenLegend,
  sectionClassName,
}: ResultShellHeaderProps) {
  const { t } = useTranslation();

  return (
    <section className={sectionClassName || defaultHeaderSectionClass}>
      <div className="mx-auto flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="m3-title-large flex min-w-0 items-center gap-2 text-slate-900 dark:text-white">
            <span className="min-w-0 break-words">{stationLabel(t, origin, country)}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="min-w-0 break-words">{stationLabel(t, destination, country)}</span>
          </h1>
          {meta}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {onOpenLegend && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenLegend();
              }}
              className="m3-icon-button m3-icon-button-large m3-state bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title={t("result.transit_legend", { defaultValue: "Transit legend" })}
              aria-label={t("result.transit_legend", { defaultValue: "Transit legend" })}
            >
              <Compass aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onModify();
            }}
            className="m3-button m3-button-icon-leading m3-state shrink-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Edit2 aria-hidden="true" className="h-[18px] w-[18px]" />
            {t("result.modify")}
          </button>
        </div>
      </div>
    </section>
  );
}

export function renderWeatherBlock(destination: string, date: string, country: Country) {
  return (
    <motion.div
      key="weather"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <WeatherWidget destination={destination} date={date} country={country} />
    </motion.div>
  );
}

/**
 * A search that returned nothing because no official source covers it.
 *
 * Distinct from the red error block on purpose: nothing failed. Titling this
 * "Unable to fetch" invited a retry that can never succeed, and implied the
 * data exists and we merely could not reach it — when the honest statement is
 * that TransitRail has no verified timetable for this query.
 */
export function renderNoVerifiedDataBlock(message: string, sourceUrl?: string, title?: string) {
  return (
    <motion.div
      key="no-verified-data"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="m3-card bg-slate-100 p-4 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      <p className="m3-title-medium">
        {title || i18n.t("result.no_verified_timetable", { defaultValue: "No verified timetable available." })}
      </p>
      <p className="m3-body-medium mt-1">{message}</p>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="m3-label-large mt-3 inline-block underline underline-offset-2"
        >
          {i18n.t("stations.official_source", { defaultValue: "Open the operator timetable" })}
        </a>
      )}
    </motion.div>
  );
}

/**
 * The single "we have nothing for you" renderer.
 *
 * Three different misses used to share one red "Unable to fetch" panel: a
 * station outside the catalog, a route no official source covers, and an actual
 * fetch failure. Only the third is an error, and only the third is worth
 * retrying — so the choice between them is made once, here, rather than by a
 * ternary repeated in each of the four result views.
 */
export function renderMissBlock(options: {
  message: string;
  reason?: NoResultReason;
  coverageGap?: CoverageGap;
  country: Country;
  sourceUrl?: string;
  errorTitle: string;
  onModify?: () => void;
  onRetry?: () => void;
}) {
  const retryable = !options.coverageGap && !options.reason;
  const title = options.reason === "future_date_unavailable"
    ? i18n.t("result.date_unavailable_title")
    : options.reason === "no_service" ? i18n.t("result.no_matching_departures") : undefined;
  const block = options.coverageGap
    ? renderCoverageBlock(options.coverageGap, options.country)
    : options.reason
      ? renderNoVerifiedDataBlock(options.message, options.sourceUrl, title)
      : renderErrorBlock(options.errorTitle, options.message, options.sourceUrl);
  return (
    <motion.div key="miss" initial={false} className="space-y-3">
      {block}
      <div className="flex flex-wrap gap-2">
        {retryable && options.onRetry && (
          <button type="button" onClick={options.onRetry} className="m3-button m3-state bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            {i18n.t("result.retry")}
          </button>
        )}
        {options.onModify && (
          <button type="button" onClick={options.onModify} className="m3-button m3-state border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {i18n.t("result.change_search")}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function renderErrorBlock(title: string, message: string, sourceUrl?: string) {
  return (
    <motion.div
      key="error"
      role="alert"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="m3-card bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300"
    >
      <p className="m3-title-medium">{title}</p>
      <p className="m3-body-medium mt-1">{message}</p>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="m3-label-large mt-3 inline-block underline underline-offset-2"
        >
          {i18n.t("stations.official_source", { defaultValue: "Open the operator timetable" })}
        </a>
      )}
    </motion.div>
  );
}

/**
 * A station the picker offers but no timetable covers.
 *
 * Deliberately not the red error block: nothing failed to load, the route was
 * never in the catalog. Painting it as a fetch error told users to retry a
 * search that can never succeed.
 */
export function renderCoverageBlock(gap: CoverageGap, country: Country) {
  return <CoverageBlock gap={gap} country={country} />;
}

function CoverageBlock({ gap, country }: { gap: CoverageGap; country: Country }) {
  const { t } = useTranslation();
  const uncovered = gap.uncovered.map((name) => stationLabel(t, name, country));
  const suggestions = gap.suggestions.slice(0, 8).map((name) => stationLabel(t, name, country));

  return (
    <motion.div
      key="coverage"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="m3-card bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <p className="m3-title-medium">
        {t("result.not_covered_title", {
          count: uncovered.length,
          defaultValue_one: "This station has no timetable yet",
          defaultValue_other: "These stations have no timetable yet",
        })}
      </p>
      <p className="m3-body-medium mt-1">
        {t("result.not_covered_body", {
          count: uncovered.length,
          stations: uncovered.join(t("result.station_separator", "、")),
          defaultValue_one:
            "{{stations}} appears on the network map, but TransitRail has no timetable data for it yet.",
          defaultValue_other:
            "{{stations}} appear on the network map, but TransitRail has no timetable data for them yet.",
        })}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="m3-label-large opacity-80">
            {t("result.not_covered_suggestions", "Stations with timetable data:")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((name) => (
              <span
                key={name}
                className="m3-chip m3-label-medium min-h-8 border border-amber-300/50 bg-amber-100/60 px-3 dark:border-amber-700/50 dark:bg-amber-900/40"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function renderEmptyBlock(title: string, hint: string) {
  return (
    <motion.div
      key="empty"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="m3-card m3-card-large m3-elevation-1 bg-white p-6 text-center dark:bg-slate-900"
    >
      <p className="m3-title-medium text-slate-900 dark:text-white">{title}</p>
      <p className="m3-body-medium mt-1 text-slate-500 dark:text-slate-400">{hint}</p>
    </motion.div>
  );
}

export const tripCardClass =
  "m3-card m3-card-large m3-elevation-1 overflow-hidden bg-white dark:bg-slate-900";

export function tripCardMotion(index: number, withExit = false): MotionProps {
  return {
    layout: true,
    initial: false,
    ...(withExit ? { exit: { opacity: 0, y: -12 } } : {}),
    // M3 "emphasized" easing — cubic-bezier(0.2, 0, 0, 1) — matches --ease-m3-emphasized.
    transition: { duration: 0.3, ease: [0.2, 0, 0, 1], delay: index * 0.03 },
  };
}

/** The horizontal departure→arrival bar with end dots and the amber transfer dot. */
export function TimelineBar({ color, direct }: { color: string; direct: boolean }) {
  return (
    <div className="relative flex w-full items-center justify-between px-1">
      <div className="absolute left-1 right-1 h-[3px] rounded-full bg-slate-100 dark:bg-slate-800" />
      <div
        className="absolute left-1 right-1 h-[3px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="z-10 h-3 w-3 rounded-full border-[3px] bg-white dark:bg-slate-950"
        style={{ borderColor: color }}
      />
      {!direct && (
        <span className="z-10 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-950" />
      )}
      <span
        className="z-10 h-3 w-3 rounded-full border-[3px] bg-white dark:bg-slate-950"
        style={{ borderColor: color }}
      />
    </div>
  );
}

interface SaveTripButtonProps {
  isSaved: boolean;
  onSave: () => void;
  /** true renders icon + text (Metro/LiveRail); false renders the square icon-only button. */
  labeled?: boolean;
  /** Label for the unsaved state; defaults to t("result.save_trip"). */
  saveLabel?: string;
}

export function SaveTripButton({ isSaved, onSave, labeled = false, saveLabel }: SaveTripButtonProps) {
  const { t } = useTranslation();
  const label = isSaved ? t("result.saved") : saveLabel ?? t("result.save_trip");
  const stateClass = isSaved
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white";

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic(isSaved ? "light" : "success");
        onSave();
      }}
      aria-pressed={isSaved}
      className={`m3-state ${
        labeled ? "m3-button m3-button-icon-leading" : "m3-icon-button m3-icon-button-large m3-shape-full"
      } ${stateClass}`}
      aria-label={label}
    >
      {isSaved ? <Check aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
      {labeled ? label : null}
    </button>
  );
}

// --- End of ResultShell.tsx ---
