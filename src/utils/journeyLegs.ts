// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Per-leg display helpers shared by the result card, the route band and the
// trip sheet: the colour a ride is drawn in and how tight a connection is.

import type { JourneyLeg } from "../types";

export function getLegColor(leg: JourneyLeg, defaultColor?: string) {
  if (leg.color) return leg.color;
  const m = (leg.mode || "").toLowerCase();
  const l = (leg.lineName || "").toLowerCase();
  if (m.includes("bus") || m.includes("coach") || l.includes("bus") || l.includes("客運") || l.includes("巴士")) return "#f59e0b"; // amber
  if (m.includes("subway") || m.includes("metro") || m.includes("underground") || l.includes("subway") || l.includes("metro") || l.includes("捷運") || l.includes("地鐵")) return "#3b82f6"; // blue
  if (m.includes("high_speed") || m.includes("shinkansen") || l.includes("shinkansen") || l.includes("express") || l.includes("bullet") || l.includes("新幹線") || l.includes("高鐵") || l.includes("特急")) return "#ef4444"; // red
  return defaultColor || "#10b981"; // emerald default
}

export function transferPressure(minutes: number | null, isChinese: boolean) {
  if (minutes === null) return undefined;
  if (minutes <= 4) {
    return { label: isChinese ? "轉乘時間很短" : "Very short connection", className: "text-rose-700 dark:text-rose-300" };
  }
  if (minutes <= 10) {
    return { label: isChinese ? "一般轉乘" : "Standard connection", className: "text-amber-700 dark:text-amber-300" };
  }
  return { label: isChinese ? "轉乘時間充裕" : "Comfortable connection", className: "text-emerald-700 dark:text-emerald-300" };
}

// --- End of journeyLegs.ts ---
