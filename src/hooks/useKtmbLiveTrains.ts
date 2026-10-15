// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Marks today's KTMB timetable rows whose train is on the official
// vehicle-position feed with where it was last seen. Times are left as published.

import { useEffect, useMemo, useState } from "react";
import type { TransitResult } from "../types";
import type { LiveTrain, LiveTrainsResponse } from "../server/malaysiaLive";

const REFRESH_MS = 30_000;

/** The stored row id is `${date}-my-ktmb-${static trip id}`, and the feed's trip id is the static one. */
export function withKtmbLivePositions(results: TransitResult[], date: string, trains: readonly LiveTrain[]): TransitResult[] {
  if (trains.length === 0) return results;
  const prefix = `${date}-my-ktmb-`;
  const byTrip = new Map(trains.map((train) => [train.tripId, train]));
  return results.map((trip) => {
    const train = trip.country === "malaysia" && trip.id.startsWith(prefix) ? byTrip.get(trip.id.slice(prefix.length)) : undefined;
    return train ? { ...trip, livePosition: { nearStation: train.nearStation, reportedAt: train.reportedAt } } : trip;
  });
}

/** Polls only while enabled and the page is visible; a failed poll keeps the last positions. */
export function useKtmbLiveTrains(enabled: boolean, results: TransitResult[], date: string): TransitResult[] {
  const [trains, setTrains] = useState<LiveTrain[]>([]);
  useEffect(() => {
    if (!enabled) {
      setTrains([]);
      return;
    }
    let active = true;
    const load = () => {
      fetch("/api/transit/malaysia/live-trains")
        .then((response) => (response.ok ? response.json() as Promise<LiveTrainsResponse> : Promise.reject(new Error(String(response.status)))))
        .then((body) => { if (active && Array.isArray(body.trains)) setTrains(body.trains); })
        .catch(() => { /* Positions are supplementary; keep the last ones. */ });
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled]);
  return useMemo(() => withKtmbLivePositions(results, date, trains), [results, date, trains]);
}
