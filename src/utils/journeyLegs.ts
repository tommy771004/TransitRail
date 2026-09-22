// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Per-leg display helpers shared by the result card, the route band and the
// trip sheet: clock parsing, the colour a ride is drawn in and how tight a connection is.

import type { TFunction } from "i18next";
import type { JourneyLeg } from "../types";

/**
 * Minutes since midnight for an "HH:MM" clock, or null when the text is not one.
 * Provider service hours can run past 24:00 ("25:10"); they stay on the same
 * service day rather than wrapping, which is what sorting and gaps need.
 */
export function minutesOf(time?: string | null): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(time || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function getLegColor(leg: JourneyLeg, defaultColor?: string) {
  if (leg.color) return leg.color;
  const m = (leg.mode || "").toLowerCase();
  const l = (leg.lineName || "").toLowerCase();
  if (m.includes("bus") || m.includes("coach") || l.includes("bus") || l.includes("客運") || l.includes("巴士")) return "#f59e0b"; // amber
  if (m.includes("subway") || m.includes("metro") || m.includes("underground") || l.includes("subway") || l.includes("metro") || l.includes("underground") || l.includes("捷運") || l.includes("地鐵")) return "#3b82f6"; // blue
  if (m.includes("high_speed") || m.includes("shinkansen") || l.includes("shinkansen") || l.includes("express") || l.includes("bullet") || l.includes("新幹線") || l.includes("高鐵") || l.includes("特急")) return "#ef4444"; // red
  return defaultColor || "#10b981"; // emerald default
}

export type PressureKey = "short" | "standard" | "comfortable" | "unknown";

/** The single place the connection thresholds live: ≤4 min is tight, ≤10 is ordinary. */
export function pressureKey(minutes: number | null | undefined): PressureKey {
  if (minutes === null || minutes === undefined) return "unknown";
  if (minutes <= 4) return "short";
  if (minutes <= 10) return "standard";
  return "comfortable";
}

const pressureLabelKey: Record<Exclude<PressureKey, "unknown">, string> = {
  short: "result.connection_short",
  standard: "result.connection_standard",
  comfortable: "result.connection_comfortable",
};

/** Text colour for a pressure bucket, on a card or in the timeline. */
export const pressureTextClass: Record<PressureKey, string> = {
  short: "text-rose-700 dark:text-rose-300",
  standard: "text-amber-700 dark:text-amber-300",
  comfortable: "text-emerald-700 dark:text-emerald-300",
  unknown: "text-slate-500 dark:text-slate-400",
};

export function transferPressure(minutes: number | null | undefined, t: TFunction) {
  const key = pressureKey(minutes);
  if (key === "unknown") return undefined;
  return { key, label: t(pressureLabelKey[key]), className: pressureTextClass[key] };
}

// --- End of journeyLegs.ts ---
