// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Shared shell pieces for the country result views — header, list-state
// blocks (weather / error / empty), trip-card chrome, timeline bar, and save button.
// The state blocks are render helpers (not components) so they stay direct children
// of each view's AnimatePresence and keep the exact same enter/exit semantics.

import { Bookmark, Check, Compass, Edit2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, type MotionProps } from "motion/react";
import type { Country } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { WeatherWidget } from "./WeatherWidget";
import { stationLabel } from "../utils/stationLabel";

export const formatDuration = (minutes?: number) => {
  if (minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const defaultHeaderSectionClass =
  "border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 py-4 dark:border-slate-700/50 dark:bg-slate-900/95";

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
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            <span className="truncate">{stationLabel(t, origin, country)}</span>
            <span className="shrink-0 text-slate-400">&rarr;</span>
            <span className="truncate">{stationLabel(t, destination, country)}</span>
          </div>
          {meta}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onOpenLegend && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenLegend();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              title="View Transit Legend"
              aria-label="Transit Legend"
            >
              <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onModify();
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-3.5 w-3.5" />
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
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <WeatherWidget destination={destination} date={date} country={country} />
    </motion.div>
  );
}

export function renderErrorBlock(title: string, message: string) {
  return (
    <motion.div
      key="error"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </motion.div>
  );
}

export function renderEmptyBlock(title: string, hint: string) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </motion.div>
  );
}

export const tripCardClass =
  "overflow-hidden rounded-3xl border border-slate-100 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300";

export function tripCardMotion(index: number, withExit = false): MotionProps {
  return {
    layout: true,
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    ...(withExit ? { exit: { opacity: 0, y: -12 } } : {}),
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 },
  };
}

/** The horizontal departure→arrival bar with end dots and the amber transfer dot. */
export function TimelineBar({ color, direct }: { color: string; direct: boolean }) {
  return (
    <div className="relative flex w-full items-center justify-between px-1">
      <div className="absolute left-1 right-1 h-[3px] rounded-full bg-slate-100 dark:bg-slate-800" />
      <div
        className="absolute left-1 right-1 h-[3px] rounded-full"
        style={{ background: `linear-gradient(to right, ${color}, ${color}ee)` }}
      />
      <span
        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs"
        style={{ borderColor: color }}
      />
      {!direct && (
        <span className="z-10 h-2 w-2 rounded-full bg-amber-400 ring-[2px] ring-white dark:ring-slate-950 shadow-xs" />
      )}
      <span
        className="z-10 h-3 w-3 rounded-full bg-white dark:bg-slate-950 ring-[2.5px] shadow-xs"
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
    ? "border-emerald-200 bg-emerald-50/80 text-emerald-600 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400"
    : "border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 shadow-2xs";

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic(isSaved ? "light" : "success");
        onSave();
      }}
      className={`flex h-9 items-center rounded-2xl border transition-all duration-200 ${
        labeled ? "gap-1.5 px-4 text-xs font-black" : "w-9 justify-center"
      } ${stateClass}`}
      aria-label={label}
    >
      {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {labeled ? label : null}
    </button>
  );
}

// --- End of ResultShell.tsx ---
