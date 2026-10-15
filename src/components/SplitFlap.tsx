// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The live countdown as a departure board shows it — two flap tiles of
// minutes that turn over when the minute changes. Only a realtime next departure uses it.

import { useTranslation } from "react-i18next";

/**
 * Each digit is keyed by its value, so a changed digit mounts afresh and plays
 * the flip once; an unchanged one stays still. Reduced motion collapses the
 * animation globally, leaving a plain digit change.
 */
export function SplitFlap({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  if (minutes <= 0) {
    return <span className="m3-title-large font-bold tracking-widest text-slate-900 dark:text-white">{t("result.departs_now")}</span>;
  }
  const digits = String(Math.min(minutes, 99)).padStart(2, "0").split("");
  return (
    <span className="flex items-end gap-1" data-split-flap>
      <span className="sr-only">{t("result.departs_in", { count: minutes })}</span>
      {digits.map((digit, index) => (
        <span key={`${index}-${digit}`} aria-hidden="true" className="split-flap-tile">
          {digit}
        </span>
      ))}
      <span aria-hidden="true" className="m3-label-large pb-0.5 font-bold text-slate-900 dark:text-white">{t("result.min_label")}</span>
    </span>
  );
}

// --- End of SplitFlap.tsx ---
