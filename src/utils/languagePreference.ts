export type TimezoneLanguage = "en" | "zh-TW" | "ja" | "ko";

const CHINESE_TIMEZONES = new Set([
  "Asia/Chongqing",
  "Asia/Harbin",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Urumqi",
  "PRC",
  "ROC",
]);

/**
 * Resolve the product language from the device timezone. Only the four markets
 * whose local scripts TransitRail ships opt into a regional default; every
 * other timezone intentionally starts in English.
 */
export function languageForTimezone(timezone: string | undefined): TimezoneLanguage {
  if (timezone === "Asia/Tokyo" || timezone === "Japan") return "ja";
  if (timezone === "Asia/Seoul" || timezone === "ROK") return "ko";
  if (timezone && CHINESE_TIMEZONES.has(timezone)) return "zh-TW";
  return "en";
}

export function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
