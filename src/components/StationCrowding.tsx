// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: One line under London results saying how busy the origin station is
// now, from TfL's live crowding feed, and when it is usually quiet if it is not.

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Country } from "../types";
import type { StationCrowding as Crowding } from "../server/tflCrowding";
import { stationLabel } from "../utils/stationLabel";

const REFRESH_MS = 5 * 60_000;

const LEVEL_DOT = {
  quiet: "bg-emerald-600 dark:bg-emerald-400",
  busy: "bg-amber-500 dark:bg-amber-400",
  very_busy: "bg-rose-600 dark:bg-rose-400",
} as const;

export function StationCrowdingView({ crowding, station, country }: { crowding: Crowding; station: string; country: Country }) {
  const { t } = useTranslation();
  return (
    <p className="m3-body-small flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 dark:text-slate-300" data-station-crowding={crowding.level}>
      <Users aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[crowding.level]}`} />
      <span>
        {stationLabel(t, station, country)}{" "}
        <span className="font-semibold text-slate-900 dark:text-white">{t(`crowding.${crowding.level}`)}</span>
      </span>
      {crowding.usuallyQuietFrom ? <span>· {t("crowding.quiet_from", { time: crowding.usuallyQuietFrom })}</span> : null}
      <span className="text-slate-500 dark:text-slate-400">· {t("crowding.source")}</span>
    </p>
  );
}

/** Renders nothing until TfL has a reading, and keeps the last one if a refresh fails. */
export function StationCrowding({ station, country }: { station: string; country: Country }) {
  const [crowding, setCrowding] = useState<Crowding | null>(null);
  useEffect(() => {
    let active = true;
    setCrowding(null);
    const load = () => {
      fetch(`/api/transit/london/crowding?${new URLSearchParams({ station })}`)
        .then((response) => (response.ok ? response.json() as Promise<{ crowding?: Crowding | null }> : Promise.reject(new Error(String(response.status)))))
        .then((body) => { if (active && body.crowding) setCrowding(body.crowding); })
        .catch(() => { /* Supplementary: the last reading, or nothing, stays. */ });
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [station]);
  if (!crowding) return null;
  return (
    <div className="mx-auto max-w-md px-4 pt-3 lg:max-w-5xl">
      <StationCrowdingView crowding={crowding} station={station} country={country} />
    </div>
  );
}

// --- End of StationCrowding.tsx ---
