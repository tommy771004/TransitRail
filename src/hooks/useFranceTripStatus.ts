// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Marks today's SNCF timetable rows with what the official trip-update
// feed says about them at the passenger's stations: late, on time, cancelled, or not
// calling. Times are left as published.

import { useEffect, useMemo, useState } from "react";
import type { TransitResult } from "../types";
import type { FranceTripStatus, FranceTripStatusResponse } from "../server/franceLive";

/** SNCF refreshes every two minutes; this reads about twice as often. */
const REFRESH_MS = 60_000;

/** The stored row id is `${date}-fr-${static trip id}`, and the feed's trip id is the static one. */
export function withFranceTripStatus(results: TransitResult[], statuses: readonly FranceTripStatus[], checkedAt: string): TransitResult[] {
  if (statuses.length === 0) return results;
  const byRow = new Map(statuses.map((status) => [`${status.date}-fr-${status.tripId}`, status]));
  return results.map((trip) => {
    const status = trip.country === "france" ? byRow.get(trip.id) : undefined;
    if (!status) return trip;
    return {
      ...trip,
      liveStatus: {
        checkedAt,
        ...(status.cancelled ? { cancelled: true } : {}),
        ...(status.originSkipped ? { skipped: true } : {}),
        ...(typeof status.departureDelayMinutes === "number" ? { delayMinutes: status.departureDelayMinutes } : {}),
        ...(typeof status.arrivalDelayMinutes === "number" ? { arrivalDelayMinutes: status.arrivalDelayMinutes } : {}),
      },
    };
  });
}

/** One read per station pair on the page; a failed read keeps the last statuses. */
export function useFranceTripStatus(enabled: boolean, results: TransitResult[]): TransitResult[] {
  const pairs = useMemo(() => {
    if (!enabled) return [];
    const seen = new Set<string>();
    for (const trip of results) if (trip.country === "france") seen.add(JSON.stringify([trip.origin, trip.destination]));
    return [...seen].sort();
  }, [enabled, results]);
  const key = pairs.join("|");
  const [live, setLive] = useState<{ statuses: FranceTripStatus[]; checkedAt: string }>();

  useEffect(() => {
    setLive(undefined);
    if (!key) return;
    let active = true;
    const load = () => {
      Promise.all(pairs.map((pair) => {
        const [origin, destination] = JSON.parse(pair) as [string, string];
        const query = new URLSearchParams({ origin, destination });
        return fetch(`/api/transit/france/trip-status?${query}`)
          .then((response) => (response.ok ? response.json() as Promise<FranceTripStatusResponse> : Promise.reject(new Error(String(response.status)))));
      }))
        .then((bodies) => {
          if (!active || !bodies.every((body) => Array.isArray(body.trips))) return;
          setLive({ statuses: bodies.flatMap((body) => body.trips), checkedAt: bodies[0]?.checkedAt ?? new Date().toISOString() });
        })
        .catch(() => { /* Statuses are supplementary; keep the last ones. */ });
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
    // `pairs` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => (live ? withFranceTripStatus(results, live.statuses, live.checkedAt) : results), [results, live]);
}
