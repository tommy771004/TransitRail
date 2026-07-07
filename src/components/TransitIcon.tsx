// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Custom Transit icon renderer and platform formatter based on service metadata

import { Train, Bus, Ship } from "lucide-react";
import type { TransitResult } from "../types";

interface TransitIconProps {
  trip: TransitResult;
  className?: string;
}

export function TransitIcon({ trip, className = "h-4 w-4" }: TransitIconProps) {
  const service = (trip.service || "").toLowerCase();
  const trainType = (trip.trainType || "").toLowerCase();
  const operator = (trip.operator || "").toLowerCase();
  const legs = trip.legs || [];
  let mode = "";
  if (legs.length > 0) {
    mode = (legs[0].mode || "").toLowerCase();
  }
  const combined = `${service} ${trainType} ${operator} ${mode}`.toLowerCase();
  if (
    combined.includes("shinkansen") ||
    combined.includes("bullet") ||
    combined.includes("high speed") ||
    combined.includes("high_speed") ||
    combined.includes("high-speed") ||
    combined.includes("ktx") ||
    combined.includes("srt") ||
    combined.includes("高鐵") ||
    combined.includes("tgv") ||
    combined.includes("ice") ||
    combined.includes("eurostar") ||
    combined.includes("nozomi") ||
    combined.includes("hikari") ||
    combined.includes("kodama") ||
    combined.includes("mizuho") ||
    combined.includes("sakura") ||
    combined.includes("tsubame") ||
    combined.includes("hayabusa") ||
    combined.includes("komachi") ||
    combined.includes("kagayaki") ||
    combined.includes("lner") ||
    combined.includes("avanti")
  ) {
    return <Train className={`${className} text-rose-500 dark:text-rose-400`} />;
  }
  if (
    combined.includes("subway") ||
    combined.includes("metro") ||
    combined.includes("underground") ||
    combined.includes("tube") ||
    combined.includes("지하철") ||
    combined.includes("전鐵") ||
    combined.includes("捷運") ||
    combined.includes("地鐵") ||
    combined.includes("mtr") ||
    combined.includes("u-bahn") ||
    combined.includes("s-bahn")
  ) {
    return <Train className={`${className} text-blue-500 dark:text-blue-400`} />;
  }
  if (
    combined.includes("bus") ||
    combined.includes("coach") ||
    combined.includes("highway bus") ||
    combined.includes("버스") ||
    combined.includes("客運") ||
    combined.includes("巴士") ||
    combined.includes("kmb") ||
    combined.includes("citybus") ||
    combined.includes("nwfb")
  ) {
    return <Bus className={`${className} text-amber-500 dark:text-amber-400`} />;
  }
  if (
    combined.includes("tram") ||
    combined.includes("streetcar") ||
    combined.includes("dlr") ||
    combined.includes("light rail") ||
    combined.includes("light_rail") ||
    combined.includes("電車") ||
    combined.includes("輕鐵")
  ) {
    return <Train className={`${className} text-teal-500 dark:text-teal-400`} />;
  }
  if (combined.includes("ferry") || combined.includes("boat") || combined.includes("渡輪") || combined.includes("star ferry")) {
    return <Ship className={`${className} text-cyan-500 dark:text-cyan-400`} />;
  }
  return <Train className={`${className} text-emerald-600 dark:text-emerald-400`} />;
}

export function formatPlatform(platform: string | undefined | null, t: (key: string, options?: any) => string): string {
  if (!platform) return "";
  const platStr = String(platform).trim();
  if (!platStr || platStr === "-") return "";

  const platLabel = t("result.plat_label", { defaultValue: "Plat" });
  if (platLabel === "月台") {
    if (platStr.includes("月台") || platStr.includes("号") || platStr.includes("號")) {
      return platStr;
    }
    return `${platStr} 號月台`;
  } else {
    if (platStr.toLowerCase().includes("plat") || platStr.toLowerCase().includes("track") || platStr.toLowerCase().includes("gasp")) {
      return platStr;
    }
    return `${platLabel} ${platStr}`;
  }
}

// --- End of TransitIcon.tsx ---
