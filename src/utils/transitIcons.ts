export function getTransitIcon(mode?: string, lineName?: string): string {
  const m = (mode || "").toLowerCase();
  const l = (lineName || "").toLowerCase();
  if (m.includes("bus") || m.includes("coach") || l.includes("bus") || l.includes("客運") || l.includes("巴士")) return "🚌";
  if (m.includes("subway") || m.includes("metro") || m.includes("underground") || l.includes("subway") || l.includes("metro") || l.includes("捷運") || l.includes("地鐵") || l.includes("地鐵")) return "🚇";
  if (m.includes("high_speed") || m.includes("shinkansen") || l.includes("shinkansen") || l.includes("express") || l.includes("bullet") || l.includes("新幹線") || l.includes("高鐵") || l.includes("特急")) return "🚄";
  if (m.includes("tram") || l.includes("tram") || l.includes("路面電車")) return "🚋";
  return "🚃";
}
