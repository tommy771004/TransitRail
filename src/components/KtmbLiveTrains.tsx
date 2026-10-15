// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Every KTMB train reporting its position on the official data.gov.my
// GTFS Realtime feed — which train, where it runs, and where it was last seen.

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveTrain, LiveTrainsResponse } from "../server/malaysiaLive";
import { formatRelativeTime } from "../utils/relativeTime";
import { stationLabel } from "../utils/stationLabel";
import { livePositionText } from "../utils/livePosition";
import { LineBadge } from "./LineBadge";
import { LiveSheet, LiveSheetStatus } from "./LiveSheet";

const REFRESH_MS = 30_000;
const BADGE_COLOR = "var(--accent)";

function LiveTrainRow({ train, now }: { train: LiveTrain; now: Date }) {
  const { t, i18n } = useTranslation();
  const place = (name: string) => stationLabel(t, name, "malaysia");
  return (
    <li className="m3-card border border-slate-200 px-4 py-3 dark:border-slate-800" data-live-train={train.tripId}>
      <div className="m3-label-large flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
        {train.service ? <LineBadge code={train.service} color={BADGE_COLOR} /> : null}
        <span className="shrink-0 font-mono font-semibold text-slate-900 dark:text-white">{train.label || train.tripId}</span>
        {train.to ? <span className="min-w-0 truncate">{t("metro.towards", { destination: place(train.to) })}</span> : null}
        <span className="ml-auto shrink-0 whitespace-nowrap text-slate-500 dark:text-slate-400">
          {formatRelativeTime(train.reportedAt, i18n.language, now)}
        </span>
      </div>
      <p className="m3-body-medium mt-1.5 flex min-w-0 items-start gap-1.5 font-semibold text-slate-900 dark:text-white">
        <span aria-hidden="true" className="mt-[0.5lh] h-2 w-2 shrink-0 -translate-y-1/2 rounded-full bg-accent" />
        {livePositionText(t, train, "malaysia")}
      </p>
      {train.from && train.to ? (
        <p className="m3-body-small mt-0.5 text-slate-500 dark:text-slate-400">{place(train.from)} → {place(train.to)}</p>
      ) : null}
    </li>
  );
}

/** The list itself, without fetching, so a pinned answer renders the same everywhere. */
export function KtmbLiveTrainsView({ trains, now }: { trains: readonly LiveTrain[]; now: Date }) {
  const { t } = useTranslation();
  if (trains.length === 0) return <LiveSheetStatus>{t("ktmb.none")}</LiveSheetStatus>;
  return (
    <ul className="flex flex-col gap-2">
      {trains.map((train) => <LiveTrainRow key={train.tripId} train={train} now={now} />)}
    </ul>
  );
}

/** Refreshes every 30 seconds while visible; a failed refresh keeps the last list. */
export function KtmbLiveTrains({ onClose, now = () => new Date() }: { onClose: () => void; now?: () => Date }) {
  const { t } = useTranslation();
  const [live, setLive] = useState<LiveTrainsResponse>();
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState(now);
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/transit/malaysia/live-trains")
        .then((response) => (response.ok ? response.json() as Promise<LiveTrainsResponse> : Promise.reject(new Error(String(response.status)))))
        .then((next) => {
          if (!active || !Array.isArray(next.trains)) return;
          setLive(next);
          setFailed(false);
          setClock(nowRef.current());
        })
        .catch(() => { if (active) setFailed(true); });
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <LiveSheet
      country="malaysia"
      titleId="ktmb-live-title"
      title={t("ktmb.title")}
      updatedAt={live?.checkedAt}
      timeZone="Asia/Kuala_Lumpur"
      onClose={onClose}
      footer={<p className="m3-body-small text-slate-500 dark:text-slate-400">{t("ktmb.source")}</p>}
    >
      {live ? (
        <KtmbLiveTrainsView trains={live.trains} now={clock} />
      ) : failed ? (
        <LiveSheetStatus>{t("ktmb.none")}</LiveSheetStatus>
      ) : (
        <LiveSheetStatus>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t("board.loading")}
        </LiveSheetStatus>
      )}
    </LiveSheet>
  );
}

// --- End of KtmbLiveTrains.tsx ---
