// Description: 功能更新記錄 dialog, opened from the side menu's last row. Lazy-loaded so the
// entries in src/data/changelog.ts stay out of the entry bundle. The focus trap returns
// focus to whatever opened it (the header's menu button once the menu has closed).

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { CHANGELOG, changelogLocale, type ChangeKind } from "../data/changelog";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";

const KIND_CLASS: Record<ChangeKind, string> = {
  added: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  changed: "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
  removed: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useModalFocusTrap(dialogRef, onClose);
  const locale = changelogLocale(i18n.language);
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
      .format(new Date(`${date}T00:00:00Z`));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="m3-scrim fixed inset-0 z-[75] flex items-center justify-center p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 340, mass: 0.7 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        className="m3-dialog flex max-h-[min(85dvh,40rem)] w-full max-w-md flex-col overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h2 id="changelog-title" className="m3-title-large text-slate-900 dark:text-white">{t("changelog.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="m3-icon-button m3-icon-button-large m3-state text-slate-500 dark:text-slate-400"
            aria-label={t("changelog.close")}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto overscroll-contain px-5 pb-5">
          {CHANGELOG.map((day) => (
            <section key={day.date} aria-labelledby={`changelog-${day.date}`} className="space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <h3 id={`changelog-${day.date}`} className="m3-label-large font-mono text-slate-500 dark:text-slate-400">
                <time dateTime={day.date}>{formatDate(day.date)}</time>
              </h3>
              <ul className="space-y-2">
                {day.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <span className={`m3-label-small m3-shape-full mt-0.5 shrink-0 px-2 py-0.5 font-semibold ${KIND_CLASS[item.kind]}`}>
                      {t(`changelog.${item.kind}`)}
                    </span>
                    <span className="m3-body-medium min-w-0 text-slate-700 dark:text-slate-200">{item.text[locale]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
