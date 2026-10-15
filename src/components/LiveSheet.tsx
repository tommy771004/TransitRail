// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The one sheet every live screen opens in — a station board, a list of
// trains on the move — so they share a header, a refresh line and a footer.

import { ArrowLeft } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import type { Country } from "../types";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";

/** "14:00:32" on the market's own clock. */
export function marketClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

interface LiveSheetProps {
  country: Country;
  titleId: string;
  title: string;
  subtitle?: string;
  /** The last successful update on the market clock; omitted until there is one. */
  updatedAt?: string;
  timeZone: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

export function LiveSheet({ country, titleId, title, subtitle, updatedAt, timeZone, onClose, children, footer }: LiveSheetProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLElement>(null);
  useModalFocusTrap(dialogRef, onClose);
  return (
    <motion.div
      data-country={country}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="m3-scrim fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
    >
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.85 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="m3-sheet-dialog m3-elevation-3 relative flex h-[88vh] w-full flex-col overflow-hidden bg-white dark:bg-[#060a13] sm:h-[80vh] sm:max-w-md"
      >
        <div className="h-1 shrink-0 bg-accent" />
        <header className="flex shrink-0 items-start gap-3 px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="m3-icon-button m3-icon-button-large m3-state text-slate-700 dark:text-slate-200"
            aria-label={t("workflow.back")}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <h1 id={titleId} className="m3-headline-medium font-black text-slate-900 dark:text-white">{title}</h1>
            {subtitle ? <p className="m3-title-small text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
            {updatedAt ? (
              <p className="m3-label-medium mt-1 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                <span>{t("board.updated", { time: marketClock(updatedAt, timeZone) })}</span>
                <span aria-hidden="true">·</span>
                <span>{t("board.refresh")}</span>
              </p>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" aria-live="polite">
          {children}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 pt-3 pb-4 dark:border-slate-800/50">
          {footer}
        </footer>
      </motion.section>
    </motion.div>
  );
}

/** What a live screen says while it waits for its first answer. */
export function LiveSheetStatus({ children }: { children: ReactNode }) {
  return <p role="status" className="m3-body-medium flex items-center gap-2 text-slate-600 dark:text-slate-300">{children}</p>;
}

// --- End of LiveSheet.tsx ---
