// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: A Hong Kong station's live departures screen from MTR Next Train —
// every line through the station, each platform and terminus with its next trains.

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { MtrBoardDeparture, MtrBoardGroup, MtrStationBoard } from "../server/hongKongMtr";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";
import { stationLabel } from "../utils/stationLabel";
import { LineBadge } from "./LineBadge";
import { SplitFlap } from "./SplitFlap";

const REFRESH_MS = 30_000;

/**
 * Whole minutes until each departure. A train that left more than a minute
 * ago has gone from the screen; one leaving now reads as zero.
 */
export function boardMinutes(departures: MtrBoardDeparture[], now: Date): Array<MtrBoardDeparture & { minutes: number }> {
  return departures.flatMap((departure) => {
    const diff = Date.parse(departure.at) - now.getTime();
    if (!Number.isFinite(diff) || diff < -60_000) return [];
    return [{ ...departure, minutes: Math.max(0, Math.floor(diff / 60_000)) }];
  });
}

function hongKongClock(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function BoardGroup({ group, color, now }: { group: MtrBoardGroup; color: string; now: Date }) {
  const { t } = useTranslation();
  const [next, ...later] = boardMinutes(group.departures, now);
  if (!next) return null;
  return (
    <section className="m3-card overflow-hidden border border-slate-200 dark:border-slate-800" data-board-group>
      <div className="border-t-4 px-4 pt-2.5 pb-3" style={{ borderTopColor: color }}>
        <div className="m3-label-large flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
          <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">
            {t("metro.towards", { destination: stationLabel(t, group.destination, "hong_kong") })}
          </span>
          {next.platform ? (
            <span className="ml-auto shrink-0 whitespace-nowrap font-semibold">{t("board.platform", { platform: next.platform })}</span>
          ) : null}
        </div>
        <div className="mt-2.5 flex min-w-0 items-end justify-between gap-3">
          {next.minutes <= 99
            ? <SplitFlap minutes={next.minutes} />
            : <span className="m3-title-medium font-mono font-bold tabular-nums">{next.minutes} {t("result.min_label")}</span>}
          {later.length > 0 ? (
            <p className="m3-label-medium min-w-0 text-right text-slate-600 dark:text-slate-300">
              {t("result.then")}{" "}
              <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{later.slice(0, 3).map((departure) => departure.minutes).join(" · ")}</span>{" "}
              {t("result.min_label")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface StationBoardViewProps {
  board: MtrStationBoard;
  now: Date;
  lineCode?: string;
  onLineChange: (code: string) => void;
}

/** The screen itself, without fetching, so a pinned board renders the same everywhere. */
export function StationBoardView({ board, now, lineCode, onLineChange }: StationBoardViewProps) {
  const { t } = useTranslation();
  const line = board.lines.find((entry) => entry.code === lineCode) ?? board.lines[0];
  const color = line?.color ?? "#64748b";
  const visibleGroups = line ? line.groups.filter((group) => boardMinutes(group.departures, now).length > 0) : [];
  return (
    <div className="flex flex-col gap-3">
      {board.lines.length > 1 ? (
        <div role="group" aria-label={t("board.lines")} className="flex flex-wrap gap-1">
          {board.lines.map((entry) => (
            <button
              key={entry.code}
              type="button"
              aria-pressed={entry.code === line?.code}
              aria-label={entry.name}
              onClick={() => onLineChange(entry.code)}
              className={`m3-state flex min-h-11 items-center rounded-lg px-1.5 ${entry.code === line?.code ? "" : "opacity-55"}`}
            >
              <LineBadge code={entry.code} color={entry.color ?? "#64748b"} />
            </button>
          ))}
        </div>
      ) : null}
      {line?.delayed ? (
        <p role="status" className="m3-label-medium font-semibold text-red-700 dark:text-red-300">{t("board.delayed")}</p>
      ) : null}
      {line?.unavailable ? (
        <p role="status" className="m3-body-medium text-slate-600 dark:text-slate-300">{t("board.line_unavailable")}</p>
      ) : visibleGroups.length === 0 ? (
        <p role="status" className="m3-body-medium text-slate-600 dark:text-slate-300">{t("board.no_live")}</p>
      ) : (
        visibleGroups.map((group) => (
          <BoardGroup key={`${group.direction}-${group.destination}`} group={group} color={color} now={now} />
        ))
      )}
    </div>
  );
}

interface StationBoardProps {
  station: string;
  onClose: () => void;
  onDepartFrom: (station: string) => void;
  /** Injectable wall clock; tests pin it. */
  now?: () => Date;
}

/**
 * Fetches the board, then refreshes every 30 seconds while the page is
 * visible. A failed refresh keeps the last board on screen as it was.
 */
export function StationBoard({ station, onClose, onDepartFrom, now = () => new Date() }: StationBoardProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLElement>(null);
  const [board, setBoard] = useState<MtrStationBoard>();
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState(now);
  const [lineCode, setLineCode] = useState<string>();
  const nowRef = useRef(now);
  nowRef.current = now;
  useModalFocusTrap(dialogRef, onClose);

  useEffect(() => {
    let active = true;
    const load = () => {
      setClock(nowRef.current());
      fetch(`/api/transit/hong-kong/board?${new URLSearchParams({ station })}`)
        .then((response) => (response.ok ? response.json() as Promise<MtrStationBoard> : Promise.reject(new Error(String(response.status)))))
        .then((next) => {
          if (!active) return;
          setBoard(next);
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
  }, [station]);

  const name = board?.station ?? station;
  const localName = stationLabel(t, name, "hong_kong");
  return (
    <motion.div
      data-country="hong_kong"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="m3-scrim fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
    >
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.85 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-board-title"
        className="m3-sheet-dialog m3-elevation-3 relative flex h-[88vh] w-full flex-col overflow-hidden bg-white dark:bg-[#060a13] sm:h-[80vh] sm:max-w-md"
      >
        <div className="h-1 shrink-0 bg-accent" />
        <header className="flex shrink-0 items-start gap-3 px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="m3-icon-button m3-icon-button-large m3-state text-slate-700 dark:text-slate-200"
            aria-label={t("workflow.back")}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <h1 id="station-board-title" className="m3-headline-medium font-black text-slate-900 dark:text-white">{localName}</h1>
            {localName !== name ? <p className="m3-title-small text-slate-600 dark:text-slate-300">{name}</p> : null}
            {board ? (
              <p className="m3-label-medium mt-1 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                <span>{t("board.updated", { time: hongKongClock(board.checkedAt) })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("board.refresh")}</span>
              </p>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" aria-live="polite">
          {board ? (
            <StationBoardView board={board} now={clock} lineCode={lineCode} onLineChange={setLineCode} />
          ) : failed ? (
            <p role="status" className="m3-body-medium text-slate-600 dark:text-slate-300">{t("board.no_live")}</p>
          ) : (
            <p role="status" className="m3-body-medium flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {t("board.loading")}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 pt-3 pb-4 dark:border-slate-800/50">
          <button type="button" className="m3-button m3-state w-full bg-accent text-on-accent" onClick={() => onDepartFrom(name)}>
            {t("board.depart")}
          </button>
          <p className="m3-body-small text-slate-500 dark:text-slate-400">{t("board.source")}</p>
        </footer>
      </motion.section>
    </motion.div>
  );
}

// --- End of StationBoard.tsx ---
