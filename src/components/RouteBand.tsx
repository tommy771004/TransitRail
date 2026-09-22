// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The proportional route band on a result card — one thin track per ride,
// sized by minutes, coloured by the line, with a pressure-coloured dot at each change.

import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { JourneyLeg, TransitResult } from "../types";
import { getLegColor, minutesOf, pressureKey, transferPressure, type PressureKey } from "../utils/journeyLegs";

export interface BandLeg {
  name: string;
  color: string;
  minutes: number;
  /** Minutes waiting before the next ride; undefined on the last ride or when unknown. */
  waitMinutes?: number;
}

/**
 * The rides of one journey, in band form.
 *
 * ODPT files one leg per stop for a direct train; those hops are one ride, so
 * a direct trip is always one segment. A ride with no usable times takes the
 * average of the rides that have them (or an even share when none do) rather
 * than shrinking to a sliver the band would misrepresent.
 */
export function bandLegs(trip: TransitResult): BandLeg[] {
  const legs = trip.direct === false && trip.legs && trip.legs.length > 1 ? trip.legs : undefined;
  if (!legs) {
    return [{
      name: trip.service || trip.trainType || "",
      color: trip.lineColor || getLegColor({ lineName: trip.service, mode: trip.trainType } as JourneyLeg, trip.lineColor),
      minutes: Math.max(trip.durationMinutes ?? 1, 1),
    }];
  }
  const rides = legs.map((leg, index) => {
    const next = legs[index + 1];
    const start = minutesOf(leg.departureTime);
    const end = minutesOf(leg.arrivalTime);
    const ride = leg.durationMinutes ?? (start !== null && end !== null && end >= start ? end - start : undefined);
    const nextStart = minutesOf(next?.departureTime);
    const wait = next && end !== null && nextStart !== null && nextStart >= end ? nextStart - end : undefined;
    return { leg, ride, wait: next ? wait : undefined };
  });
  const known = rides.map((ride) => ride.ride).filter((minutes): minutes is number => typeof minutes === "number" && minutes > 0);
  const total = trip.durationMinutes && trip.durationMinutes > 0 ? trip.durationMinutes : undefined;
  const fallback = known.length > 0
    ? known.reduce((sum, minutes) => sum + minutes, 0) / known.length
    : total ? total / legs.length : 1;
  return rides.map(({ leg, ride, wait }) => ({
    name: leg.lineName,
    color: getLegColor(leg, trip.lineColor),
    minutes: Math.max(ride && ride > 0 ? ride : fallback, 1),
    waitMinutes: wait,
  }));
}

/** The tightest change on the journey; undefined for a direct trip or when no wait is known. */
export function tightestWait(legs: BandLeg[]): number | undefined {
  const waits = legs.map((leg) => leg.waitMinutes).filter((wait): wait is number => typeof wait === "number");
  return waits.length > 0 ? Math.min(...waits) : undefined;
}

const pressureDot: Record<PressureKey, string> = {
  short: "border-rose-600 dark:border-rose-400",
  standard: "border-amber-600 dark:border-amber-400",
  comfortable: "border-emerald-600 dark:border-emerald-400",
  unknown: "border-slate-400 dark:border-slate-500",
};

interface RouteBandProps {
  trip: TransitResult;
  /** Line names sit above the track; the compact form drops them. */
  compact?: boolean;
  className?: string;
}

/**
 * Segment widths are minutes over the journey total, so a 2-minute Bakerloo
 * hop after a 46-minute Piccadilly ride reads as the sliver it is. A segment
 * under 16% hides its label rather than clipping it; the card's composition
 * line names every ride in text, so the band itself stays decorative to
 * assistive technology. Everything here is `min-w-0` so the band can never
 * push the arrival time off the card.
 */
export function RouteBand({ trip, compact = false, className = "" }: RouteBandProps) {
  const { t } = useTranslation();
  const legs = bandLegs(trip);
  const total = legs.reduce((sum, leg) => sum + leg.minutes, 0) || 1;

  return (
    <div className={`grid min-w-0 gap-1 ${className}`} data-route-band aria-hidden="true">
      {!compact && (
        <div className="flex h-3.5 min-w-0">
          {legs.map((leg, index) => {
            const share = leg.minutes / total;
            return (
              <span key={`label-${index}`} className="contents">
                <span
                  className={`m3-label-small min-w-0 truncate pr-1.5 leading-[14px] text-[var(--lc)] dark:text-[color-mix(in_srgb,var(--lc)_52%,white)] ${share < 0.16 ? "invisible" : ""}`}
                  style={{ flex: `${Math.max(share * 100, 3)} 1 0%`, "--lc": leg.color } as CSSProperties}
                >
                  {leg.name}
                </span>
                {index < legs.length - 1 && <span className="w-3 shrink-0" />}
              </span>
            );
          })}
        </div>
      )}
      <div className="flex h-1.5 min-w-0 items-center">
        {legs.map((leg, index) => (
          <span key={`seg-${index}`} className="contents">
            <span
              className="h-1.5 min-w-1 rounded-full bg-[var(--lc)] dark:bg-[color-mix(in_srgb,var(--lc)_78%,white)]"
              style={{ flex: `${Math.max((leg.minutes / total) * 100, 3)} 1 0%`, "--lc": leg.color } as CSSProperties}
            />
            {index < legs.length - 1 && (
              <span
                className="relative h-1.5 w-3 shrink-0"
                title={transferPressure(leg.waitMinutes, t)?.label}
              >
                <span className="absolute inset-x-0.5 top-0.5 h-0.5 bg-[repeating-linear-gradient(90deg,var(--color-slate-400)_0_2px,transparent_2px_4px)]" />
                <span
                  className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white dark:bg-slate-900 ${pressureDot[pressureKey(leg.waitMinutes)]}`}
                />
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- End of RouteBand.tsx ---
