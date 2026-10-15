// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: A Hong Kong station's live departures screen from MTR Next Train —
// every line through the station, each platform and terminus with its next trains.

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MtrBoardDeparture, MtrBoardGroup, MtrStationBoard } from "../server/hongKongMtr";
import { stationLabel } from "../utils/stationLabel";
import { LineBadge } from "./LineBadge";
import { SplitFlap } from "./SplitFlap";
import { LiveSheet, LiveSheetStatus } from "./LiveSheet";
import { useLivePoll } from "../hooks/useLivePoll";

const isStationBoard = (body: unknown): body is MtrStationBoard =>
  Boolean(body && typeof body === "object" && Array.isArray((body as MtrStationBoard).lines));

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
export function StationBoard({ station, onClose, onDepartFrom, now }: StationBoardProps) {
  const { t } = useTranslation();
  const [lineCode, setLineCode] = useState<string>();
  const poll = useLivePoll(`/api/transit/hong-kong/board?${new URLSearchParams({ station })}`, REFRESH_MS, isStationBoard, now);
  const board = poll.data;
  const name = board?.station ?? station;
  const localName = stationLabel(t, name, "hong_kong");
  return (
    <LiveSheet
      country="hong_kong"
      titleId="station-board-title"
      title={localName}
      subtitle={localName !== name ? name : undefined}
      updatedAt={board?.checkedAt}
      timeZone="Asia/Hong_Kong"
      onRefresh={poll.refresh}
      refreshing={poll.loading}
      onClose={onClose}
      footer={<>
        <button type="button" className="m3-button m3-state w-full bg-accent text-on-accent" onClick={() => onDepartFrom(name)}>
          {t("board.depart")}
        </button>
        <p className="m3-body-small text-slate-500 dark:text-slate-400">{t("board.source")}</p>
      </>}
    >
      {board ? (
        <StationBoardView board={board} now={poll.clock} lineCode={lineCode} onLineChange={setLineCode} />
      ) : poll.failed ? (
        <LiveSheetStatus>{t("board.no_live")}</LiveSheetStatus>
      ) : (
        <LiveSheetStatus>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t("board.loading")}
        </LiveSheetStatus>
      )}
    </LiveSheet>
  );
}

// --- End of StationBoard.tsx ---
